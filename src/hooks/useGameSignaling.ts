import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface GameSession {
  id: string;
  conversation_id: string;
  game_type: string;
  status: string;
  created_by: string;
  callee_id: string | null;
  current_turn: string | null;
  game_state: Record<string, unknown>;
  created_at: string;
}

interface GameMove {
  id: string;
  session_id: string;
  player_id: string;
  move_type: string;
  move_data: Record<string, unknown>;
  created_at: string;
}

interface IncomingGameInvite {
  session: GameSession;
  inviterProfile: {
    username: string;
    avatar_url: string | null;
  };
}

export const useGameSignaling = () => {
  const { user } = useAuth();
  const [incomingGameInvite, setIncomingGameInvite] = useState<IncomingGameInvite | null>(null);
  const [activeGameSession, setActiveGameSession] = useState<GameSession | null>(null);
  const [gameMoves, setGameMoves] = useState<GameMove[]>([]);

  // Listen for incoming game invitations
  useEffect(() => {
    if (!user) return;

    const channelName = `game-invites-${user.id}-${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'game_sessions',
          filter: `callee_id=eq.${user.id}`,
        },
        async (payload) => {
          const session = payload.new as GameSession;
          
          if (session.status === 'pending') {
            // Fetch inviter profile
            const { data: profile } = await supabase
              .from('profiles')
              .select('username, avatar_url')
              .eq('id', session.created_by)
              .single();

            if (profile) {
              setIncomingGameInvite({
                session,
                inviterProfile: profile,
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Listen for game session updates (accept/reject/end)
  useEffect(() => {
    if (!user || !activeGameSession) return;

    const channelName = `game-session-${activeGameSession.id}-${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'game_sessions',
          filter: `id=eq.${activeGameSession.id}`,
        },
        (payload) => {
          const updated = payload.new as GameSession;
          setActiveGameSession(updated);

          // Clear moves when session is no longer playable; keep the session object so UI can react.
          if (updated.status === 'rejected' || updated.status === 'ended') {
            setGameMoves([]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, activeGameSession?.id]);

  // Fallback: some clients occasionally miss realtime UPDATE events.
  // When waiting on a pending invite, poll status briefly so repeated invites always resolve.
  useEffect(() => {
    // Guard: only poll when we have a pending session
    const sessionId = activeGameSession?.id;
    const isPending = activeGameSession?.status === 'pending';
    if (!sessionId || !isPending) return;

    let cancelled = false;
    const startedAt = Date.now();

    const poll = async () => {
      if (cancelled) return;

      // Stop after 45s
      if (Date.now() - startedAt > 45_000) return;

      try {
        const { data, error } = await supabase
          .from('game_sessions')
          .select('*')
          .eq('id', sessionId)
          .single();

        if (cancelled || error || !data) return;

        const fresh = data as GameSession;
        if (fresh.status !== 'pending') {
          setActiveGameSession(fresh);
          return; // stop polling
        }
      } catch {
        // ignore network errors
      }

      // Schedule next poll
      if (!cancelled) {
        setTimeout(poll, 1000);
      }
    };

    // Start polling loop
    const timer = setTimeout(poll, 1000);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [activeGameSession?.id, activeGameSession?.status]);

  // Listen for new game moves
  useEffect(() => {
    if (!activeGameSession) return;

    const channelName = `game-moves-${activeGameSession.id}-${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'game_moves',
          filter: `session_id=eq.${activeGameSession.id}`,
        },
        (payload) => {
          const newMove = payload.new as GameMove;
          setGameMoves((prev) => [...prev, newMove]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeGameSession?.id]);

  const inviteToGame = useCallback(
    async (conversationId: string, gameType: string, calleeId: string) => {
      if (!user) return null;

      // Clear any previous session state first
      setActiveGameSession(null);
      setGameMoves([]);

      // Make repeated invites reliable: close any existing pending/active session between these two users
      // in this conversation before creating a fresh one.
      await supabase
        .from('game_sessions')
        .update({ status: 'ended' })
        .eq('conversation_id', conversationId)
        .in('status', ['pending', 'active'])
        .or(
          `and(created_by.eq.${user.id},callee_id.eq.${calleeId}),and(created_by.eq.${calleeId},callee_id.eq.${user.id})`
        );

      const { data, error } = await supabase
        .from('game_sessions')
        .insert({
          conversation_id: conversationId,
          game_type: gameType,
          created_by: user.id,
          callee_id: calleeId,
          status: 'pending',
          current_turn: user.id,
          game_state: {},
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating game session:', error);
        return null;
      }

      setActiveGameSession(data as GameSession);
      return data;
    },
    [user]
  );

  const acceptGame = useCallback(async () => {
    if (!incomingGameInvite || !user) return;

    const { data, error } = await supabase
      .from('game_sessions')
      .update({ status: 'active' })
      .eq('id', incomingGameInvite.session.id)
      .select()
      .single();

    if (error) {
      console.error('Error accepting game:', error);
      return;
    }

    setActiveGameSession(data as GameSession);
    setGameMoves([]);
    setIncomingGameInvite(null);
  }, [incomingGameInvite, user]);

  const rejectGame = useCallback(async () => {
    if (!incomingGameInvite) return;

    await supabase
      .from('game_sessions')
      .update({ status: 'rejected' })
      .eq('id', incomingGameInvite.session.id);

    setIncomingGameInvite(null);
  }, [incomingGameInvite]);

  const endGame = useCallback(async () => {
    if (!activeGameSession) return;

    await supabase
      .from('game_sessions')
      .update({ status: 'ended' })
      .eq('id', activeGameSession.id);

    setActiveGameSession(null);
    setGameMoves([]);
  }, [activeGameSession]);

  const makeMove = useCallback(
    async (moveType: string, moveData: Record<string, unknown> = {}) => {
      if (!activeGameSession || !user) return null;

      const { data, error } = await supabase
        .from('game_moves')
        .insert([{
          session_id: activeGameSession.id,
          player_id: user.id,
          move_type: moveType,
          move_data: moveData as unknown as Record<string, never>,
        }])
        .select()
        .single();

      if (error) {
        console.error('Error making move:', error);
        return null;
      }

      // Game turn logic for different move types
      let nextTurn: string | null;
      
      // Get the other player based on who is making the move (user.id), not current_turn
      const getOtherPlayer = () =>
        user.id === activeGameSession.created_by
          ? activeGameSession.callee_id
          : activeGameSession.created_by;

      if (moveType === 'complete') {
        // After completing a prompt, current player gets to ask next
        nextTurn = user.id;
      } else if (moveType === 'wyr_question') {
        // When asking a WYR question, turn switches to the other player to answer
        nextTurn = getOtherPlayer();
      } else if (moveType === 'quiz_question') {
        // Love Quiz: the asker needs to set their (hidden) correct answer next,
        // so KEEP the turn with the asker after posting the question.
        nextTurn = user.id;
      } else if (moveType === 'wyr_answer') {
        // After answering WYR, keep turn with the answerer so they can click "Next Question"
        nextTurn = user.id;
      } else if (moveType === 'wyr_next') {
        // After WYR next, switch to other player so they can ask
        nextTurn = getOtherPlayer();
      } else if (moveType === 'quiz_answer') {
        // After asker sets their answer, turn switches to guesser
        nextTurn = getOtherPlayer();
      } else if (moveType === 'quiz_guess') {
        // After guessing, guesser keeps turn to click "Next Question"
        nextTurn = user.id;
      } else if (moveType === 'quiz_next') {
        // Love Quiz: the player who guessed (and clicks Next) becomes the next asker.
        // This alternates rounds: A asks -> B guesses -> B asks -> A guesses...
        nextTurn = user.id;
      } else if (moveType === 'date_pick') {
        // Dream Date Builder: after picking, turn switches to the other player
        nextTurn = getOtherPlayer();
      } else if (moveType === 'date_restart') {
        // Dream Date restart: the person who clicked restart goes first
        nextTurn = user.id;
      } else if (moveType === 'dice_roll') {
        // Dice Roll: after rolling, turn switches to the other player
        nextTurn = getOtherPlayer();
      } else {
        // Default: When picking truth/dare, turn switches to the other player to answer
        nextTurn = getOtherPlayer();
      }

      await supabase
        .from('game_sessions')
        .update({ current_turn: nextTurn })
        .eq('id', activeGameSession.id);

      return data;
    },
    [activeGameSession, user]
  );

  const clearInvite = useCallback(() => {
    setIncomingGameInvite(null);
  }, []);

  const clearSession = useCallback(() => {
    setActiveGameSession(null);
    setGameMoves([]);
  }, []);

  return {
    incomingGameInvite,
    activeGameSession,
    gameMoves,
    inviteToGame,
    acceptGame,
    rejectGame,
    endGame,
    makeMove,
    clearInvite,
    clearSession,
  };
};
