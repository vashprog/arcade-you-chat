import { useEffect, useCallback, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

interface CallData {
  id: string;
  conversation_id: string;
  caller_id: string;
  callee_id: string;
  call_type: 'audio' | 'video';
  status: 'ringing' | 'answered' | 'ended' | 'rejected';
  created_at?: string;
  offer?: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
  caller_candidates?: RTCIceCandidateInit[];
  callee_candidates?: RTCIceCandidateInit[];
}

interface CallerProfile {
  id: string;
  username: string;
  avatar_url?: string;
}

interface IncomingCall {
  callData: CallData;
  callerProfile: CallerProfile;
}

const RINGING_TTL_MS = 45_000;

const isExpiredRingingCall = (callData: CallData) => {
  if (callData.status !== 'ringing' || !callData.created_at) return false;
  const createdAt = new Date(callData.created_at).getTime();
  return Number.isFinite(createdAt) && Date.now() - createdAt > RINGING_TTL_MS;
};

export const useCallSignaling = () => {
  const { user } = useAuth();
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [activeCall, setActiveCall] = useState<CallData | null>(null);

  // Use refs to avoid stale closures in the realtime callback
  // This prevents unnecessary effect re-runs that tear down/recreate the channel
  const incomingCallRef = useRef<IncomingCall | null>(null);
  const activeCallRef = useRef<CallData | null>(null);

  // Keep refs in sync with state
  useEffect(() => {
    incomingCallRef.current = incomingCall;
  }, [incomingCall]);

  useEffect(() => {
    activeCallRef.current = activeCall;
  }, [activeCall]);

  // Helper to process an incoming call row
  const processIncomingCall = useCallback(async (callData: CallData) => {
    // Skip if it's not for us or not ringing
    if (callData.callee_id !== user?.id || callData.status !== 'ringing') return;

    // Ignore stale ringing calls and mark them ended so they stop reappearing
    if (isExpiredRingingCall(callData)) {
      await supabase
        .from('active_calls')
        .update({ status: 'ended' })
        .eq('id', callData.id)
        .eq('status', 'ringing');
      return;
    }

    // Skip if we already have this exact incoming call
    if (incomingCallRef.current?.callData.id === callData.id) return;

    // Skip duplicate parallel ringing rows from same caller/conversation
    if (
      incomingCallRef.current &&
      incomingCallRef.current.callData.caller_id === callData.caller_id &&
      incomingCallRef.current.callData.conversation_id === callData.conversation_id
    ) {
      return;
    }

    const { data: callerProfile } = await supabase
      .from('profiles')
      .select('id, username, avatar_url')
      .eq('id', callData.caller_id)
      .single();

    if (callerProfile) {
      setIncomingCall({ callData, callerProfile });
    }
  }, [user?.id]);

  // Listen for incoming calls via Realtime + polling fallback
  useEffect(() => {
    if (!user?.id) return;

    let isMounted = true;

    const cleanupStaleIncomingCalls = async () => {
      const staleBefore = new Date(Date.now() - RINGING_TTL_MS).toISOString();
      await supabase
        .from('active_calls')
        .update({ status: 'ended' })
        .eq('callee_id', user.id)
        .eq('status', 'ringing')
        .lt('created_at', staleBefore);
    };

    cleanupStaleIncomingCalls();

    const channelKey = `call-signaling-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // Realtime subscription — listen to ALL events on active_calls, filter client-side
    const channel = supabase
      .channel(channelKey)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'active_calls',
        },
        async (payload) => {
          if (!isMounted) return;
          console.log('Incoming call detected (realtime):', payload);
          const callData = payload.new as CallData;
          if (callData.callee_id === user?.id) {
            await processIncomingCall(callData);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'active_calls',
        },
        (payload) => {
          if (!isMounted) return;
          const callData = payload.new as CallData;
          
          if (activeCallRef.current?.id === callData.id) {
            setActiveCall(callData);
          }
          
          if (callData.status === 'answered') {
            if (incomingCallRef.current?.callData.id === callData.id) {
              setIncomingCall(null);
            }
          }

          if (callData.status === 'rejected' || callData.status === 'ended') {
            if (incomingCallRef.current?.callData.id === callData.id) {
              setIncomingCall(null);
            }
            if (activeCallRef.current?.id === callData.id) {
              setActiveCall(null);
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'active_calls',
        },
        (payload) => {
          if (!isMounted) return;
          const deletedId = (payload.old as { id: string }).id;
          
          if (incomingCallRef.current?.callData.id === deletedId) {
            setIncomingCall(null);
          }
          if (activeCallRef.current?.id === deletedId) {
            setActiveCall(null);
          }
        }
      )
      .subscribe((status) => {
        console.log(`Call signaling channel [${channelKey}] status:`, status);
      });

    // Polling fallback: check for ringing calls every 3 seconds
    const pollInterval = setInterval(async () => {
      if (!isMounted || incomingCallRef.current) return;

      const staleBefore = new Date(Date.now() - RINGING_TTL_MS).toISOString();

      const { data } = await supabase
        .from('active_calls')
        .select('*')
        .eq('callee_id', user.id)
        .eq('status', 'ringing')
        .gte('created_at', staleBefore)
        .order('created_at', { ascending: false })
        .limit(3);

      if (data && data.length > 0 && isMounted) {
        for (const row of data) {
          await processIncomingCall(row as unknown as CallData);
          if (incomingCallRef.current) break;
        }
      }
    }, 3000);

    return () => {
      isMounted = false;
      clearInterval(pollInterval);
      supabase.removeChannel(channel);
    };
  }, [user?.id, processIncomingCall]);

  // Initiate a call
  const initiateCall = useCallback(async (
    conversationId: string,
    calleeId: string,
    callType: 'audio' | 'video',
    offer: RTCSessionDescriptionInit
  ): Promise<string | null> => {
    if (!user?.id) {
      toast.error('You must be logged in to make calls');
      return null;
    }

    try {
      // Ensure only one pending ring exists for this caller/callee/conversation
      await supabase
        .from('active_calls')
        .update({ status: 'ended' })
        .eq('conversation_id', conversationId)
        .eq('caller_id', user.id)
        .eq('callee_id', calleeId)
        .eq('status', 'ringing');

      const { data, error } = await supabase
        .from('active_calls')
        .insert({
          conversation_id: conversationId,
          caller_id: user.id,
          callee_id: calleeId,
          call_type: callType,
          status: 'ringing',
          offer: offer as any,
        } as any)
        .select()
        .single();

      if (error) throw error;
      
      setActiveCall(data as unknown as CallData);
      return data.id;
    } catch (error) {
      console.error('Error initiating call:', error);
      toast.error('Failed to initiate call');
      return null;
    }
  }, [user?.id]);

  // Answer a call
  const answerCall = useCallback(async (
    callId: string,
    answer: RTCSessionDescriptionInit
  ) => {
    try {
      const { data, error } = await supabase
        .from('active_calls')
        .update({
          status: 'answered',
          answer: answer as any,
        } as any)
        .eq('id', callId)
        .select()
        .single();

      if (error) throw error;
      
      setActiveCall(data as unknown as CallData);
      setIncomingCall(null);
      return true;
    } catch (error) {
      console.error('Error answering call:', error);
      toast.error('Failed to answer call');
      return false;
    }
  }, []);

  // Reject a call
  const rejectCall = useCallback(async (callId: string) => {
    try {
      await supabase
        .from('active_calls')
        .update({ status: 'rejected' })
        .eq('id', callId);

      setIncomingCall(null);
    } catch (error) {
      console.error('Error rejecting call:', error);
    }
  }, []);

  // End a call
  const endCall = useCallback(async (callId: string) => {
    try {
      // First update status to 'ended' so the other side gets the realtime event
      await supabase
        .from('active_calls')
        .update({ status: 'ended' })
        .eq('id', callId);

      // Then delete the row after a short delay to allow realtime propagation
      setTimeout(async () => {
        await supabase
          .from('active_calls')
          .delete()
          .eq('id', callId);
      }, 1000);

      setActiveCall(null);
      setIncomingCall(null);
    } catch (error) {
      console.error('Error ending call:', error);
    }
  }, []);

  // Add ICE candidate (inserts into call_ice_candidates table for speed)
  const addIceCandidate = useCallback(async (
    callId: string,
    candidate: RTCIceCandidateInit,
    isCaller: boolean
  ) => {
    try {
      const { error } = await supabase
        .from('call_ice_candidates')
        .insert({
          call_id: callId,
          sender: isCaller ? 'caller' : 'callee',
          candidate: candidate as any,
        });

      if (error) {
        console.error('Error inserting ICE candidate:', error);
      }
    } catch (error) {
      console.error('Error adding ICE candidate:', error);
    }
  }, []);

  // Get call by ID
  const getCall = useCallback(async (callId: string): Promise<CallData | null> => {
    try {
      const { data, error } = await supabase
        .from('active_calls')
        .select('*')
        .eq('id', callId)
        .single();

      if (error) throw error;
      return data as unknown as CallData;
    } catch (error) {
      console.error('Error getting call:', error);
      return null;
    }
  }, []);

  return {
    incomingCall,
    activeCall,
    initiateCall,
    answerCall,
    rejectCall,
    endCall,
    addIceCandidate,
    getCall,
    setActiveCall,
  };
};
