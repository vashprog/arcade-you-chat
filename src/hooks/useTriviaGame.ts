import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface TriviaPlayer {
  id: string;
  username: string;
  score: number;
  status: 'pending' | 'joined' | 'left';
}

export interface TriviaQuestion {
  question: string;
  options: string[];
  correctAnswer: string;
  category: string;
}

export interface TriviaGameState {
  players: TriviaPlayer[];
  hostId: string;
  currentQuestion: TriviaQuestion | null;
  questionIndex: number;
  totalQuestions: number;
  gameStarted: boolean;
  gameEnded: boolean;
  startTime: string | null;
  answers: Record<string, { answer: string; correct: boolean; answeredAt: string }>;
  showingResults: boolean;
}

interface TriviaInvite {
  sessionId: string;
  gameType: string;
  conversationId: string;
  hostId: string;
  hostName: string;
}

// Trivia questions pool
const triviaQuestions: TriviaQuestion[] = [
  { question: "What is the capital of France?", options: ["London", "Berlin", "Paris", "Madrid"], correctAnswer: "Paris", category: "Geography" },
  { question: "Which planet is known as the Red Planet?", options: ["Venus", "Mars", "Jupiter", "Saturn"], correctAnswer: "Mars", category: "Science" },
  { question: "Who painted the Mona Lisa?", options: ["Van Gogh", "Picasso", "Da Vinci", "Michelangelo"], correctAnswer: "Da Vinci", category: "Art" },
  { question: "What year did World War II end?", options: ["1943", "1944", "1945", "1946"], correctAnswer: "1945", category: "History" },
  { question: "What is the largest mammal in the world?", options: ["Elephant", "Blue Whale", "Giraffe", "Hippopotamus"], correctAnswer: "Blue Whale", category: "Nature" },
  { question: "Which element has the chemical symbol 'O'?", options: ["Gold", "Oxygen", "Osmium", "Oganesson"], correctAnswer: "Oxygen", category: "Science" },
  { question: "What is the smallest country in the world?", options: ["Monaco", "Vatican City", "San Marino", "Liechtenstein"], correctAnswer: "Vatican City", category: "Geography" },
  { question: "Who wrote 'Romeo and Juliet'?", options: ["Charles Dickens", "Jane Austen", "William Shakespeare", "Mark Twain"], correctAnswer: "William Shakespeare", category: "Literature" },
  { question: "What is the hardest natural substance on Earth?", options: ["Gold", "Iron", "Diamond", "Platinum"], correctAnswer: "Diamond", category: "Science" },
  { question: "Which country hosted the 2016 Summer Olympics?", options: ["China", "UK", "Brazil", "Japan"], correctAnswer: "Brazil", category: "Sports" },
  { question: "What is the largest ocean on Earth?", options: ["Atlantic", "Indian", "Arctic", "Pacific"], correctAnswer: "Pacific", category: "Geography" },
  { question: "How many continents are there?", options: ["5", "6", "7", "8"], correctAnswer: "7", category: "Geography" },
  { question: "What is the currency of Japan?", options: ["Yuan", "Won", "Yen", "Ringgit"], correctAnswer: "Yen", category: "General Knowledge" },
  { question: "Which planet has the most moons?", options: ["Jupiter", "Saturn", "Uranus", "Neptune"], correctAnswer: "Saturn", category: "Science" },
  { question: "What is the speed of light?", options: ["300,000 km/s", "150,000 km/s", "500,000 km/s", "1,000,000 km/s"], correctAnswer: "300,000 km/s", category: "Science" },
  { question: "Who discovered penicillin?", options: ["Marie Curie", "Alexander Fleming", "Louis Pasteur", "Isaac Newton"], correctAnswer: "Alexander Fleming", category: "Science" },
  { question: "What is the largest desert in the world?", options: ["Sahara", "Arabian", "Gobi", "Antarctic"], correctAnswer: "Antarctic", category: "Geography" },
  { question: "Which animal is known as the 'King of the Jungle'?", options: ["Tiger", "Lion", "Elephant", "Gorilla"], correctAnswer: "Lion", category: "Nature" },
  { question: "What is the main ingredient in guacamole?", options: ["Tomato", "Onion", "Avocado", "Pepper"], correctAnswer: "Avocado", category: "Food" },
  { question: "How many players are on a soccer team?", options: ["9", "10", "11", "12"], correctAnswer: "11", category: "Sports" },
];

const TOTAL_QUESTIONS = 10;
const LOBBY_WAIT_TIME = 15000; // 15 seconds wait for players to join

