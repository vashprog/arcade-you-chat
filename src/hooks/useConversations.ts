import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import type { Conversation } from '@/pages/Chat';

export const useConversations = () => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchConversations = async () => {
    if (!user) return;

    try {
      // Get conversations where user is a participant
      const { data: participations, error: partError } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', user.id);

      if (partError) throw partError;

      if (!participations || participations.length === 0) {
        setConversations([]);
        setLoading(false);
        return;
      }

      const conversationIds = participations.map(p => p.conversation_id);

      // Get conversation details
      const { data: convData, error: convError } = await supabase
        .from('conversations')
        .select('*')
        .in('id', conversationIds);

      if (convError) throw convError;

      // Get other participants for each conversation to display names
      const conversationsWithDetails: Conversation[] = await Promise.all(
        (convData || []).map(async (conv) => {
          // Get other participants
          const { data: participants } = await supabase
            .from('conversation_participants')
            .select('user_id')
            .eq('conversation_id', conv.id)
            .neq('user_id', user.id);

          // Get profile of other participant (for 1-on-1 chats)
          let displayName = conv.name || 'New Conversation';
          let isOnline = false;
          let avatarUrl = '';

          if (participants && participants.length > 0 && !conv.is_group) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('username, avatar_url, status')
              .eq('id', participants[0].user_id)
              .maybeSingle();

            if (profile) {
              displayName = profile.username;
              avatarUrl = profile.avatar_url || '';
              isOnline = profile.status === 'online';
            }
          }

          // Get last message
          const { data: lastMsg } = await supabase
            .from('messages')
            .select('content, created_at')
            .eq('conversation_id', conv.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          // Get unread count
          const { count: unreadCount } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', conv.id)
            .eq('is_read', false)
            .neq('sender_id', user.id);

          const otherParticipantIds = participants?.map((participant) => participant.user_id).filter(Boolean) as string[] || [];

          return {
            id: conv.id,
            name: displayName,
            avatar: avatarUrl,
            lastMessage: lastMsg?.content || 'No messages yet',
            timestamp: lastMsg?.created_at
              ? formatTimestamp(new Date(lastMsg.created_at))
              : '',
            unread: unreadCount || 0,
            isOnline,
            isGroup: conv.is_group || false,
            participantIds: [user.id, ...otherParticipantIds],
            otherParticipantIds,
          };
        })
      );

      setConversations(conversationsWithDetails);
    } catch (error) {
      console.error('Error fetching conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const createConversation = async (otherUserId: string): Promise<Conversation | null> => {
    if (!user) return null;

    try {
      // Get other user's profile first
      const { data: otherProfile } = await supabase
        .from('profiles')
        .select('username, avatar_url, status')
        .eq('id', otherUserId)
        .maybeSingle();

      // Check if conversation already exists between these two users
      const { data: existingParticipations } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', user.id);

      if (existingParticipations) {
        for (const part of existingParticipations) {
          // Check if this is a 1-on-1 conversation (not a group)
          const { data: convData } = await supabase
            .from('conversations')
            .select('is_group')
            .eq('id', part.conversation_id)
            .single();

          if (convData?.is_group) continue; // Skip group conversations

          const { data: otherPart } = await supabase
            .from('conversation_participants')
            .select('conversation_id')
            .eq('conversation_id', part.conversation_id)
            .eq('user_id', otherUserId)
            .maybeSingle();

          if (otherPart) {
            // Conversation already exists, return it with details
            await fetchConversations();
            return {
              id: part.conversation_id!,
              name: otherProfile?.username || 'Chat',
              avatar: otherProfile?.avatar_url || '',
              isOnline: otherProfile?.status === 'online',
              isGroup: false,
              participantIds: [user.id, otherUserId],
              otherParticipantIds: [otherUserId],
            };
          }
        }
      }

      // Use the secure RPC function to create conversation with participants
      const { data: conversationId, error } = await supabase
        .rpc('create_conversation_with_participants', {
          p_name: otherProfile?.username || 'Chat',
          p_is_group: false,
          p_participant_ids: [user.id, otherUserId]
        });

      if (error) throw error;

      await fetchConversations();
      
      return {
        id: conversationId,
        name: otherProfile?.username || 'Chat',
        avatar: otherProfile?.avatar_url || '',
        isOnline: otherProfile?.status === 'online',
        isGroup: false,
        participantIds: [user.id, otherUserId],
        otherParticipantIds: [otherUserId],
      };
    } catch (error) {
      console.error('Error creating conversation:', error);
      return null;
    }
  };

  const createGroupConversation = async (otherUserIds: string[], groupName: string): Promise<Conversation | null> => {
    if (!user) return null;

    try {
      // Use the secure RPC function to create group conversation with participants
      const { data: conversationId, error } = await supabase
        .rpc('create_conversation_with_participants', {
          p_name: groupName,
          p_is_group: true,
          p_participant_ids: [user.id, ...otherUserIds]
        });

      if (error) throw error;

      await fetchConversations();
      
      return {
        id: conversationId,
        name: groupName,
        avatar: '',
        isOnline: false,
        isGroup: true,
        participantIds: [user.id, ...otherUserIds],
        otherParticipantIds: otherUserIds,
      };
    } catch (error) {
      console.error('Error creating group conversation:', error);
      return null;
    }
  };

  const deleteConversation = async (conversationId: string): Promise<boolean> => {
    if (!user) return false;

    try {
      // Delete messages first (they reference the conversation)
      await supabase
        .from('messages')
        .delete()
        .eq('conversation_id', conversationId);

      // Delete participants
      await supabase
        .from('conversation_participants')
        .delete()
        .eq('conversation_id', conversationId);

      // Delete conversation
      const { error } = await supabase
        .from('conversations')
        .delete()
        .eq('id', conversationId);

      if (error) throw error;

      await fetchConversations();
      return true;
    } catch (error) {
      console.error('Error deleting conversation:', error);
      return false;
    }
  };

  const findUserById = async (userId: string) => {
    if (!userId.trim()) return [];
    
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, avatar_url, status')
      .eq('id', userId.trim())
      .neq('id', user?.id || '')
      .limit(1);

    if (error) {
      console.error('Error finding user:', error);
      return [];
    }

    return data || [];
  };

  useEffect(() => {
    fetchConversations();
  }, [user]);

  // Subscribe to real-time updates for messages (new messages, reads, deletes)
  useEffect(() => {
    if (!user?.id) return;
    //supabase.removeAllChannels();

    const channel = supabase
      .channel(`conversations-changes-${user.id}`)
      //.channel('conversations-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        () => {
          fetchConversations();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
        },
        () => {
          // Refetch when messages are marked as read
          fetchConversations();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'messages',
        },
        () => {
          fetchConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  return {
    conversations,
    loading,
    createConversation,
    createGroupConversation,
    deleteConversation,
    findUserById,
    refetch: fetchConversations,
  };
};

function formatTimestamp(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  return date.toLocaleDateString();
}
