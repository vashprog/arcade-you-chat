import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface WordChainPlayer {
  id: string;
  username: string;
  status: 'pending' | 'joined' | 'left';
  wordsPlayed: number;
  lastWord: string | null;
}

export interface WordChainGameState {
  players: WordChainPlayer[];
  hostId: string;
  currentPlayerIndex: number;
  words: Array<{ word: string; playerId: string; timestamp: string }>;
  gameStarted: boolean;
  gameEnded: boolean;
  startTime: string | null;
  eliminatedPlayers: string[];
  winner: { id: string; username: string } | null;
  turnTimeLimit: number; // seconds
  turnStartedAt: string | null;
}

interface WordChainInvite {
  sessionId: string;
  gameType: string;
  conversationId: string;
  hostId: string;
  hostName: string;
}

const LOBBY_WAIT_TIME = 15000; // 15 seconds wait for players to join
const TURN_TIME_LIMIT = 30; // 30 seconds per turn

export const useWordChainGame = () => {
  const { user } = useAuth();
  const [wordChainInvite, setWordChainInvite] = useState<WordChainInvite | null>(null);
  const [wordChainState, setWordChainState] = useState<WordChainGameState | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [lobbyCountdown, setLobbyCountdown] = useState<number | null>(null);
  const [turnTimeRemaining, setTurnTimeRemaining] = useState<number | null>(null);

  // Listen for word chain invites
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`wordchain-invites-${user.id}-${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'game_sessions',
          filter: `game_type=eq.word-chain`,
        },
        async (payload) => {
          const session = payload.new as {
            id: string;
            game_type: string;
            conversation_id: string;
            created_by: string;
            game_state: WordChainGameState;
            status: string;
          };

          // Skip if this is our own game or already active
          if (session.created_by === user.id || session.status !== 'pending') return;

          // Check if we're a participant
          const players = session.game_state?.players || [];
          const isParticipant = players.some((p: WordChainPlayer) => p.id === user.id && p.status === 'pending');

          if (isParticipant) {
            // Fetch host profile
            const { data: profile } = await supabase
              .from('profiles')
              .select('username')
              .eq('id', session.created_by)
              .single();

            setWordChainInvite({
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
      .channel(`wordchain-session-${activeSessionId}-${Date.now()}`)
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
            game_state: WordChainGameState;
          };

          if (updated.status === 'ended') {
            setActiveSessionId(null);
            setWordChainState(null);
            setTurnTimeRemaining(null);
            return;
          }

          setWordChainState(updated.game_state);
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

  // Turn timer effect
  useEffect(() => {
    if (!wordChainState?.gameStarted || wordChainState?.gameEnded || !wordChainState?.turnStartedAt) {
      setTurnTimeRemaining(null);
      return;
    }

    const updateTimer = () => {
      const elapsed = Math.floor((Date.now() - new Date(wordChainState.turnStartedAt!).getTime()) / 1000);
      const remaining = Math.max(0, wordChainState.turnTimeLimit - elapsed);
      setTurnTimeRemaining(remaining);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [wordChainState?.turnStartedAt, wordChainState?.turnTimeLimit, wordChainState?.gameStarted, wordChainState?.gameEnded]);

  // Auto-start game when countdown reaches 0
  useEffect(() => {
    if (lobbyCountdown === 0 && activeSessionId && wordChainState && !wordChainState.gameStarted) {
      // Check if we're the host and at least 2 players joined
      const joinedPlayers = wordChainState.players.filter((p) => p.status === 'joined');
      if (joinedPlayers.length >= 2 && wordChainState.hostId === user?.id) {
        startWordChainGame();
      }
    }
  }, [lobbyCountdown, activeSessionId, wordChainState, user?.id]);

  const createWordChainSession = useCallback(
    async (conversationId: string, participantIds: string[]) => {
      if (!user) {
        console.log('Cannot create word chain session: no user');
        return null;
      }

      console.log('Creating word chain session for conversation:', conversationId, 'with participants:', participantIds);

      // Clear any existing sessions
      setActiveSessionId(null);
      setWordChainState(null);

      // End any existing word chain sessions in this conversation
      await supabase
        .from('game_sessions')
        .update({ status: 'ended' })
        .eq('conversation_id', conversationId)
        .eq('game_type', 'word-chain')
        .in('status', ['pending', 'active']);

      // Fetch all participant profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, username')
        .in('id', participantIds);

      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
        return null;
      }

      console.log('Fetched profiles:', profiles);

      // Build players array with creator (caller) always first
      const players: WordChainPlayer[] = (profiles || [])
        .sort((a, b) => {
          if (a.id === user.id) return -1;
          if (b.id === user.id) return 1;
          return 0;
        })
        .map((p) => ({
          id: p.id,
          username: p.username,
          status: p.id === user.id ? 'joined' : 'pending',
          wordsPlayed: 0,
          lastWord: null,
        }));

      if (players.length === 0) {
        console.error('No players found for word chain session');
        return null;
      }

      const initialState: WordChainGameState = {
        players,
        hostId: user.id,
        currentPlayerIndex: 0,
        words: [],
        gameStarted: false,
        gameEnded: false,
        startTime: new Date().toISOString(),
        eliminatedPlayers: [],
        winner: null,
        turnTimeLimit: TURN_TIME_LIMIT,
        turnStartedAt: null,
      };

      const { data, error } = await supabase
        .from('game_sessions')
        .insert({
          conversation_id: conversationId,
          game_type: 'word-chain',
          created_by: user.id,
          callee_id: null,
          status: 'pending',
          current_turn: null,
          game_state: initialState as unknown as Record<string, never>,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating word chain session:', error);
        return null;
      }

      console.log('Created word chain session:', data.id);

      setActiveSessionId(data.id);
      setWordChainState(initialState);
      setLobbyCountdown(Math.ceil(LOBBY_WAIT_TIME / 1000));

      return data;
    },
    [user]
  );

  const joinWordChainGame = useCallback(async () => {
    if (!wordChainInvite || !user) return;

    // Fetch current session state
    const { data: session, error: fetchError } = await supabase
      .from('game_sessions')
      .select('*')
      .eq('id', wordChainInvite.sessionId)
      .single();

    if (fetchError || !session) {
      console.error('Error fetching session:', fetchError);
      setWordChainInvite(null);
      return;
    }

    const gameState = session.game_state as unknown as WordChainGameState;

    // Update player status to joined
    const updatedPlayers = gameState.players.map((p: WordChainPlayer) =>
      p.id === user.id ? { ...p, status: 'joined' as const } : p
    );

    await supabase
      .from('game_sessions')
      .update({
        game_state: {
          ...gameState,
          players: updatedPlayers,
        } as unknown as Record<string, never>,
      })
      .eq('id', wordChainInvite.sessionId);

    setActiveSessionId(wordChainInvite.sessionId);
    setWordChainState({ ...gameState, players: updatedPlayers });
    setWordChainInvite(null);

    // Calculate remaining lobby time
    if (gameState.startTime) {
      const elapsed = Date.now() - new Date(gameState.startTime).getTime();
      const remaining = Math.max(0, Math.ceil((LOBBY_WAIT_TIME - elapsed) / 1000));
      setLobbyCountdown(remaining);
    }
  }, [wordChainInvite, user]);

  const rejectWordChainGame = useCallback(async () => {
    if (!wordChainInvite || !user) return;

    // Fetch and update player status to left
    const { data: session } = await supabase
      .from('game_sessions')
      .select('game_state')
      .eq('id', wordChainInvite.sessionId)
      .single();

    if (session) {
      const gameState = session.game_state as unknown as WordChainGameState;
      const updatedPlayers = gameState.players.map((p: WordChainPlayer) =>
        p.id === user.id ? { ...p, status: 'left' as const } : p
      );

      await supabase
        .from('game_sessions')
        .update({
          game_state: { ...gameState, players: updatedPlayers } as unknown as Record<string, never>,
        })
        .eq('id', wordChainInvite.sessionId);
    }

    setWordChainInvite(null);
  }, [wordChainInvite, user]);

  const startWordChainGame = useCallback(async () => {
    if (!activeSessionId || !wordChainState) return;

    // Only joined players participate
    const activePlayers = wordChainState.players.filter((p) => p.status === 'joined');
    
    if (activePlayers.length < 2) {
      console.log('Not enough players to start');
      return;
    }

    // Shuffle players for random turn order
    const shuffledPlayers = [...activePlayers].sort(() => Math.random() - 0.5);

    await supabase
      .from('game_sessions')
      .update({
        status: 'active',
        game_state: {
          ...wordChainState,
          players: shuffledPlayers,
          gameStarted: true,
          currentPlayerIndex: 0,
          turnStartedAt: new Date().toISOString(),
        } as unknown as Record<string, never>,
      })
      .eq('id', activeSessionId);

    setLobbyCountdown(null);
  }, [activeSessionId, wordChainState]);

  const submitWord = useCallback(
    async (word: string) => {
      if (!activeSessionId || !wordChainState || !user) return { success: false, error: 'Not in game' };

      // Fetch current state
      const { data: session } = await supabase
        .from('game_sessions')
        .select('game_state')
        .eq('id', activeSessionId)
        .single();

      if (!session) return { success: false, error: 'Session not found' };

      const gameState = session.game_state as unknown as WordChainGameState;
      
      // Validate it's the player's turn
      const currentPlayer = gameState.players[gameState.currentPlayerIndex];
      if (currentPlayer?.id !== user.id) {
        return { success: false, error: "Not your turn" };
      }

      const normalizedWord = word.toLowerCase().trim();

      // Validate word not already used
      if (gameState.words.some((w) => w.word.toLowerCase() === normalizedWord)) {
        return { success: false, error: 'Word already used' };
      }

      // Validate word starts with correct letter (if not first word)
      if (gameState.words.length > 0) {
        const lastWord = gameState.words[gameState.words.length - 1].word.toLowerCase();
        const requiredLetter = lastWord[lastWord.length - 1];
        if (normalizedWord[0] !== requiredLetter) {
          return { success: false, error: `Word must start with "${requiredLetter.toUpperCase()}"` };
        }
      }

      // Validate minimum length
      if (normalizedWord.length < 2) {
        return { success: false, error: 'Word must be at least 2 letters' };
      }

      // Add word and advance to next player
      const newWords = [
        ...gameState.words,
        { word: normalizedWord, playerId: user.id, timestamp: new Date().toISOString() },
      ];

      const updatedPlayers = gameState.players.map((p) =>
        p.id === user.id
          ? { ...p, wordsPlayed: p.wordsPlayed + 1, lastWord: normalizedWord }
          : p
      );

      // Get next active player (skip eliminated)
      let nextIndex = (gameState.currentPlayerIndex + 1) % gameState.players.length;
      let attempts = 0;
      while (
        gameState.eliminatedPlayers.includes(gameState.players[nextIndex].id) &&
        attempts < gameState.players.length
      ) {
        nextIndex = (nextIndex + 1) % gameState.players.length;
        attempts++;
      }

      await supabase
        .from('game_sessions')
        .update({
          game_state: {
            ...gameState,
            players: updatedPlayers,
            words: newWords,
            currentPlayerIndex: nextIndex,
            turnStartedAt: new Date().toISOString(),
          } as unknown as Record<string, never>,
        })
        .eq('id', activeSessionId);

      return { success: true };
    },
    [activeSessionId, wordChainState, user]
  );

  const eliminatePlayer = useCallback(
    async (playerId: string, reason: string) => {
      if (!activeSessionId || !wordChainState) return;

      const { data: session } = await supabase
        .from('game_sessions')
        .select('game_state')
        .eq('id', activeSessionId)
        .single();

      if (!session) return;

      const gameState = session.game_state as unknown as WordChainGameState;
      const newEliminated = [...gameState.eliminatedPlayers, playerId];
      
      // Check remaining players
      const remainingPlayers = gameState.players.filter(
        (p) => p.status === 'joined' && !newEliminated.includes(p.id)
      );

      if (remainingPlayers.length <= 1) {
        // Game over - we have a winner
        const winner = remainingPlayers[0] || null;
        
        await supabase
          .from('game_sessions')
          .update({
            status: 'ended',
            game_state: {
              ...gameState,
              eliminatedPlayers: newEliminated,
              gameEnded: true,
              winner: winner ? { id: winner.id, username: winner.username } : null,
            } as unknown as Record<string, never>,
          })
          .eq('id', activeSessionId);
      } else {
        // Continue game with next player
        let nextIndex = gameState.currentPlayerIndex;
        if (gameState.players[nextIndex]?.id === playerId) {
          // Current player was eliminated, move to next
          nextIndex = (nextIndex + 1) % gameState.players.length;
          while (newEliminated.includes(gameState.players[nextIndex].id)) {
            nextIndex = (nextIndex + 1) % gameState.players.length;
          }
        }

        await supabase
          .from('game_sessions')
          .update({
            game_state: {
              ...gameState,
              eliminatedPlayers: newEliminated,
              currentPlayerIndex: nextIndex,
              turnStartedAt: new Date().toISOString(),
            } as unknown as Record<string, never>,
          })
          .eq('id', activeSessionId);
      }
    },
    [activeSessionId, wordChainState]
  );

  const skipTurn = useCallback(async () => {
    if (!activeSessionId || !wordChainState || !user) return;

    const currentPlayer = wordChainState.players[wordChainState.currentPlayerIndex];
    if (currentPlayer?.id !== user.id) return;

    // Skipping eliminates the player
    await eliminatePlayer(user.id, 'skipped');
  }, [activeSessionId, wordChainState, user, eliminatePlayer]);

  const endWordChainGame = useCallback(async () => {
    if (!activeSessionId) return;

    await supabase
      .from('game_sessions')
      .update({ status: 'ended' })
      .eq('id', activeSessionId);

    setActiveSessionId(null);
    setWordChainState(null);
    setLobbyCountdown(null);
    setTurnTimeRemaining(null);
  }, [activeSessionId]);

  const clearWordChainInvite = useCallback(() => {
    setWordChainInvite(null);
  }, []);

  return {
    wordChainInvite,
    wordChainState,
    activeSessionId,
    lobbyCountdown,
    turnTimeRemaining,
    createWordChainSession,
    joinWordChainGame,
    rejectWordChainGame,
    startWordChainGame,
    submitWord,
    skipTurn,
    eliminatePlayer,
    endWordChainGame,
    clearWordChainInvite,
  };
};