export const useTriviaGame = () => {
  const { user } = useAuth();
  const [triviaInvite, setTriviaInvite] = useState<TriviaInvite | null>(null);
  const [triviaState, setTriviaState] = useState<TriviaGameState | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [lobbyCountdown, setLobbyCountdown] = useState<number | null>(null);

  // Listen for trivia invites (sessions where user is a participant in game_state.players)
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`trivia-invites-${user.id}-${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'game_sessions',
          filter: `game_type=eq.trivia`,
        },
        async (payload) => {
          const session = payload.new as {
            id: string;
            game_type: string;
            conversation_id: string;
            created_by: string;
            game_state: TriviaGameState;
            status: string;
          };

          // Skip if this is our own game or already active
          if (session.created_by === user.id || session.status !== 'pending') return;

          // Check if we're a participant
          const players = session.game_state?.players || [];
          const isParticipant = players.some((p: TriviaPlayer) => p.id === user.id && p.status === 'pending');

          if (isParticipant) {
            // Fetch host profile
            const { data: profile } = await supabase
              .from('profiles')
              .select('username')
              .eq('id', session.created_by)
              .single();

            setTriviaInvite({
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
      .channel(`trivia-session-${activeSessionId}-${Date.now()}`)
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
            game_state: TriviaGameState;
          };

          if (updated.status === 'ended') {
            setActiveSessionId(null);
            setTriviaState(null);
            return;
          }

          setTriviaState(updated.game_state);
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
    if (lobbyCountdown === 0 && activeSessionId && triviaState && !triviaState.gameStarted) {
      // Check if we're the host and at least 2 players joined
      const joinedPlayers = triviaState.players.filter((p) => p.status === 'joined');
      if (joinedPlayers.length >= 2 && triviaState.hostId === user?.id) {
        startTriviaGame();
      }
    }
  }, [lobbyCountdown, activeSessionId, triviaState, user?.id]);

  const createTriviaSession = useCallback(
    async (conversationId: string, participantIds: string[]) => {
      if (!user) {
        console.log('Cannot create trivia session: no user');
        return null;
      }

      console.log('Creating trivia session for conversation:', conversationId, 'with participants:', participantIds);

      // Clear any existing sessions
      setActiveSessionId(null);
      setTriviaState(null);

      // End any existing trivia sessions in this conversation
      await supabase
        .from('game_sessions')
        .update({ status: 'ended' })
        .eq('conversation_id', conversationId)
        .eq('game_type', 'trivia')
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
      const players: TriviaPlayer[] = (profiles || [])
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

      if (players.length === 0) {
        console.error('No players found for trivia session');
        return null;
      }

      // Shuffle and select questions
      const shuffled = [...triviaQuestions].sort(() => Math.random() - 0.5);
      const selectedQuestions = shuffled.slice(0, TOTAL_QUESTIONS);

      const initialState: TriviaGameState = {
        players,
        hostId: user.id,
        currentQuestion: null,
        questionIndex: 0,
        totalQuestions: TOTAL_QUESTIONS,
        gameStarted: false,
        gameEnded: false,
        startTime: new Date().toISOString(),
        answers: {},
        showingResults: false,
      };

      // Store questions separately so they're not visible in game_state
      const { data, error } = await supabase
        .from('game_sessions')
        .insert({
          conversation_id: conversationId,
          game_type: 'trivia',
          created_by: user.id,
          callee_id: null, // Trivia uses game_state.players instead
          status: 'pending',
          current_turn: null,
          game_state: {
            ...initialState,
            _questions: selectedQuestions, // Hidden questions array
          } as unknown as Record<string, never>,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating trivia session:', error);
        return null;
      }

      console.log('Created trivia session:', data.id);

      setActiveSessionId(data.id);
      setTriviaState(initialState);
      setLobbyCountdown(Math.ceil(LOBBY_WAIT_TIME / 1000));

      return data;
    },
    [user]
  );

  const joinTriviaGame = useCallback(async () => {
    if (!triviaInvite || !user) return;

    // Fetch current session state
    const { data: session, error: fetchError } = await supabase
      .from('game_sessions')
      .select('*')
      .eq('id', triviaInvite.sessionId)
      .single();

    if (fetchError || !session) {
      console.error('Error fetching session:', fetchError);
      setTriviaInvite(null);
      return;
    }

    const gameState = session.game_state as unknown as TriviaGameState & { _questions?: TriviaQuestion[] };

    // Update player status to joined
    const updatedPlayers = gameState.players.map((p: TriviaPlayer) =>
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
      .eq('id', triviaInvite.sessionId);

    setActiveSessionId(triviaInvite.sessionId);
    setTriviaState({ ...gameState, players: updatedPlayers });
    setTriviaInvite(null);

    // Calculate remaining lobby time
    if (gameState.startTime) {
      const elapsed = Date.now() - new Date(gameState.startTime).getTime();
      const remaining = Math.max(0, Math.ceil((LOBBY_WAIT_TIME - elapsed) / 1000));
      setLobbyCountdown(remaining);
    }
  }, [triviaInvite, user]);

  const rejectTriviaGame = useCallback(async () => {
    if (!triviaInvite || !user) return;

    // Fetch and update player status to left
    const { data: session } = await supabase
      .from('game_sessions')
      .select('game_state')
      .eq('id', triviaInvite.sessionId)
      .single();

    if (session) {
      const gameState = session.game_state as unknown as TriviaGameState;
      const updatedPlayers = gameState.players.map((p: TriviaPlayer) =>
        p.id === user.id ? { ...p, status: 'left' as const } : p
      );

      await supabase
        .from('game_sessions')
        .update({
          game_state: { ...gameState, players: updatedPlayers } as unknown as Record<string, never>,
        })
        .eq('id', triviaInvite.sessionId);
    }

    setTriviaInvite(null);
  }, [triviaInvite, user]);

  const startTriviaGame = useCallback(async () => {
    if (!activeSessionId || !triviaState) return;

    // Fetch full session to get questions
    const { data: session } = await supabase
      .from('game_sessions')
      .select('game_state')
      .eq('id', activeSessionId)
      .single();

    if (!session) return;

    const fullState = session.game_state as unknown as TriviaGameState & { _questions?: TriviaQuestion[] };
    const questions = fullState._questions || [];

    if (questions.length === 0) return;

    const firstQuestion = questions[0];

    await supabase
      .from('game_sessions')
      .update({
        status: 'active',
        game_state: {
          ...fullState,
          gameStarted: true,
          currentQuestion: {
            question: firstQuestion.question,
            options: firstQuestion.options,
            category: firstQuestion.category,
            correctAnswer: '', // Hide correct answer from clients
          },
          questionIndex: 0,
          answers: {},
          showingResults: false,
        } as unknown as Record<string, never>,
      })
      .eq('id', activeSessionId);

    setLobbyCountdown(null);
  }, [activeSessionId, triviaState]);

  const submitAnswer = useCallback(
    async (answer: string) => {
      if (!activeSessionId || !triviaState || !user) return;

      // Fetch current state and check answer
      const { data: session } = await supabase
        .from('game_sessions')
        .select('game_state')
        .eq('id', activeSessionId)
        .single();

      if (!session) return;

      const fullState = session.game_state as unknown as TriviaGameState & { _questions?: TriviaQuestion[] };
      const questions = fullState._questions || [];
      const currentQ = questions[fullState.questionIndex];

      if (!currentQ) return;

      const isCorrect = answer === currentQ.correctAnswer;

      // Update player score and answers
      const updatedPlayers = fullState.players.map((p: TriviaPlayer) =>
        p.id === user.id && isCorrect ? { ...p, score: p.score + 1 } : p
      );

      const updatedAnswers = {
        ...fullState.answers,
        [user.id]: {
          answer,
          correct: isCorrect,
          answeredAt: new Date().toISOString(),
        },
      };

      // Check if all joined players have answered
      const joinedPlayers = fullState.players.filter((p: TriviaPlayer) => p.status === 'joined');
      const allAnswered = joinedPlayers.every((p: TriviaPlayer) => updatedAnswers[p.id]);

      await supabase
        .from('game_sessions')
        .update({
          game_state: {
            ...fullState,
            players: updatedPlayers,
            answers: updatedAnswers,
            showingResults: allAnswered,
            currentQuestion: allAnswered
              ? { ...fullState.currentQuestion, correctAnswer: currentQ.correctAnswer }
              : fullState.currentQuestion,
          } as unknown as Record<string, never>,
        })
        .eq('id', activeSessionId);
    },
    [activeSessionId, triviaState, user]
  );

  const nextQuestion = useCallback(async () => {
    if (!activeSessionId || !triviaState) return;

    const { data: session } = await supabase
      .from('game_sessions')
      .select('game_state')
      .eq('id', activeSessionId)
      .single();

    if (!session) return;

    const fullState = session.game_state as unknown as TriviaGameState & { _questions?: TriviaQuestion[] };
    const questions = fullState._questions || [];
    const nextIndex = fullState.questionIndex + 1;

    if (nextIndex >= questions.length) {
      // Game ended
      await supabase
        .from('game_sessions')
        .update({
          status: 'ended',
          game_state: {
            ...fullState,
            gameEnded: true,
            currentQuestion: null,
          } as unknown as Record<string, never>,
        })
        .eq('id', activeSessionId);

      return;
    }

    const nextQ = questions[nextIndex];

    await supabase
      .from('game_sessions')
      .update({
        game_state: {
          ...fullState,
          questionIndex: nextIndex,
          currentQuestion: {
            question: nextQ.question,
            options: nextQ.options,
            category: nextQ.category,
            correctAnswer: '',
          },
          answers: {},
          showingResults: false,
        } as unknown as Record<string, never>,
      })
      .eq('id', activeSessionId);
  }, [activeSessionId, triviaState]);

  const endTriviaGame = useCallback(async () => {
    if (!activeSessionId) return;

    await supabase
      .from('game_sessions')
      .update({ status: 'ended' })
      .eq('id', activeSessionId);

    setActiveSessionId(null);
    setTriviaState(null);
    setLobbyCountdown(null);
  }, [activeSessionId]);

  const clearTriviaInvite = useCallback(() => {
    setTriviaInvite(null);
  }, []);

  return {
    triviaInvite,
    triviaState,
    activeSessionId,
    lobbyCountdown,
    createTriviaSession,
    joinTriviaGame,
    rejectTriviaGame,
    startTriviaGame,
    submitAnswer,
    nextQuestion,
    endTriviaGame,
    clearTriviaInvite,
  };
};
