import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface Message {
  id: string;
  content: string;
  type: 'text' | 'image' | 'gif' | 'sticker' | 'audio' | 'video' | 'document';
  mediaUrl?: string;
  senderId: string;
  timestamp: Date;
  senderName?: string;
}

export const useMessages = (conversationId: string | null) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const channelKeyRef = useRef<string | null>(null);

  const fetchMessages = async () => {
    if (!conversationId) {
      setMessages([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('messages')
        .select(`
          id,
          content,
          message_type,
          media_url,
          sender_id,
          created_at,
          profiles:sender_id (username)
        `)
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const formattedMessages: Message[] = (data || []).map((msg: any) => ({
        id: msg.id,
        content: msg.content || '',
        type: (msg.message_type || 'text') as Message['type'],
        mediaUrl: msg.media_url,
        senderId: msg.sender_id,
        timestamp: new Date(msg.created_at),
        senderName: msg.profiles?.username,
      }));

      setMessages(formattedMessages);

      // Mark messages as read
      await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('conversation_id', conversationId)
        .neq('sender_id', user?.id || '');
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (
    content: string,
    type: Message['type'] = 'text',
    mediaUrl?: string
  ): Promise<boolean> => {
    if (!user || !conversationId) return false;

    try {
      const { error } = await supabase.from('messages').insert({
        conversation_id: conversationId,
        sender_id: user.id,
        content,
        message_type: type,
        media_url: mediaUrl,
      });

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error sending message:', error);
      return false;
    }
  };

  const deleteMessage = async (messageId: string): Promise<boolean> => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('id', messageId)
        .eq('sender_id', user.id);

      if (error) throw error;

      setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
      return true;
    } catch (error) {
      console.error('Error deleting message:', error);
      return false;
    }
  };

  useEffect(() => {
    fetchMessages();
  }, [conversationId]);

  // Subscribe to real-time messages
  useEffect(() => {
    if (!conversationId) return;

    // IMPORTANT:
    // This hook can be mounted multiple times simultaneously (e.g. ChatMain + MobileChatOverlay).
    // If we reuse the same realtime channel name, supabase-js may internally reuse the same channel,
    // and a cleanup in one component can unsubscribe the other.
    // Use a unique channel name per mount to avoid collisions.
    channelKeyRef.current = `${conversationId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const channel = supabase
      .channel(`messages-${channelKeyRef.current}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload) => {
          // Prevent duplicates by checking if message already exists
          setMessages((prev) => {
            if (prev.some((m) => m.id === payload.new.id)) {
              return prev;
            }
            
            // Add the message immediately, then fetch profile
            const newMessage: Message = {
              id: payload.new.id,
              content: payload.new.content || '',
              type: (payload.new.message_type || 'text') as Message['type'],
              mediaUrl: payload.new.media_url,
              senderId: payload.new.sender_id,
              timestamp: new Date(payload.new.created_at),
              senderName: undefined, // Will be updated
            };
            return [...prev, newMessage];
          });

          // Fetch the sender's profile and update the message
          const { data: profile } = await supabase
            .from('profiles')
            .select('username')
            .eq('id', payload.new.sender_id)
            .maybeSingle();

          if (profile) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === payload.new.id ? { ...m, senderName: profile.username } : m
              )
            );
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          setMessages((prev) => prev.filter((m) => m.id !== payload.old.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  return {
    messages,
    loading,
    sendMessage,
    deleteMessage,
    refetch: fetchMessages,
  };
};
