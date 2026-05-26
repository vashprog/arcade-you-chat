import { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  X,
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  Monitor,
  MonitorOff,
  Settings,
  Maximize2,
  Loader2,
} from 'lucide-react';
import type { Conversation } from '@/pages/Chat';
import { useWebRTC } from '@/hooks/useWebRTC';
import { useCallSignaling } from '@/hooks/useCallSignaling';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface VideoCallModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversation: Conversation | null;
  callType: 'audio' | 'video';
  incomingCallId?: string | null;
  incomingOffer?: RTCSessionDescriptionInit | null;
  targetCalleeId?: string | null;
}

const ANSWER_TIMEOUT_MS = 30000; // 30 seconds to get an answer
const CONNECT_TIMEOUT_MS = 20000; // 20 seconds to establish connection after answer

type ActiveCallUpdate = {
  status?: 'ringing' | 'answered' | 'ended' | 'rejected';
  answer?: RTCSessionDescriptionInit | null;
};

type CandidateRow = {
  id: string;
  sender: 'caller' | 'callee';
  candidate: RTCIceCandidateInit;
};

const VideoCallModal = ({ 
  isOpen, 
  onClose, 
  conversation, 
  callType,
  incomingCallId,
  incomingOffer,
  targetCalleeId,
}: VideoCallModalProps) => {
  const { user } = useAuth();
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const callIdRef = useRef<string | null>(null);
  const [callId, setCallId] = useState<string | null>(null);
  const isCallerRef = useRef<boolean>(true);
  const [isCaller, setIsCaller] = useState<boolean>(true);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const [callStatus, setCallStatus] = useState<'ringing' | 'connecting' | 'connected' | 'failed'>('ringing');
  const answerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const processedCandidateIdsRef = useRef<Set<string>>(new Set());
  const remoteAnswerAppliedRef = useRef(false);
  const isConnectedRef = useRef(false);
  
  const { initiateCall, answerCall, endCall: endSignalingCall, addIceCandidate: addSignalingCandidate } = useCallSignaling();

  // Store signaling functions in refs to avoid stale closures in startCall effect
  const addSignalingCandidateRef = useRef(addSignalingCandidate);
  useEffect(() => { addSignalingCandidateRef.current = addSignalingCandidate; }, [addSignalingCandidate]);

  const handleIceCandidate = useCallback((candidate: RTCIceCandidateInit) => {
    if (callIdRef.current) {
      addSignalingCandidateRef.current(callIdRef.current, candidate, isCallerRef.current);
    } else {
      pendingCandidatesRef.current.push(candidate);
    }
  }, []);

  const {
    localStream,
    remoteStream,
    isConnecting,
    isConnected,
    isMuted,
    isVideoOff,
    isScreenSharing,
    error,
    initializeMedia,
    createOffer,
    createAnswer,
    setRemoteAnswer,
    addIceCandidate: addPeerIceCandidate,
    endCall,
    toggleMute,
    toggleVideo,
    toggleScreenShare,
  } = useWebRTC({ 
    callType,
    onIceCandidate: handleIceCandidate,
  });

  // Clear timeouts helper
  const clearTimeouts = useCallback(() => {
    if (answerTimeoutRef.current) {
      clearTimeout(answerTimeoutRef.current);
      answerTimeoutRef.current = null;
    }
    if (connectTimeoutRef.current) {
      clearTimeout(connectTimeoutRef.current);
      connectTimeoutRef.current = null;
    }
  }, []);

  // Get other participant ID from conversation
  const getCalleeId = useCallback(async (): Promise<string | null> => {
    if (!conversation?.id || !user?.id) return null;

    if (targetCalleeId && targetCalleeId !== user.id) {
      return targetCalleeId;
    }

    try {
      const { data: participants } = await supabase
        .from('conversation_participants')
        .select('user_id')
        .eq('conversation_id', conversation.id)
        .neq('user_id', user.id)
        .limit(1);

      if (participants && participants.length > 0) {
        return participants[0].user_id;
      }
      return null;
    } catch (error) {
      console.error('Error getting callee:', error);
      return null;
    }
  }, [conversation?.id, targetCalleeId, user?.id]);

  // Store WebRTC functions in refs so the startCall effect never goes stale
  const initializeMediaRef = useRef(initializeMedia);
  const createOfferRef = useRef(createOffer);
  const createAnswerRef = useRef(createAnswer);
  const initiateCallRef = useRef(initiateCall);
  const answerCallRef = useRef(answerCall);
  const getCalleeIdRef = useRef(getCalleeId);

  useEffect(() => { initializeMediaRef.current = initializeMedia; }, [initializeMedia]);
  useEffect(() => { createOfferRef.current = createOffer; }, [createOffer]);
  useEffect(() => { createAnswerRef.current = createAnswer; }, [createAnswer]);
  useEffect(() => { initiateCallRef.current = initiateCall; }, [initiateCall]);
  useEffect(() => { answerCallRef.current = answerCall; }, [answerCall]);
  useEffect(() => { getCalleeIdRef.current = getCalleeId; }, [getCalleeId]);

  // Start call when modal opens
  useEffect(() => {
    if (!isOpen || !conversation) return;

    let cancelled = false;

    const startCall = async () => {
      const stream = await initializeMediaRef.current();
      if (!stream || cancelled) return;

      if (incomingCallId && incomingOffer) {
        // Answering an incoming call
        isCallerRef.current = false;
        setIsCaller(false);
        callIdRef.current = incomingCallId;
        setCallId(incomingCallId);
        setCallStatus('connecting');
        processedCandidateIdsRef.current.clear();
        remoteAnswerAppliedRef.current = false;

        const answer = await createAnswerRef.current(incomingOffer);
        if (answer && !cancelled) {
          await answerCallRef.current(incomingCallId, answer);
          
          // Send pending candidates
          for (const candidate of pendingCandidatesRef.current) {
            await addSignalingCandidateRef.current(incomingCallId, candidate, false);
          }
          pendingCandidatesRef.current = [];

          // Start connect timeout
          connectTimeoutRef.current = setTimeout(() => {
            if (!isConnectedRef.current) {
              setCallStatus('failed');
              toast.error('Connection timed out');
            }
          }, CONNECT_TIMEOUT_MS);
        }
      } else {
        // Initiating a new call
        isCallerRef.current = true;
        setIsCaller(true);
        setCallStatus('ringing');
        processedCandidateIdsRef.current.clear();
        remoteAnswerAppliedRef.current = false;

        const calleeId = await getCalleeIdRef.current();
        if (!calleeId || cancelled) {
          if (!cancelled) toast.error('Could not find the other participant');
          return;
        }

        const offer = await createOfferRef.current();
        if (offer && !cancelled) {
          const newCallId = await initiateCallRef.current(conversation.id, calleeId, callType, offer);
          if (newCallId && !cancelled) {
            callIdRef.current = newCallId;
            setCallId(newCallId);

            // Send pending candidates
            for (const candidate of pendingCandidatesRef.current) {
              await addSignalingCandidateRef.current(newCallId, candidate, true);
            }
            pendingCandidatesRef.current = [];

            // Start answer timeout
            answerTimeoutRef.current = setTimeout(() => {
              setCallStatus((current) => {
                if (current === 'ringing') {
                  toast.error('No answer - call timed out');
                  handleClose();
                  return 'failed';
                }
                return current;
              });
            }, ANSWER_TIMEOUT_MS);
          }
        }
      }
    };

    startCall();
    
    return () => {
      cancelled = true;
      clearTimeouts();
    };
  }, [isOpen, conversation?.id, incomingCallId, incomingOffer, callType, clearTimeouts]);

  // Listen for call answer (caller only)
  useEffect(() => {
    if (!callId || !isCaller) return;

    const applyAnswer = async (answer: RTCSessionDescriptionInit) => {
      if (remoteAnswerAppliedRef.current) return;
      remoteAnswerAppliedRef.current = true;

      console.log('Caller received answer');
      clearTimeouts();
      setCallStatus('connecting');
      await setRemoteAnswer(answer);

      connectTimeoutRef.current = setTimeout(() => {
        if (!isConnectedRef.current) {
          setCallStatus('failed');
          toast.error('Connection timed out');
        }
      }, CONNECT_TIMEOUT_MS);
    };

    const fetchAndProcessAnswer = async () => {
      const { data, error } = await supabase
        .from('active_calls')
        .select('answer, status')
        .eq('id', callId)
        .single();

      if (error) {
        console.error('Error fetching call state:', error);
        return;
      }

      if (data?.answer && data?.status === 'answered') {
        await applyAnswer(data.answer as unknown as RTCSessionDescriptionInit);
      }
    };

    // Initial fetch
    fetchAndProcessAnswer();

    const channel = supabase
      .channel(`call-answer-${callId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'active_calls',
          filter: `id=eq.${callId}`,
        },
        async (payload) => {
          const callData = payload.new as ActiveCallUpdate;
          if (callData.answer && callData.status === 'answered') {
            await applyAnswer(callData.answer);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [callId, isCaller, setRemoteAnswer, clearTimeouts]);

  // Listen for ICE candidates via new table (fast delivery)
  useEffect(() => {
    if (!callId) return;

    const otherSide = isCaller ? 'callee' : 'caller';

    // Fetch any existing candidates from the other side
    const fetchExistingCandidates = async () => {
      const { data, error } = await supabase
        .from('call_ice_candidates')
        .select('id, candidate')
        .eq('call_id', callId)
        .eq('sender', otherSide);

      if (error) {
        console.error('Error fetching ICE candidates:', error);
        return;
      }

      if (data) {
        for (const row of data) {
          if (!processedCandidateIdsRef.current.has(row.id)) {
            processedCandidateIdsRef.current.add(row.id);
            console.log(`Processing initial ICE candidate from ${otherSide}`);
            await addPeerIceCandidate(row.candidate as unknown as RTCIceCandidateInit);
          }
        }
      }
    };

    fetchExistingCandidates();

    // Subscribe to new candidates from other side
    const channel = supabase
      .channel(`ice-candidates-${callId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'call_ice_candidates',
          filter: `call_id=eq.${callId}`,
        },
        async (payload) => {
          const row = payload.new as CandidateRow;
          // Only process candidates from the other side
          if (row.sender === otherSide && !processedCandidateIdsRef.current.has(row.id)) {
            processedCandidateIdsRef.current.add(row.id);
            console.log(`Received ICE candidate from ${otherSide}`);
            await addPeerIceCandidate(row.candidate as unknown as RTCIceCandidateInit);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [callId, isCaller, addPeerIceCandidate]);

  // Track connection state changes
  useEffect(() => {
    isConnectedRef.current = isConnected;
    if (isConnected) {
      clearTimeouts();
      setCallStatus('connected');
    }
  }, [isConnected, clearTimeouts]);

  // Callback ref for local video - sets srcObject whenever element mounts or stream changes
  const localVideoCallbackRef = useCallback((node: HTMLVideoElement | null) => {
    localVideoRef.current = node;
    if (node && localStream) {
      node.srcObject = localStream;
      node.play().catch(() => {});
    }
  }, [localStream]);

  // Callback ref for remote video - sets srcObject whenever element mounts or stream changes
  const remoteVideoCallbackRef = useCallback((node: HTMLVideoElement | null) => {
    remoteVideoRef.current = node;
    if (node && remoteStream) {
      node.srcObject = remoteStream;
      node.play().catch(() => {});
    }
  }, [remoteStream]);

  // Attach remote stream to audio element
  useEffect(() => {
    if (remoteAudioRef.current && remoteStream) {
      remoteAudioRef.current.srcObject = remoteStream;
      remoteAudioRef.current.play().catch(() => {});
    }
  }, [remoteStream]);

  // Show error toast
  useEffect(() => {
    if (error) {
      toast.error(error);
      setCallStatus('failed');
    }
  }, [error]);

  const handleClose = useCallback(() => {
    clearTimeouts();
    if (callIdRef.current) {
      endSignalingCall(callIdRef.current);
    }
    endCall();
    callIdRef.current = null;
    setCallId(null);
    pendingCandidatesRef.current = [];
    processedCandidateIdsRef.current.clear();
    remoteAnswerAppliedRef.current = false;
    isConnectedRef.current = false;
    onClose();
  }, [clearTimeouts, endSignalingCall, endCall, onClose]);

  // Listen for remote hangup (call deleted or status changed to ended/rejected)
  useEffect(() => {
    if (!callId) return;

    const channel = supabase
      .channel(`call-hangup-${callId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'active_calls',
          filter: `id=eq.${callId}`,
        },
        (payload) => {
          const data = payload.new as ActiveCallUpdate;
          if (data.status === 'ended' || data.status === 'rejected') {
            console.log('Remote side ended the call');
            toast.info('Call ended');
            handleClose();
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'active_calls',
          filter: `id=eq.${callId}`,
        },
        () => {
          console.log('Call record deleted — remote hangup');
          toast.info('Call ended');
          handleClose();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [callId, handleClose]);
  const handleScreenShare = async () => {
    if (callType === 'audio') {
      toast.error('Screen sharing is only available during video calls');
      return;
    }
    await toggleScreenShare();
  };

  if (!isOpen || !conversation) return null;

  const getStatusText = () => {
    switch (callStatus) {
      case 'ringing':
        return 'Ringing...';
      case 'connecting':
        return 'Connecting...';
      case 'connected':
        return 'Connected';
      case 'failed':
        return 'Connection failed';
      default:
        return 'Calling...';
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-xl flex flex-col animate-fade-in-up">
      {/* Hidden audio element for remote audio playback */}
      <audio ref={remoteAudioRef} autoPlay playsInline />
      {/* Header */}
      <div className="h-16 px-6 flex items-center justify-between border-b border-border bg-card/50">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-neon-green animate-pulse' : callStatus === 'failed' ? 'bg-destructive' : 'bg-muted-foreground'}`} />
          </div>
          <span className="font-display text-lg">
            {callType === 'video' ? 'Video Call' : 'Audio Call'} with{' '}
            <span className="text-primary">{conversation.name}</span>
          </span>
          {isScreenSharing && (
            <span className="px-2 py-1 text-xs bg-primary/20 text-primary rounded-full flex items-center gap-1">
              <Monitor className="w-3 h-3" />
              Sharing Screen
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon">
            <Settings className="w-5 h-5" />
          </Button>
          <Button variant="ghost" size="icon">
            <Maximize2 className="w-5 h-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex">
        {/* Video Area */}
        <div className="flex-1 p-6 relative">
          {/* Main Video / Remote User */}
          <div className="w-full h-full rounded-2xl bg-gradient-to-br from-card to-muted overflow-hidden relative">
            {(isConnecting || callStatus === 'ringing' || callStatus === 'connecting') && !isConnected ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
                  <p className="text-muted-foreground font-body">{getStatusText()}</p>
                </div>
              </div>
            ) : callStatus === 'failed' ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <PhoneOff className="w-12 h-12 text-destructive mx-auto mb-4" />
                  <p className="text-destructive font-body mb-4">Connection failed</p>
                  <Button variant="outline" onClick={handleClose}>
                    Close
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {/* Remote Video Stream - always rendered, visibility controlled via CSS */}
                <video
                  ref={remoteVideoCallbackRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover ${
                    remoteStream && callType === 'video' ? '' : 'hidden'
                  }`}
                />
                {/* Remote User Avatar (shown when no remote video or audio call) */}
                {(!remoteStream || callType === 'audio') && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <Avatar className="w-32 h-32 border-4 border-primary/30 mx-auto mb-4">
                        <AvatarImage src={conversation.avatar} />
                        <AvatarFallback className="bg-gradient-to-br from-primary to-secondary text-primary-foreground font-display text-4xl">
                          {conversation.name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <h3 className="font-display text-2xl text-foreground mb-1">
                        {conversation.name}
                      </h3>
                      <p className={`font-body flex items-center justify-center gap-2 ${isConnected ? 'text-neon-green' : 'text-muted-foreground'}`}>
                        <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-neon-green animate-pulse' : 'bg-muted-foreground'}`} />
                        {getStatusText()}
                      </p>
                      {callType === 'audio' && isConnected && (
                        <div className="mt-4 flex justify-center gap-1">
                          {[...Array(5)].map((_, i) => (
                            <div
                              key={i}
                              className="w-1 bg-primary rounded-full animate-pulse"
                              style={{
                                height: `${Math.random() * 24 + 8}px`,
                                animationDelay: `${i * 0.1}s`,
                              }}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Call Duration */}
            <CallDuration isConnected={isConnected} />
          </div>
        </div>
      </div>

      {/* Self Video (Picture-in-Picture) - fixed to viewport so it's always visible */}
      <div
        className={`fixed z-[60] rounded-xl border-2 border-primary/60 overflow-hidden shadow-2xl shadow-primary/40 bg-card
          bottom-28 right-4
          w-32 h-24 sm:w-40 sm:h-28 md:w-48 md:h-36 lg:w-56 lg:h-40
          ${isScreenSharing ? 'md:w-64 md:h-48 lg:w-72 lg:h-52' : ''}`}
      >
              {/* Local video element is always mounted so the stream attaches reliably */}
              <video
                ref={localVideoCallbackRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${
                  callType === 'video' && localStream && !isVideoOff ? '' : 'hidden'
                } ${isScreenSharing ? '' : 'transform scale-x-[-1]'}`}
              />
              {!(callType === 'video' && localStream && !isVideoOff) && (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-accent/20 to-secondary/20">
                  {callType === 'audio' ? (
                    <div className="text-center">
                      <Mic className={`w-8 h-8 mx-auto mb-2 ${isMuted ? 'text-destructive' : 'text-primary'}`} />
                      <span className="text-muted-foreground font-body text-xs">
                        {isMuted ? 'Muted' : 'Audio Only'}
                      </span>
                    </div>
                  ) : (
                    <div className="text-center">
                      <VideoOff className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                      <span className="text-muted-foreground font-body text-xs">Camera Off</span>
                    </div>
                  )}
                </div>
              )}
              <div className="absolute bottom-1 left-2 text-[10px] font-body text-foreground/80 bg-background/40 px-1.5 py-0.5 rounded">
                You
              </div>
            </div>

      {/* Controls */}
      <div className="h-24 px-6 flex items-center justify-center gap-4 border-t border-border bg-card/50">
        <Button
          variant="glass"
          size="icon"
          className={`w-14 h-14 rounded-full transition-colors ${isMuted ? 'bg-destructive/20 hover:bg-destructive/30' : ''}`}
          onClick={toggleMute}
        >
          {isMuted ? (
            <MicOff className="w-6 h-6 text-destructive" />
          ) : (
            <Mic className="w-6 h-6" />
          )}
        </Button>

        {callType === 'video' && (
          <Button
            variant="glass"
            size="icon"
            className={`w-14 h-14 rounded-full transition-colors ${isVideoOff ? 'bg-destructive/20 hover:bg-destructive/30' : ''}`}
            onClick={toggleVideo}
            disabled={isScreenSharing}
          >
            {isVideoOff ? (
              <VideoOff className="w-6 h-6 text-destructive" />
            ) : (
              <Video className="w-6 h-6" />
            )}
          </Button>
        )}

        <Button
          variant="glass"
          size="icon"
          className={`w-14 h-14 rounded-full transition-colors ${isScreenSharing ? 'bg-primary/20 hover:bg-primary/30' : ''}`}
          onClick={handleScreenShare}
          disabled={callType === 'audio'}
        >
          {isScreenSharing ? (
            <MonitorOff className="w-6 h-6 text-primary" />
          ) : (
            <Monitor className="w-6 h-6" />
          )}
        </Button>

        <Button
          variant="destructive"
          size="icon"
          className="w-14 h-14 rounded-full ml-4"
          onClick={handleClose}
        >
          <PhoneOff className="w-6 h-6" />
        </Button>
      </div>
    </div>
  );
};

// Call duration timer component
const CallDuration = ({ isConnected }: { isConnected: boolean }) => {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!isConnected) {
      setSeconds(0);
      return;
    }

    const interval = setInterval(() => {
      setSeconds(prev => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isConnected]);

  const formatDuration = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isConnected) return null;

  return (
    <div className="absolute top-4 right-4 px-3 py-1 bg-card/50 backdrop-blur-sm rounded-full">
      <span className="font-display text-sm text-foreground">{formatDuration(seconds)}</span>
    </div>
  );
};

export default VideoCallModal;