import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface CardGamePlayer {
  id: string;
  username: string;
  score: number;
  status: 'pending' | 'joined' | 'left';
}

export interface CardDraw {
  value: number; // 2-14 (14=Ace)
  suit: number;  // 0=♠, 1=♥, 2=♦, 3=♣
}

export interface CardGameState {
  players: CardGamePlayer[];
  hostId: string;
  gameStarted: boolean;
  gameEnded: boolean;
  round: number;
  currentDraws: Record<string, CardDraw>;
  startTime: string | null;
}

interface CardGameInvite {
  sessionId: string;
  gameType: string;
  conversationId: string;
  hostId: string;
  hostName: string;
}

const LOBBY_WAIT_TIME = 15000;

export const useCardGame = () => {
  const { user } = useAuth();
  const [cardGameInvite, setCardGameInvite] = useState<CardGameInvite | null>(null);
  const [cardGameState, setCardGameState] = useState<CardGameState | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [lobbyCountdown, setLobbyCountdown] = useState<number | null>(null);
  const [currentTurn, setCurrentTurn] = useState<string | null>(null);

  // Listen for card game invites
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`cardgame-invites-${user.id}-${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'game_sessions',
          filter: `game_type=eq.card-game`,
        },
        async (payload) => {
          const session = payload.new as {
            id: string;
            game_type: string;
            conversation_id: string;
            created_by: string;
            game_state: CardGameState;
            status: string;
          };

          if (session.created_by === user.id || session.status !== 'pending') return;

          const players = session.game_state?.players || [];
          const isParticipant = players.some((p: CardGamePlayer) => p.id === user.id && p.status === 'pending');

          if (isParticipant) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('username')
              .eq('id', session.created_by)
              .single();

            setCardGameInvite({
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

  // Listen for game state updates
  useEffect(() => {
    if (!activeSessionId) return;

    const channel = supabase
      .channel(`cardgame-session-${activeSessionId}-${Date.now()}`)
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
            game_state: CardGameState;
          };

          if (updated.status === 'ended') {
            setActiveSessionId(null);
            setCardGameState(null);
            setCurrentTurn(null);
            return;
          }

          setCardGameState(updated.game_state);
          setCurrentTurn(updated.current_turn);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeSessionId]);

  // Lobby countdown
  useEffect(() => {
    if (lobbyCountdown === null || lobbyCountdown <= 0) return;
    const timer = setTimeout(() => {
      setLobbyCountdown((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);
    return () => clearTimeout(timer);
  }, [lobbyCountdown]);

  // Auto-start when countdown reaches 0
  useEffect(() => {
    if (lobbyCountdown === 0 && activeSessionId && cardGameState && !cardGameState.gameStarted) {
      const joinedPlayers = cardGameState.players.filter((p) => p.status === 'joined');
      if (joinedPlayers.length >= 2 && cardGameState.hostId === user?.id) {
        startCardGame();
      }
    }
  }, [lobbyCountdown, activeSessionId, cardGameState, user?.id]);

  const createCardGameSession = useCallback(
    async (conversationId: string, participantIds: string[]) => {
      if (!user) return null;

      setActiveSessionId(null);
      setCardGameState(null);

      // End existing card-game sessions
      await supabase
        .from('game_sessions')
        .update({ status: 'ended' })
        .eq('conversation_id', conversationId)
        .eq('game_type', 'card-game')
        .in('status', ['pending', 'active']);

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username')
        .in('id', participantIds);

      const players: CardGamePlayer[] = (profiles || [])
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

      const initialState: CardGameState = {
        players,
        hostId: user.id,
        gameStarted: false,
        gameEnded: false,
        round: 1,
        currentDraws: {},
        startTime: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('game_sessions')
        .insert({
          conversation_id: conversationId,
          game_type: 'card-game',
          created_by: user.id,
          callee_id: null,
          status: 'pending',
          current_turn: null,
          game_state: initialState as unknown as Record<string, never>,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating card game session:', error);
        return null;
      }

      setActiveSessionId(data.id);
      setCardGameState(initialState);
      setLobbyCountdown(Math.ceil(LOBBY_WAIT_TIME / 1000));

      return data;
    },
    [user]
  );

  const joinCardGame = useCallback(async () => {
    if (!cardGameInvite || !user) return;

    const { data: updatedState, error } = await supabase
      .rpc('join_card_game', {
        p_session_id: cardGameInvite.sessionId,
        p_user_id: user.id,
      });

    if (error) {
      console.error('Error joining card game:', error);
      setCardGameInvite(null);
      return;
    }

    const gameState = updatedState as unknown as CardGameState;

    setActiveSessionId(cardGameInvite.sessionId);
    setCardGameState(gameState);
    setCardGameInvite(null);

    if (gameState.startTime) {
      const elapsed = Date.now() - new Date(gameState.startTime).getTime();
      const remaining = Math.max(0, Math.ceil((LOBBY_WAIT_TIME - elapsed) / 1000));
      setLobbyCountdown(remaining);
    }
  }, [cardGameInvite, user]);

  const rejectCardGame = useCallback(async () => {
    if (!cardGameInvite || !user) return;

    const { data: session } = await supabase
      .from('game_sessions')
      .select('game_state')
      .eq('id', cardGameInvite.sessionId)
      .single();

    if (session) {
      const gameState = session.game_state as unknown as CardGameState;
      const updatedPlayers = gameState.players.map((p: CardGamePlayer) =>
        p.id === user.id ? { ...p, status: 'left' as const } : p
      );

      await supabase
        .from('game_sessions')
        .update({
          game_state: { ...gameState, players: updatedPlayers } as unknown as Record<string, never>,
        })
        .eq('id', cardGameInvite.sessionId);
    }

    setCardGameInvite(null);
  }, [cardGameInvite, user]);

  const startCardGame = useCallback(async () => {
    if (!activeSessionId || !cardGameState) return;

    const { data: session } = await supabase
      .from('game_sessions')
      .select('game_state')
      .eq('id', activeSessionId)
      .single();

    if (!session) return;

    const fullState = session.game_state as unknown as CardGameState;
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
          currentDraws: {},
        } as unknown as Record<string, never>,
      })
      .eq('id', activeSessionId);

    setLobbyCountdown(null);
  }, [activeSessionId, cardGameState]);

  const drawCard = useCallback(async () => {
    if (!activeSessionId || !user) return;

    const { error } = await supabase
      .rpc('draw_card_game', {
        p_session_id: activeSessionId,
        p_user_id: user.id,
      });

    if (error) {
      console.error('Error drawing card:', error);
    }
  }, [activeSessionId, user]);

  const nextRound = useCallback(async () => {
    if (!activeSessionId || !cardGameState || !user) return;

    const { data: session } = await supabase
      .from('game_sessions')
      .select('game_state')
      .eq('id', activeSessionId)
      .single();

    if (!session) return;

    const fullState = session.game_state as unknown as CardGameState;
    const joinedPlayers = fullState.players.filter(p => p.status === 'joined');
    const firstPlayer = joinedPlayers[0]?.id || null;

    await supabase
      .from('game_sessions')
      .update({
        current_turn: firstPlayer,
        game_state: {
          ...fullState,
          round: fullState.round + 1,
          currentDraws: {},
        } as unknown as Record<string, never>,
      })
      .eq('id', activeSessionId);
  }, [activeSessionId, cardGameState, user]);

  const endCardGame = useCallback(async () => {
    if (!activeSessionId) return;

    await supabase
      .from('game_sessions')
      .update({ status: 'ended' })
      .eq('id', activeSessionId);

    setActiveSessionId(null);
    setCardGameState(null);
    setLobbyCountdown(null);
    setCurrentTurn(null);
  }, [activeSessionId]);

  const clearCardGameInvite = useCallback(() => {
    setCardGameInvite(null);
  }, []);

  return {
    cardGameInvite,
    cardGameState,
    activeSessionId,
    lobbyCountdown,
    currentTurn,
    createCardGameSession,
    joinCardGame,
    rejectCardGame,
    startCardGame,
    drawCard,
    nextRound,
    endCardGame,
    clearCardGameInvite,
  };
};
