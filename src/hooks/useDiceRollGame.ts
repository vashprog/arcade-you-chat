import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface DiceRollPlayer {
  id: string;
  username: string;
  score: number;
  status: 'pending' | 'joined' | 'left';
}

export interface DiceRollGameState {
  players: DiceRollPlayer[];
  hostId: string;
  gameStarted: boolean;
  gameEnded: boolean;
  round: number;
  currentRolls: Record<string, number>; // playerId -> dice value for current round
  startTime: string | null;
}

interface DiceRollInvite {
  sessionId: string;
  gameType: string;
  conversationId: string;
  hostId: string;
  hostName: string;
}

const LOBBY_WAIT_TIME = 15000; // 15 seconds

export const useDiceRollGame = () => {
  const { user } = useAuth();
  const [diceRollInvite, setDiceRollInvite] = useState<DiceRollInvite | null>(null);
  const [diceRollState, setDiceRollState] = useState<DiceRollGameState | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [lobbyCountdown, setLobbyCountdown] = useState<number | null>(null);
  const [currentTurn, setCurrentTurn] = useState<string | null>(null);

  // Listen for dice roll invites
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`diceroll-invites-${user.id}-${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'game_sessions',
          filter: `game_type=eq.dice-roll`,
        },
        async (payload) => {
          const session = payload.new as {
            id: string;
            game_type: string;
            conversation_id: string;
            created_by: string;
            game_state: DiceRollGameState;
            status: string;
          };

          if (session.created_by === user.id || session.status !== 'pending') return;

          const players = session.game_state?.players || [];
          const isParticipant = players.some((p: DiceRollPlayer) => p.id === user.id && p.status === 'pending');

          if (isParticipant) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('username')
              .eq('id', session.created_by)
              .single();

            setDiceRollInvite({
              sessionId: session.id,
              gameType: session.game_type,
              conversationId: session.conversation_id,
              hostId: session.created_by,
              hostName: profile?.username || 'Someone',
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Listen for game state updates when in a session
  useEffect(() => {
    if (!activeSessionId) return;

    const channel = supabase
      .channel(`diceroll-session-${activeSessionId}-${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'game_sessions',
          filter: `id=eq.${activeSessionId}`,
        },
        (payload) => {
          const updated = payload.new as {
            id: string;
            status: string;
            current_turn: string | null;
            game_state: DiceRollGameState;
          };

          if (updated.status === 'ended') {
            setActiveSessionId(null);
            setDiceRollState(null);
            setCurrentTurn(null);
            return;
          }

          setDiceRollState(updated.game_state);
          setCurrentTurn(updated.current_turn);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeSessionId]);

  // Lobby countdown effect
  useEffect(() => {
    if (lobbyCountdown === null || lobbyCountdown <= 0) return;

    const timer = setTimeout(() => {
      setLobbyCountdown((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);

    return () => clearTimeout(timer);
  }, [lobbyCountdown]);

  // Auto-start game when countdown reaches 0
  useEffect(() => {
    if (lobbyCountdown === 0 && activeSessionId && diceRollState && !diceRollState.gameStarted) {
      const joinedPlayers = diceRollState.players.filter((p) => p.status === 'joined');
      if (joinedPlayers.length >= 2 && diceRollState.hostId === user?.id) {
        startDiceRollGame();
      }
    }
  }, [lobbyCountdown, activeSessionId, diceRollState, user?.id]);

  const createDiceRollSession = useCallback(
    async (conversationId: string, participantIds: string[]) => {
      if (!user) return null;

      setActiveSessionId(null);
      setDiceRollState(null);

      // End existing dice-roll sessions
      await supabase
        .from('game_sessions')
        .update({ status: 'ended' })
        .eq('conversation_id', conversationId)
        .eq('game_type', 'dice-roll')
        .in('status', ['pending', 'active']);

      // Fetch participant profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, username')
        .in('id', participantIds);

      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
        return null;
      }

      const players: DiceRollPlayer[] = (profiles || [])
        .sort((a, b) => {
          if (a.id === user.id) return -1;
          if (b.id === user.id) return 1;
          return 0;
        })
        .map((p) => ({
          id: p.id,
          username: p.username,
          score: 0,
          status: p.id === user.id ? 'joined' : 'pending',
        }));

      if (players.length === 0) return null;

      const initialState: DiceRollGameState = {
        players,
        hostId: user.id,
        gameStarted: false,
        gameEnded: false,
        round: 1,
        currentRolls: {},
        startTime: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('game_sessions')
        .insert({
          conversation_id: conversationId,
          game_type: 'dice-roll',
          created_by: user.id,
          callee_id: null,
          status: 'pending',
          current_turn: null,
          game_state: initialState as unknown as Record<string, never>,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating dice roll session:', error);
        return null;
      }

      setActiveSessionId(data.id);
      setDiceRollState(initialState);
      setLobbyCountdown(Math.ceil(LOBBY_WAIT_TIME / 1000));

      return data;
    },
    [user]
  );

  const joinDiceRollGame = useCallback(async () => {
    if (!diceRollInvite || !user) return;

    // Use atomic DB function to avoid race conditions when multiple players join simultaneously
    const { data: updatedState, error } = await supabase
      .rpc('join_dice_roll_game', {
        p_session_id: diceRollInvite.sessionId,
        p_user_id: user.id,
      });

    if (error) {
      console.error('Error joining dice roll game:', error);
      setDiceRollInvite(null);
      return;
    }

    const gameState = updatedState as unknown as DiceRollGameState;

    setActiveSessionId(diceRollInvite.sessionId);
    setDiceRollState(gameState);
    setDiceRollInvite(null);

    if (gameState.startTime) {
      const elapsed = Date.now() - new Date(gameState.startTime).getTime();
      const remaining = Math.max(0, Math.ceil((LOBBY_WAIT_TIME - elapsed) / 1000));
      setLobbyCountdown(remaining);
    }
  }, [diceRollInvite, user]);

  const rejectDiceRollGame = useCallback(async () => {
    if (!diceRollInvite || !user) return;

    const { data: session } = await supabase
      .from('game_sessions')
      .select('game_state')
      .eq('id', diceRollInvite.sessionId)
      .single();

    if (session) {
      const gameState = session.game_state as unknown as DiceRollGameState;
      const updatedPlayers = gameState.players.map((p: DiceRollPlayer) =>
        p.id === user.id ? { ...p, status: 'left' as const } : p
      );

      await supabase
        .from('game_sessions')
        .update({
          game_state: { ...gameState, players: updatedPlayers } as unknown as Record<string, never>,
        })
        .eq('id', diceRollInvite.sessionId);
    }

    setDiceRollInvite(null);
  }, [diceRollInvite, user]);

  const startDiceRollGame = useCallback(async () => {
    if (!activeSessionId || !diceRollState) return;

    const { data: session } = await supabase
      .from('game_sessions')
      .select('game_state')
      .eq('id', activeSessionId)
      .single();

    if (!session) return;

    const fullState = session.game_state as unknown as DiceRollGameState;

    // Determine first player turn (host goes first)
    const joinedPlayers = fullState.players.filter(p => p.status === 'joined');
    const firstPlayer = joinedPlayers[0]?.id || null;

    await supabase
      .from('game_sessions')
      .update({
        status: 'active',
        current_turn: firstPlayer,
        game_state: {
          ...fullState,
          gameStarted: true,
          round: 1,
          currentRolls: {},
        } as unknown as Record<string, never>,
      })
      .eq('id', activeSessionId);

    setLobbyCountdown(null);
  }, [activeSessionId, diceRollState]);

  const rollDice = useCallback(async (value: number) => {
    if (!activeSessionId || !user) return;

    const { data, error } = await supabase
      .rpc('roll_dice_game', {
        p_session_id: activeSessionId,
        p_user_id: user.id,
        p_value: value,
      });

    if (error) {
      console.error('Error rolling dice:', error);
    }
  }, [activeSessionId, user]);

  const nextRound = useCallback(async () => {
    if (!activeSessionId || !diceRollState || !user) return;

    const { data: session } = await supabase
      .from('game_sessions')
      .select('game_state')
      .eq('id', activeSessionId)
      .single();

    if (!session) return;

    const fullState = session.game_state as unknown as DiceRollGameState;
    const joinedPlayers = fullState.players.filter(p => p.status === 'joined');
    const firstPlayer = joinedPlayers[0]?.id || null;

    await supabase
      .from('game_sessions')
      .update({
        current_turn: firstPlayer,
        game_state: {
          ...fullState,
          round: fullState.round + 1,
          currentRolls: {},
        } as unknown as Record<string, never>,
      })
      .eq('id', activeSessionId);
  }, [activeSessionId, diceRollState, user]);

  const endDiceRollGame = useCallback(async () => {
    if (!activeSessionId) return;

    await supabase
      .from('game_sessions')
      .update({ status: 'ended' })
      .eq('id', activeSessionId);

    setActiveSessionId(null);
    setDiceRollState(null);
    setLobbyCountdown(null);
    setCurrentTurn(null);
  }, [activeSessionId]);

  const clearDiceRollInvite = useCallback(() => {
    setDiceRollInvite(null);
  }, []);

  return {
    diceRollInvite,
    diceRollState,
    activeSessionId,
    lobbyCountdown,
    currentTurn,
    createDiceRollSession,
    joinDiceRollGame,
    rejectDiceRollGame,
    startDiceRollGame,
    rollDice,
    nextRound,
    endDiceRollGame,
    clearDiceRollInvite,
  };
};
