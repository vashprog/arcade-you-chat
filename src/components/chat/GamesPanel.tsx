import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  X,
  Heart,
  Users,
  Sparkles,
  Zap,
  MessageSquare,
  Gamepad2,
  Loader2,
  Check,
  ChevronDown,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Conversation } from '@/pages/Chat';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useMobileLayout } from '@/hooks/useMobileLayout';
import TriviaGame from './TriviaGame';
import WordChainGame from './WordChainGame';
import DiceRollGame from './DiceRollGame';
import CardGame from './CardGame';
import type { TriviaGameState } from '@/hooks/useTriviaGame';
import type { WordChainGameState } from '@/hooks/useWordChainGame';
import type { DiceRollGameState } from '@/hooks/useDiceRollGame';
import type { CardGameState } from '@/hooks/useCardGame';

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

interface GamesPanelProps {
  isOpen: boolean;
  onClose: () => void;
  conversation: Conversation | null;
  activeGameSession: GameSession | null;
  gameMoves: GameMove[];
  onInviteToGame: (conversationId: string, gameType: string, calleeId: string) => Promise<unknown>;
  onMakeMove: (moveType: string, moveData?: Record<string, unknown>) => Promise<unknown>;
  onEndGame: () => Promise<void>;
  // Trivia-specific props
  triviaState?: TriviaGameState | null;
  triviaLobbyCountdown?: number | null;
  onCreateTriviaSession?: (conversationId: string, participantIds: string[]) => Promise<unknown>;
  onSubmitTriviaAnswer?: (answer: string) => Promise<void>;
  onNextTriviaQuestion?: () => Promise<void>;
  onEndTriviaGame?: () => Promise<void>;
  onStartTriviaGame?: () => Promise<void>;
  triviaSessionId?: string | null;
  // Word Chain props
  wordChainState?: WordChainGameState | null;
  wordChainLobbyCountdown?: number | null;
  wordChainTurnTimeRemaining?: number | null;
  wordChainSessionId?: string | null;
  onCreateWordChainSession?: (conversationId: string, participantIds: string[]) => Promise<unknown>;
  onSubmitWordChainWord?: (word: string) => Promise<{ success: boolean; error?: string }>;
  onSkipWordChainTurn?: () => Promise<void>;
  onEndWordChainGame?: () => Promise<void>;
  onStartWordChainGame?: () => Promise<void>;
  // Dice Roll props
  diceRollState?: DiceRollGameState | null;
  diceRollLobbyCountdown?: number | null;
  diceRollSessionId?: string | null;
  diceRollCurrentTurn?: string | null;
  onCreateDiceRollSession?: (conversationId: string, participantIds: string[]) => Promise<unknown>;
  onRollDice?: (value: number) => Promise<void>;
  onNextDiceRollRound?: () => Promise<void>;
  onEndDiceRollGame?: () => Promise<void>;
  onStartDiceRollGame?: () => Promise<void>;
  // Card Game props
  cardGameState?: CardGameState | null;
  cardGameLobbyCountdown?: number | null;
  cardGameSessionId?: string | null;
  cardGameCurrentTurn?: string | null;
  onCreateCardGameSession?: (conversationId: string, participantIds: string[]) => Promise<unknown>;
  onDrawCard?: () => Promise<void>;
  onNextCardGameRound?: () => Promise<void>;
  onEndCardGame?: () => Promise<void>;
  onStartCardGame?: () => Promise<void>;
}

// Filter categories for groups (exclude couple games)
const getGameCategories = (isGroup: boolean) => {
  if (isGroup) {
    return gameCategories.filter(cat => cat.id !== 'couple');
  }
  return gameCategories;
};

const gameCategories = [
  {
    id: 'couple',
    title: 'Couple Games',
    icon: Heart,
    color: 'from-secondary to-secondary/60',
    textColor: 'text-secondary',
    games: [
      { id: 'truth-or-dare', name: 'Truth or Dare', emoji: '🎯', description: 'Spicy questions & fun dares' },
      { id: 'would-you-rather', name: 'Would You Rather', emoji: '🤔', description: 'Make impossible choices' },
      { id: 'love-quiz', name: 'Love Quiz', emoji: '💕', description: 'Test how well you know each other' },
      { id: 'dream-date', name: 'Dream Date Builder', emoji: '✨', description: 'Plan the perfect date together' },
    ],
  },
  {
    id: 'friends',
    title: 'Friends Games',
    icon: Users,
    color: 'from-neon-green to-neon-green/60',
    textColor: 'text-neon-green',
    games: [
      { id: 'trivia', name: 'Trivia Challenge', emoji: '🧠', description: 'Test your knowledge' },
      { id: 'word-chain', name: 'Word Chain', emoji: '🔗', description: 'Keep the chain going' },
      { id: 'dice-roll', name: 'Dice Roll', emoji: '🎲', description: 'Roll & compete for the highest' },
      { id: 'card-game', name: 'Card Game', emoji: '🃏', description: 'Draw high card to win' },
    ],
  },
];



// Truth or Dare content
const truthQuestions = [
  "What's your biggest fear?",
  "What's the most embarrassing thing you've done?",
  "What's a secret you've never told anyone?",
  "Who was your first crush?",
  "What's the worst lie you've ever told?",
  "What's your guilty pleasure?",
  "What's something you've never told me?",
  "What's your biggest regret?",
];

const darePrompts = [
  "Send a funny selfie right now",
  "Do 10 jumping jacks on video",
  "Speak in an accent for the next 2 minutes",
  "Share the last photo in your camera roll",
  "Make up a short song about the other person",
  "Do your best dance move",
  "Tell a joke",
  "Give the other person 3 genuine compliments",
];

// Would You Rather questions
const wouldYouRatherQuestions = [
  { optionA: "Be able to fly", optionB: "Be able to read minds" },
  { optionA: "Live without music", optionB: "Live without movies" },
  { optionA: "Be famous", optionB: "Be rich" },
  { optionA: "Travel to the past", optionB: "Travel to the future" },
  { optionA: "Always be too hot", optionB: "Always be too cold" },
  { optionA: "Have unlimited money", optionB: "Have unlimited love" },
  { optionA: "Never use social media again", optionB: "Never watch TV again" },
  { optionA: "Be a famous actor", optionB: "Be a famous musician" },
  { optionA: "Live in a treehouse", optionB: "Live in a cave" },
  { optionA: "Have a pause button for life", optionB: "Have a rewind button" },
  { optionA: "Always speak your mind", optionB: "Never speak again" },
  { optionA: "Be invisible", optionB: "Be able to teleport" },
  { optionA: "Know how you will die", optionB: "Know when you will die" },
  { optionA: "Relive the same day forever", optionB: "Never be able to sleep" },
  { optionA: "Have more time", optionB: "Have more money" },
  { optionA: "Live in the city", optionB: "Live in the countryside" },
];

// Love Quiz questions - questions about the person asking
const loveQuizQuestions = [
  { question: "What's my favorite color?", options: ["Red", "Blue", "Green", "Purple"] },
  { question: "What's my favorite food?", options: ["Pizza", "Sushi", "Pasta", "Burgers"] },
  { question: "What's my biggest fear?", options: ["Spiders", "Heights", "Public Speaking", "The Dark"] },
  { question: "What's my dream vacation?", options: ["Beach Resort", "Mountain Adventure", "City Tour", "Safari"] },
  { question: "What's my love language?", options: ["Words of Affirmation", "Quality Time", "Physical Touch", "Gifts"] },
  { question: "What time do I usually wake up?", options: ["Before 7am", "7-9am", "9-11am", "After 11am"] },
  { question: "What's my favorite movie genre?", options: ["Comedy", "Romance", "Action", "Horror"] },
  { question: "What's my go-to comfort food?", options: ["Ice Cream", "Chocolate", "Pizza", "Chips"] },
  { question: "What do I value most in a relationship?", options: ["Trust", "Communication", "Fun", "Support"] },
  { question: "What's my hidden talent?", options: ["Singing", "Dancing", "Cooking", "Drawing"] },
  { question: "What's my favorite season?", options: ["Spring", "Summer", "Fall", "Winter"] },
  { question: "What makes me happiest?", options: ["Spending time together", "Achieving goals", "Helping others", "Adventures"] },
  { question: "What's my favorite way to relax?", options: ["Watching TV", "Reading", "Gaming", "Sleeping"] },
  { question: "What's my favorite music genre?", options: ["Pop", "Rock", "Hip-Hop", "R&B"] },
  { question: "What's my biggest pet peeve?", options: ["Being late", "Loud chewing", "Dishonesty", "Messiness"] },
  { question: "What's my favorite drink?", options: ["Coffee", "Tea", "Soda", "Juice"] },
];

// Dream Date Builder categories and options
const dreamDateCategories = [
  {
    id: 'activity',
    name: 'Activity',
    emoji: '🎯',
    question: 'What should we do?',
    options: [
      { id: 'movie', label: 'Watch a Movie', emoji: '🎬' },
      { id: 'hiking', label: 'Go Hiking', emoji: '🥾' },
      { id: 'cooking', label: 'Cook Together', emoji: '👨‍🍳' },
      { id: 'dancing', label: 'Go Dancing', emoji: '💃' },
      { id: 'stargazing', label: 'Stargazing', emoji: '⭐' },
      { id: 'museum', label: 'Visit a Museum', emoji: '🏛️' },
    ],
  },
  {
    id: 'food',
    name: 'Food',
    emoji: '🍽️',
    question: 'What should we eat?',
    options: [
      { id: 'italian', label: 'Italian', emoji: '🍝' },
      { id: 'sushi', label: 'Sushi', emoji: '🍣' },
      { id: 'mexican', label: 'Mexican', emoji: '🌮' },
      { id: 'dessert', label: 'Just Desserts', emoji: '🍰' },
      { id: 'picnic', label: 'Picnic Food', emoji: '🧺' },
      { id: 'homemade', label: 'Home Cooked', emoji: '🏠' },
    ],
  },
  {
    id: 'location',
    name: 'Location',
    emoji: '📍',
    question: 'Where should we go?',
    options: [
      { id: 'beach', label: 'Beach', emoji: '🏖️' },
      { id: 'city', label: 'Downtown City', emoji: '🌃' },
      { id: 'park', label: 'Park', emoji: '🌳' },
      { id: 'home', label: 'Stay Home', emoji: '🏡' },
      { id: 'rooftop', label: 'Rooftop', emoji: '🌆' },
      { id: 'countryside', label: 'Countryside', emoji: '🌾' },
    ],
  },
  {
    id: 'time',
    name: 'Time',
    emoji: '🕐',
    question: 'When should it be?',
    options: [
      { id: 'morning', label: 'Morning', emoji: '🌅' },
      { id: 'afternoon', label: 'Afternoon', emoji: '☀️' },
      { id: 'sunset', label: 'Sunset', emoji: '🌇' },
      { id: 'evening', label: 'Evening', emoji: '🌙' },
      { id: 'late-night', label: 'Late Night', emoji: '🌌' },
      { id: 'all-day', label: 'All Day Long', emoji: '📅' },
    ],
  },
  {
    id: 'vibe',
    name: 'Vibe',
    emoji: '✨',
    question: 'What\'s the mood?',
    options: [
      { id: 'romantic', label: 'Romantic', emoji: '💕' },
      { id: 'adventurous', label: 'Adventurous', emoji: '🎢' },
      { id: 'chill', label: 'Chill & Relaxed', emoji: '😌' },
      { id: 'fun', label: 'Fun & Playful', emoji: '🎉' },
      { id: 'cozy', label: 'Cozy & Intimate', emoji: '🕯️' },
      { id: 'spontaneous', label: 'Spontaneous', emoji: '🎲' },
    ],
  },
];

const GamesPanel = ({
  isOpen,
  onClose,
  conversation,
  activeGameSession,
  gameMoves,
  onInviteToGame,
  onMakeMove,
  onEndGame,
  // Trivia props
  triviaState,
  triviaLobbyCountdown,
  onCreateTriviaSession,
  onSubmitTriviaAnswer,
  onNextTriviaQuestion,
  onEndTriviaGame,
  onStartTriviaGame,
  triviaSessionId,
  // Word Chain props
  wordChainState,
  wordChainLobbyCountdown,
  wordChainTurnTimeRemaining,
  wordChainSessionId,
  onCreateWordChainSession,
  onSubmitWordChainWord,
  onSkipWordChainTurn,
  onEndWordChainGame,
  onStartWordChainGame,
  // Dice Roll props
  diceRollState,
  diceRollLobbyCountdown,
  diceRollSessionId,
  diceRollCurrentTurn,
  onCreateDiceRollSession,
  onRollDice,
  onNextDiceRollRound,
  onEndDiceRollGame,
  onStartDiceRollGame,
  // Card Game props
  cardGameState,
  cardGameLobbyCountdown,
  cardGameSessionId,
  cardGameCurrentTurn,
  onCreateCardGameSession,
  onDrawCard,
  onNextCardGameRound,
  onEndCardGame,
  onStartCardGame,
}: GamesPanelProps) => {
  const { user } = useAuth();
  const { isMobile } = useMobileLayout();
  const [activeCategory, setActiveCategory] = useState('friends');
  const [activeGame, setActiveGame] = useState<string | null>(null);
  const [isWaiting, setIsWaiting] = useState(false);
  const [isTriviaLoading, setIsTriviaLoading] = useState(false);
  const [isWordChainLoading, setIsWordChainLoading] = useState(false);
  const [isDiceRollLoading, setIsDiceRollLoading] = useState(false);
  const [isCardGameLoading, setIsCardGameLoading] = useState(false);
  const [otherParticipantId, setOtherParticipantId] = useState<string | null>(null);
  const [currentPrompt, setCurrentPrompt] = useState<{ type: 'truth' | 'dare'; content: string } | null>(null);
  const [opponentName, setOpponentName] = useState<string>('Opponent');
  const [wyrQuestion, setWyrQuestion] = useState<{ optionA: string; optionB: string } | null>(null);
  const [wyrAnswer, setWyrAnswer] = useState<{ choice: string; chooser: string } | null>(null);
  
  // Love Quiz state
  const [loveQuizState, setLoveQuizState] = useState<{
    question: string;
    options: string[];
    correctAnswer: string | null; // null means waiting for asker to set answer
    askedBy: string;
  } | null>(null);
  const [loveQuizResult, setLoveQuizResult] = useState<{
    guessedAnswer: string;
    correctAnswer: string;
    isCorrect: boolean;
    guesser: string;
  } | null>(null);
  const [loveQuizScore, setLoveQuizScore] = useState<{ me: number; them: number }>({ me: 0, them: 0 });

  // Dream Date Builder state
  const [dreamDateState, setDreamDateState] = useState<{
    currentCategoryIndex: number;
    selections: Record<string, { option: string; emoji: string; chooser: string }>;
    isComplete: boolean;
  }>({
    currentCategoryIndex: 0,
    selections: {},
    isComplete: false,
  });

  // Fetch other participant when conversation changes
  useEffect(() => {
    const fetchOtherParticipant = async () => {
      if (!conversation || !user) return;

      const { data } = await supabase
        .from('conversation_participants')
        .select('user_id')
        .eq('conversation_id', conversation.id)
        .neq('user_id', user.id)
        .single();

      if (data) {
        setOtherParticipantId(data.user_id);
        
        // Fetch opponent's name
        const { data: profile } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', data.user_id)
          .single();
          
        if (profile) {
          setOpponentName(profile.username);
        }
      }
    };

    fetchOtherParticipant();
  }, [conversation, user]);

  // Sync game state with activeGameSession (for games driven by useGameSignaling)
  useEffect(() => {
    if (activeGameSession && (activeGameSession.status === 'active' || activeGameSession.status === 'pending')) {
      setActiveGame(activeGameSession.game_type);
      setIsWaiting(activeGameSession.status === 'pending');
      return;
    }

    // Trivia + Word Chain + Dice Roll manage their own session/state via dedicated hooks,
    // so we must NOT auto-clear the panel just because activeGameSession is null.
    if (activeGame === 'trivia' || activeGame === 'word-chain' || activeGame === 'dice-roll' || activeGame === 'card-game') {
      return;
    }

    // Clear game state when session ends or doesn't exist
    setActiveGame(null);
    setIsWaiting(false);
    setCurrentPrompt(null);
    setWyrQuestion(null);
    setWyrAnswer(null);
    setLoveQuizState(null);
    setLoveQuizResult(null);
    setLoveQuizScore({ me: 0, them: 0 });
    setDreamDateState({ currentCategoryIndex: 0, selections: {}, isComplete: false });
  }, [activeGameSession, activeGame]);

  // Sync trivia session with activeGame state - critical for receiver joining
  useEffect(() => {
    if (triviaSessionId && triviaState) {
      setActiveGame('trivia');
      setIsTriviaLoading(false);
    }
  }, [triviaSessionId, triviaState]);

  // Sync word chain session with activeGame state - critical for receiver joining
  useEffect(() => {
    if (wordChainSessionId && wordChainState) {
      setActiveGame('word-chain');
      setIsWordChainLoading(false);
    }
  }, [wordChainSessionId, wordChainState]);

  // Sync dice roll session with activeGame state - critical for receiver joining
  useEffect(() => {
    if (diceRollSessionId && diceRollState) {
      setActiveGame('dice-roll');
      setIsDiceRollLoading(false);
    }
  }, [diceRollSessionId, diceRollState]);

  // Sync card game session with activeGame state
  useEffect(() => {
    if (cardGameSessionId && cardGameState) {
      setActiveGame('card-game');
      setIsCardGameLoading(false);
    }
  }, [cardGameSessionId, cardGameState]);

  // Process game moves for Truth or Dare, Would You Rather, and Love Quiz
  useEffect(() => {
    if (gameMoves.length > 0) {
      const lastMove = gameMoves[gameMoves.length - 1];
      
      // Truth or Dare moves
      if (lastMove.move_type === 'truth' || lastMove.move_type === 'dare') {
        setCurrentPrompt({
          type: lastMove.move_type as 'truth' | 'dare',
          content: (lastMove.move_data as { content?: string })?.content || '',
        });
      } else if (lastMove.move_type === 'complete') {
        setCurrentPrompt(null);
      }
      
      // Would You Rather moves
      if (lastMove.move_type === 'wyr_question') {
        const data = lastMove.move_data as { optionA?: string; optionB?: string };
        setWyrQuestion({ optionA: data.optionA || '', optionB: data.optionB || '' });
        setWyrAnswer(null);
      } else if (lastMove.move_type === 'wyr_answer') {
        const data = lastMove.move_data as { choice?: string };
        setWyrAnswer({ choice: data.choice || '', chooser: lastMove.player_id });
      } else if (lastMove.move_type === 'wyr_next') {
        setWyrQuestion(null);
        setWyrAnswer(null);
      }
      
      // Love Quiz moves
      if (lastMove.move_type === 'quiz_question') {
        const data = lastMove.move_data as { question?: string; options?: string[] };
        setLoveQuizState({
          question: data.question || '',
          options: data.options || [],
          correctAnswer: null,
          askedBy: lastMove.player_id,
        });
        setLoveQuizResult(null);
      } else if (lastMove.move_type === 'quiz_answer') {
        const data = lastMove.move_data as { correctAnswer?: string };
        setLoveQuizState(prev => prev ? { ...prev, correctAnswer: data.correctAnswer || '' } : null);
      } else if (lastMove.move_type === 'quiz_guess') {
        const data = lastMove.move_data as { guess?: string; correctAnswer?: string };
        const isCorrect = data.guess === data.correctAnswer;
        setLoveQuizResult({
          guessedAnswer: data.guess || '',
          correctAnswer: data.correctAnswer || '',
          isCorrect,
          guesser: lastMove.player_id,
        });
        // Update scores
        if (isCorrect) {
          setLoveQuizScore(prev => ({
            me: lastMove.player_id === user?.id ? prev.me + 1 : prev.me,
            them: lastMove.player_id !== user?.id ? prev.them + 1 : prev.them,
          }));
        }
      } else if (lastMove.move_type === 'quiz_next') {
        setLoveQuizState(null);
        setLoveQuizResult(null);
      }

      // Dream Date Builder moves
      if (lastMove.move_type === 'date_pick') {
        const data = lastMove.move_data as { 
          categoryId?: string; 
          optionId?: string; 
          optionLabel?: string;
          optionEmoji?: string;
        };
        if (data.categoryId && data.optionId) {
          setDreamDateState(prev => ({
            ...prev,
            currentCategoryIndex: prev.currentCategoryIndex + 1,
            selections: {
              ...prev.selections,
              [data.categoryId!]: {
                option: data.optionLabel || data.optionId!,
                emoji: data.optionEmoji || '✨',
                chooser: lastMove.player_id,
              },
            },
            isComplete: prev.currentCategoryIndex + 1 >= dreamDateCategories.length,
          }));
        }
      } else if (lastMove.move_type === 'date_restart') {
        setDreamDateState({ currentCategoryIndex: 0, selections: {}, isComplete: false });
      }
    }
  }, [gameMoves, user?.id]);

  if (!isOpen) return null;

  const handlePlayGame = async (gameId: string) => {
    if (!conversation) return;

    // If there's an existing game session (active or pending), end it first so invites always work instantly
    if (activeGameSession && (activeGameSession.status === 'active' || activeGameSession.status === 'pending')) {
      await onEndGame();
    }

    // For trivia - use the trivia system which handles multi-player
    if (gameId === 'trivia') {
      setActiveGame(gameId);
      setIsTriviaLoading(true);
      if (onCreateTriviaSession) {
        try {
          // Fetch all participants in this conversation
          const { data: participants } = await supabase
            .from('conversation_participants')
            .select('user_id')
            .eq('conversation_id', conversation.id);
          
          const participantIds = (participants || []).map(p => p.user_id).filter(Boolean) as string[];
          await onCreateTriviaSession(conversation.id, participantIds);
        } catch (err) {
          console.error('Error creating trivia session:', err);
        } finally {
          setIsTriviaLoading(false);
        }
      } else {
        setIsTriviaLoading(false);
      }
      return;
    }

    // For word-chain - use the word chain system which handles multi-player
    if (gameId === 'word-chain') {
      setActiveGame(gameId);
      setIsWordChainLoading(true);
      if (onCreateWordChainSession) {
        try {
          // Fetch all participants in this conversation
          const { data: participants } = await supabase
            .from('conversation_participants')
            .select('user_id')
            .eq('conversation_id', conversation.id);
          
          const participantIds = (participants || []).map(p => p.user_id).filter(Boolean) as string[];
          await onCreateWordChainSession(conversation.id, participantIds);
        } catch (err) {
          console.error('Error creating word chain session:', err);
        } finally {
          setIsWordChainLoading(false);
        }
      } else {
        setIsWordChainLoading(false);
      }
      return;
    }

    // For dice-roll - use the dice roll system which handles multi-player
    if (gameId === 'dice-roll') {
      setActiveGame(gameId);
      setIsDiceRollLoading(true);
      if (onCreateDiceRollSession) {
        try {
          const { data: participants } = await supabase
            .from('conversation_participants')
            .select('user_id')
            .eq('conversation_id', conversation.id);
          
          const participantIds = (participants || []).map(p => p.user_id).filter(Boolean) as string[];
          await onCreateDiceRollSession(conversation.id, participantIds);
        } catch (err) {
          console.error('Error creating dice roll session:', err);
        } finally {
          setIsDiceRollLoading(false);
        }
      } else {
        setIsDiceRollLoading(false);
      }
      return;
    }

    // For card-game - use the card game system which handles multi-player
    if (gameId === 'card-game') {
      setActiveGame(gameId);
      setIsCardGameLoading(true);
      if (onCreateCardGameSession) {
        try {
          const { data: participants } = await supabase
            .from('conversation_participants')
            .select('user_id')
            .eq('conversation_id', conversation.id);
          
          const participantIds = (participants || []).map(p => p.user_id).filter(Boolean) as string[];
          await onCreateCardGameSession(conversation.id, participantIds);
        } catch (err) {
          console.error('Error creating card game session:', err);
        } finally {
          setIsCardGameLoading(false);
        }
      } else {
        setIsCardGameLoading(false);
      }
      return;
    }

    // For other multiplayer games, need a specific opponent
    if (!otherParticipantId) return;

    // For multiplayer games, send invitation
    setIsWaiting(true);
    setActiveGame(gameId);
    await onInviteToGame(conversation.id, gameId, otherParticipantId);
  };



  const handleTruthOrDare = async (choice: 'truth' | 'dare') => {
    const content = choice === 'truth'
      ? truthQuestions[Math.floor(Math.random() * truthQuestions.length)]
      : darePrompts[Math.floor(Math.random() * darePrompts.length)];

    await onMakeMove(choice, { content });
  };

  const handleCompletePrompt = async () => {
    await onMakeMove('complete', {});
  };

  // Would You Rather handlers
  const handleAskWouldYouRather = async () => {
    const question = wouldYouRatherQuestions[Math.floor(Math.random() * wouldYouRatherQuestions.length)];
    await onMakeMove('wyr_question', { optionA: question.optionA, optionB: question.optionB });
  };

  const handleWyrAnswer = async (choice: string) => {
    await onMakeMove('wyr_answer', { choice });
  };

  const handleWyrNext = async () => {
    await onMakeMove('wyr_next', {});
  };

  // Love Quiz handlers
  const handleAskQuizQuestion = async () => {
    const q = loveQuizQuestions[Math.floor(Math.random() * loveQuizQuestions.length)];
    await onMakeMove('quiz_question', { question: q.question, options: q.options });
  };

  const handleSetCorrectAnswer = async (answer: string) => {
    await onMakeMove('quiz_answer', { correctAnswer: answer });
  };

  const handleGuessAnswer = async (guess: string) => {
    if (!loveQuizState?.correctAnswer) return;
    await onMakeMove('quiz_guess', { guess, correctAnswer: loveQuizState.correctAnswer });
  };

  const handleQuizNext = async () => {
    await onMakeMove('quiz_next', {});
  };

  // Dream Date Builder handlers
  const handleDatePick = async (categoryId: string, optionId: string, optionLabel: string, optionEmoji: string) => {
    await onMakeMove('date_pick', { categoryId, optionId, optionLabel, optionEmoji });
  };

  const handleDateRestart = async () => {
    await onMakeMove('date_restart', {});
  };

  const isMyTurn = activeGameSession?.current_turn === user?.id;
  const filteredCategories = getGameCategories(conversation?.isGroup || false);
  const currentCategory = filteredCategories.find((c) => c.id === activeCategory);

  return (
    <div className="flex flex-col h-full bg-background/95 md:border-l border-border animate-fade-in-up">
      {/* Header */}
      <div className="h-14 sm:h-16 px-3 sm:px-4 flex items-center justify-between border-b border-border bg-card/50 shrink-0">
        <div className="flex items-center gap-2">
          <Gamepad2 className="w-5 h-5 text-primary" />
          <span className="font-display text-sm sm:text-base">
            Games
            {conversation && (
              <span className="text-secondary ml-1 hidden sm:inline">• {conversation.name}</span>
            )}
          </span>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
          <X className="w-5 h-5" />
        </Button>
      </div>

      {/* Main Content - Full width, no sidebar. Add bottom padding on mobile for chat overlay */}
      <div className={`flex-1 p-3 sm:p-4 overflow-y-auto scrollbar-neon ${isMobile ? 'pb-20' : ''}`}>
        {activeGame ? (
          /* Game View - no categories visible */
          <div className="max-w-2xl mx-auto">
              {!activeGameSession && !triviaSessionId && !diceRollSessionId && !cardGameSessionId && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setActiveGame(null);
                    if (onEndTriviaGame) onEndTriviaGame();
                    if (onEndDiceRollGame) onEndDiceRollGame();
                    if (onEndCardGame) onEndCardGame();
                  }}
                  className="mb-6"
                >
                  ← Back to games
                </Button>
              )}

              {/* Waiting for opponent */}
              {isWaiting && activeGameSession?.status === 'pending' && (
                <div className="text-center py-12">
                  <Loader2 className="w-16 h-16 mx-auto mb-6 text-primary animate-spin" />
                  <h2 className="font-display text-2xl mb-2 text-foreground">
                    Waiting for {opponentName}
                  </h2>
                  <p className="text-muted-foreground font-body">
                    They'll receive an invitation to join the game...
                  </p>
                  <Button
                    variant="outline"
                    className="mt-6"
                    onClick={async () => {
                      await onEndGame();
                      setActiveGame(null);
                      setIsWaiting(false);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              )}

              {/* Dice Roll - Multiplayer game with lobby */}
              {activeGame === 'dice-roll' && (
                <>
                  {isDiceRollLoading ? (
                    <div className="text-center py-12">
                      <Loader2 className="w-16 h-16 mx-auto mb-6 text-primary animate-spin" />
                      <h2 className="font-display text-2xl mb-2 text-foreground">
                        Setting up Dice Roll...
                      </h2>
                      <p className="text-muted-foreground font-body">
                        Inviting players to join the game
                      </p>
                    </div>
                  ) : diceRollState || diceRollSessionId ? (
                    <DiceRollGame
                      diceRollState={diceRollState ?? null}
                      lobbyCountdown={diceRollLobbyCountdown ?? null}
                      currentTurn={diceRollCurrentTurn ?? null}
                      onRollDice={onRollDice || (async () => {})}
                      onNextRound={onNextDiceRollRound || (async () => {})}
                      onEndGame={async () => {
                        if (onEndDiceRollGame) await onEndDiceRollGame();
                        setActiveGame(null);
                      }}
                      onStartGame={onStartDiceRollGame || (async () => {})}
                      isHost={diceRollState?.hostId === user?.id}
                    />
                  ) : (
                    <div className="text-center py-12">
                      <Loader2 className="w-16 h-16 mx-auto mb-6 text-primary animate-spin" />
                      <h2 className="font-display text-2xl mb-2 text-foreground">
                        Loading game...
                      </h2>
                    </div>
                  )}
                </>
              )}

              {/* Card Game - Multiplayer game with lobby */}
              {activeGame === 'card-game' && (
                <>
                  {isCardGameLoading ? (
                    <div className="text-center py-12">
                      <Loader2 className="w-16 h-16 mx-auto mb-6 text-primary animate-spin" />
                      <h2 className="font-display text-2xl mb-2 text-foreground">
                        Setting up Card Game...
                      </h2>
                      <p className="text-muted-foreground font-body">
                        Inviting players to join the game
                      </p>
                    </div>
                  ) : cardGameState || cardGameSessionId ? (
                    <CardGame
                      cardGameState={cardGameState ?? null}
                      lobbyCountdown={cardGameLobbyCountdown ?? null}
                      currentTurn={cardGameCurrentTurn ?? null}
                      onDrawCard={onDrawCard || (async () => {})}
                      onNextRound={onNextCardGameRound || (async () => {})}
                      onEndGame={async () => {
                        if (onEndCardGame) await onEndCardGame();
                        setActiveGame(null);
                      }}
                      onStartGame={onStartCardGame || (async () => {})}
                      isHost={cardGameState?.hostId === user?.id}
                    />
                  ) : (
                    <div className="text-center py-12">
                      <Loader2 className="w-16 h-16 mx-auto mb-6 text-primary animate-spin" />
                      <h2 className="font-display text-2xl mb-2 text-foreground">
                        Loading game...
                      </h2>
                    </div>
                  )}
                </>
              )}

              {/* Truth or Dare - Multiplayer game */}
              {activeGame === 'truth-or-dare' && activeGameSession?.status === 'active' && (
                <div className="text-center">
                  <h2 className="font-display text-3xl mb-4 gradient-text">Truth or Dare</h2>
                  
                  {/* Turn indicator */}
                  <div className="mb-8 p-4 rounded-xl bg-card border border-border">
                    <p className="text-lg font-body">
                      {isMyTurn ? (
                        <span className="text-neon-green">It's your turn!</span>
                      ) : (
                        <span className="text-muted-foreground">Waiting for {opponentName}'s turn...</span>
                      )}
                    </p>
                  </div>

                  {/* Show current prompt if exists */}
                  {currentPrompt && (
                    <div className="mb-8 p-8 rounded-2xl bg-card border border-border">
                      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/30 mb-4">
                        {currentPrompt.type === 'truth' ? (
                          <MessageSquare className="w-5 h-5 text-primary" />
                        ) : (
                          <Zap className="w-5 h-5 text-secondary" />
                        )}
                        <span className="font-display text-primary capitalize">{currentPrompt.type}</span>
                      </div>
                      <p className="text-xl font-body text-foreground">
                        {currentPrompt.content}
                      </p>
                      {isMyTurn && (
                        <Button
                          variant="neon"
                          className="mt-6"
                          onClick={handleCompletePrompt}
                        >
                          <Check className="w-5 h-5 mr-2" />
                          Done!
                        </Button>
                      )}
                    </div>
                  )}

                  {/* Choice buttons - only show when it's my turn and no current prompt */}
                  {isMyTurn && !currentPrompt && (
                    <div className="flex gap-4 justify-center">
                      <Button
                        variant="outline"
                        size="lg"
                        className="min-w-[150px]"
                        onClick={() => handleTruthOrDare('truth')}
                      >
                        <MessageSquare className="w-5 h-5 mr-2" />
                        Truth
                      </Button>
                      <Button
                        variant="neon"
                        size="lg"
                        className="min-w-[150px]"
                        onClick={() => handleTruthOrDare('dare')}
                      >
                        <Zap className="w-5 h-5 mr-2" />
                        Dare
                      </Button>
                    </div>
                  )}

                  {/* End game button */}
                  <Button
                    variant="ghost"
                    className="mt-8 text-muted-foreground"
                    onClick={async () => {
                      await onEndGame();
                      setActiveGame(null);
                      setCurrentPrompt(null);
                    }}
                  >
                    End Game
                  </Button>
                </div>
              )}

              {/* Would You Rather - Multiplayer game */}
              {activeGame === 'would-you-rather' && activeGameSession?.status === 'active' && (
                <div className="text-center">
                  <h2 className="font-display text-3xl mb-4 gradient-text">Would You Rather</h2>
                  
                  {/* Turn indicator */}
                  <div className="mb-8 p-4 rounded-xl bg-card border border-border">
                    <p className="text-lg font-body">
                      {isMyTurn ? (
                        <span className="text-neon-green">It's your turn!</span>
                      ) : (
                        <span className="text-muted-foreground">Waiting for {opponentName}'s turn...</span>
                      )}
                    </p>
                  </div>

                  {/* Show current question if exists */}
                  {wyrQuestion && (
                    <div className="mb-8 p-6 rounded-2xl bg-card border border-border">
                      <p className="text-lg font-body text-muted-foreground mb-6">Would you rather...</p>
                      
                      {/* If answer is revealed */}
                      {wyrAnswer ? (
                        <div className="space-y-4">
                          <div className={`p-4 rounded-xl border-2 ${wyrAnswer.choice === 'A' ? 'border-primary bg-primary/10' : 'border-border'}`}>
                            <p className="text-lg font-body text-foreground">{wyrQuestion.optionA}</p>
                            {wyrAnswer.choice === 'A' && (
                              <p className="text-sm text-primary mt-2">
                                ✓ {wyrAnswer.chooser === user?.id ? 'Your choice' : `${opponentName}'s choice`}
                              </p>
                            )}
                          </div>
                          <p className="text-muted-foreground font-bold">OR</p>
                          <div className={`p-4 rounded-xl border-2 ${wyrAnswer.choice === 'B' ? 'border-secondary bg-secondary/10' : 'border-border'}`}>
                            <p className="text-lg font-body text-foreground">{wyrQuestion.optionB}</p>
                            {wyrAnswer.choice === 'B' && (
                              <p className="text-sm text-secondary mt-2">
                                ✓ {wyrAnswer.chooser === user?.id ? 'Your choice' : `${opponentName}'s choice`}
                              </p>
                            )}
                          </div>
                          
                          {/* Next question button - for the person who answered */}
                          {isMyTurn && (
                            <Button
                              variant="neon"
                              className="mt-6"
                              onClick={handleWyrNext}
                            >
                              <Sparkles className="w-5 h-5 mr-2" />
                              Next Question
                            </Button>
                          )}
                        </div>
                      ) : (
                        /* Show choice buttons */
                        <div className="space-y-4">
                          <Button
                            variant="outline"
                            size="lg"
                            className={`w-full min-h-[60px] text-wrap ${isMyTurn ? 'hover:border-primary hover:bg-primary/10' : 'opacity-50'}`}
                            onClick={() => isMyTurn && handleWyrAnswer('A')}
                            disabled={!isMyTurn}
                          >
                            {wyrQuestion.optionA}
                          </Button>
                          <p className="text-muted-foreground font-bold">OR</p>
                          <Button
                            variant="outline"
                            size="lg"
                            className={`w-full min-h-[60px] text-wrap ${isMyTurn ? 'hover:border-secondary hover:bg-secondary/10' : 'opacity-50'}`}
                            onClick={() => isMyTurn && handleWyrAnswer('B')}
                            disabled={!isMyTurn}
                          >
                            {wyrQuestion.optionB}
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Ask question button - only show when it's my turn and no current question */}
                  {isMyTurn && !wyrQuestion && (
                    <div className="flex justify-center">
                      <Button
                        variant="neon"
                        size="lg"
                        onClick={handleAskWouldYouRather}
                      >
                        <Sparkles className="w-5 h-5 mr-2" />
                        Ask a Question
                      </Button>
                    </div>
                  )}

                  {/* End game button */}
                  <Button
                    variant="ghost"
                    className="mt-8 text-muted-foreground"
                    onClick={async () => {
                      await onEndGame();
                      setActiveGame(null);
                      setWyrQuestion(null);
                      setWyrAnswer(null);
                    }}
                  >
                    End Game
                  </Button>
                </div>
              )}

              {/* Love Quiz - Multiplayer game */}
              {activeGame === 'love-quiz' && activeGameSession?.status === 'active' && (
                <div className="text-center">
                  <h2 className="font-display text-3xl mb-4 gradient-text">Love Quiz</h2>
                  
                  {/* Score display */}
                  <div className="flex justify-center gap-8 mb-6">
                    <div className="p-3 rounded-xl bg-primary/10 border border-primary/30">
                      <p className="text-xs text-muted-foreground mb-1">You</p>
                      <p className="text-2xl font-bold text-primary">{loveQuizScore.me}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-secondary/10 border border-secondary/30">
                      <p className="text-xs text-muted-foreground mb-1">{opponentName}</p>
                      <p className="text-2xl font-bold text-secondary">{loveQuizScore.them}</p>
                    </div>
                  </div>

                  {/* Turn indicator */}
                  <div className="mb-6 p-4 rounded-xl bg-card border border-border">
                    <p className="text-lg font-body">
                      {isMyTurn ? (
                        <span className="text-neon-green">It's your turn!</span>
                      ) : (
                        <span className="text-muted-foreground">Waiting for {opponentName}'s turn...</span>
                      )}
                    </p>
                  </div>

                  {/* Question phase - Show question if exists */}
                  {loveQuizState && !loveQuizResult && (
                    <div className="mb-8 p-6 rounded-2xl bg-card border border-border">
                      <p className="text-sm text-muted-foreground mb-3">
                        {loveQuizState.askedBy === user?.id ? 'Your question:' : `${opponentName} asks:`}
                      </p>
                      <p className="text-xl font-body text-foreground mb-6">
                        {loveQuizState.question}
                      </p>

                      {/* Asker picks their own correct answer first */}
                      {loveQuizState.askedBy === user?.id && !loveQuizState.correctAnswer && (
                        <div className="space-y-3">
                          <p className="text-sm text-neon-green mb-4">Pick your true answer:</p>
                          {loveQuizState.options.map((option) => (
                            <Button
                              key={option}
                              variant="outline"
                              className="w-full hover:border-primary hover:bg-primary/10"
                              onClick={() => handleSetCorrectAnswer(option)}
                            >
                              {option}
                            </Button>
                          ))}
                        </div>
                      )}

                      {/* Asker waiting for guesser */}
                      {loveQuizState.askedBy === user?.id && loveQuizState.correctAnswer && (
                        <div className="text-muted-foreground">
                          <p className="mb-2">Your answer: <span className="text-primary font-semibold">{loveQuizState.correctAnswer}</span></p>
                          <p>Waiting for {opponentName} to guess...</p>
                        </div>
                      )}

                      {/* Guesser waiting for asker to pick */}
                      {loveQuizState.askedBy !== user?.id && !loveQuizState.correctAnswer && (
                        <div className="text-muted-foreground">
                          <p>Waiting for {opponentName} to pick their answer...</p>
                        </div>
                      )}

                      {/* Guesser picks their guess */}
                      {loveQuizState.askedBy !== user?.id && loveQuizState.correctAnswer && (
                        <div className="space-y-3">
                          <p className="text-sm text-neon-green mb-4">What do you think {opponentName}'s answer is?</p>
                          {loveQuizState.options.map((option) => (
                            <Button
                              key={option}
                              variant="outline"
                              className="w-full hover:border-secondary hover:bg-secondary/10"
                              onClick={() => handleGuessAnswer(option)}
                            >
                              {option}
                            </Button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Result phase */}
                  {loveQuizResult && (
                    <div className="mb-8 p-6 rounded-2xl bg-card border border-border">
                      <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full mb-4 ${
                        loveQuizResult.isCorrect 
                          ? 'bg-neon-green/10 border border-neon-green/30' 
                          : 'bg-destructive/10 border border-destructive/30'
                      }`}>
                        {loveQuizResult.isCorrect ? (
                          <Check className="w-5 h-5 text-neon-green" />
                        ) : (
                          <X className="w-5 h-5 text-destructive" />
                        )}
                        <span className={`font-display ${loveQuizResult.isCorrect ? 'text-neon-green' : 'text-destructive'}`}>
                          {loveQuizResult.isCorrect ? 'Correct!' : 'Wrong!'}
                        </span>
                      </div>

                      <p className="text-lg font-body text-foreground mb-2">
                        {loveQuizResult.guesser === user?.id ? 'You' : opponentName} guessed: <span className="font-semibold">{loveQuizResult.guessedAnswer}</span>
                      </p>
                      <p className="text-muted-foreground">
                        The correct answer was: <span className="text-primary font-semibold">{loveQuizResult.correctAnswer}</span>
                      </p>

                      {/* Next question button - for the person whose turn it is */}
                      {isMyTurn && (
                        <Button
                          variant="neon"
                          className="mt-6"
                          onClick={handleQuizNext}
                        >
                          <Sparkles className="w-5 h-5 mr-2" />
                          Next Question
                        </Button>
                      )}
                    </div>
                  )}

                  {/* Ask question button - only show when it's my turn and no current question */}
                  {isMyTurn && !loveQuizState && !loveQuizResult && (
                    <div className="flex justify-center">
                      <Button
                        variant="neon"
                        size="lg"
                        onClick={handleAskQuizQuestion}
                      >
                        <Heart className="w-5 h-5 mr-2" />
                        Ask a Question About You
                      </Button>
                    </div>
                  )}

                  {/* End game button */}
                  <Button
                    variant="ghost"
                    className="mt-8 text-muted-foreground"
                    onClick={async () => {
                      await onEndGame();
                      setActiveGame(null);
                      setLoveQuizState(null);
                      setLoveQuizResult(null);
                      setLoveQuizScore({ me: 0, them: 0 });
                    }}
                  >
                    End Game
                  </Button>
                </div>
              )}

              {/* Dream Date Builder - Multiplayer game */}
              {activeGame === 'dream-date' && activeGameSession?.status === 'active' && (
                <div className="text-center">
                  <h2 className="font-display text-3xl mb-4 gradient-text">Dream Date Builder ✨</h2>
                  
                  {/* Progress indicator */}
                  <div className="flex justify-center gap-2 mb-6">
                    {dreamDateCategories.map((cat, index) => (
                      <div
                        key={cat.id}
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm transition-all ${
                          index < dreamDateState.currentCategoryIndex
                            ? 'bg-primary text-primary-foreground'
                            : index === dreamDateState.currentCategoryIndex
                            ? 'bg-secondary text-secondary-foreground ring-2 ring-secondary ring-offset-2 ring-offset-background'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {cat.emoji}
                      </div>
                    ))}
                  </div>

                  {/* Turn indicator */}
                  {!dreamDateState.isComplete && (
                    <div className="mb-6 p-4 rounded-xl bg-card border border-border">
                      <p className="text-lg font-body">
                        {isMyTurn ? (
                          <span className="text-neon-green">Your turn to pick!</span>
                        ) : (
                          <span className="text-muted-foreground">Waiting for {opponentName} to choose...</span>
                        )}
                      </p>
                    </div>
                  )}

                  {/* Current category selection */}
                  {!dreamDateState.isComplete && (
                    <div className="mb-8 p-6 rounded-2xl bg-card border border-border">
                      {(() => {
                        const currentCat = dreamDateCategories[dreamDateState.currentCategoryIndex];
                        if (!currentCat) return null;
                        return (
                          <>
                            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/30 mb-4">
                              <span className="text-xl">{currentCat.emoji}</span>
                              <span className="font-display text-primary">{currentCat.name}</span>
                            </div>
                            <p className="text-xl font-body text-foreground mb-6">
                              {currentCat.question}
                            </p>
                            <div className="grid grid-cols-2 gap-3">
                              {currentCat.options.map((option) => (
                                <Button
                                  key={option.id}
                                  variant="outline"
                                  className={`h-auto py-4 flex flex-col items-center gap-2 ${
                                    isMyTurn 
                                      ? 'hover:border-primary hover:bg-primary/10' 
                                      : 'opacity-50 cursor-not-allowed'
                                  }`}
                                  onClick={() => isMyTurn && handleDatePick(currentCat.id, option.id, option.label, option.emoji)}
                                  disabled={!isMyTurn}
                                >
                                  <span className="text-2xl">{option.emoji}</span>
                                  <span className="text-sm font-body">{option.label}</span>
                                </Button>
                              ))}
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  )}

                  {/* Show selections made so far */}
                  {Object.keys(dreamDateState.selections).length > 0 && !dreamDateState.isComplete && (
                    <div className="mb-6 p-4 rounded-xl bg-muted/30 border border-border">
                      <p className="text-sm text-muted-foreground mb-3">Building your dream date...</p>
                      <div className="flex flex-wrap justify-center gap-2">
                        {Object.entries(dreamDateState.selections).map(([catId, sel]) => (
                          <div
                            key={catId}
                            className={`px-3 py-1.5 rounded-full text-sm flex items-center gap-1.5 ${
                              sel.chooser === user?.id 
                                ? 'bg-primary/20 text-primary border border-primary/30' 
                                : 'bg-secondary/20 text-secondary border border-secondary/30'
                            }`}
                          >
                            <span>{sel.emoji}</span>
                            <span>{sel.option}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Complete Date Reveal */}
                  {dreamDateState.isComplete && (
                    <div className="mb-8 p-6 rounded-2xl bg-gradient-to-br from-primary/10 to-secondary/10 border border-primary/30">
                      <Sparkles className="w-12 h-12 mx-auto mb-4 text-primary animate-pulse" />
                      <h3 className="font-display text-2xl mb-6 text-foreground">Your Dream Date!</h3>
                      
                      <div className="space-y-4 text-left max-w-sm mx-auto">
                        {dreamDateCategories.map((cat) => {
                          const sel = dreamDateState.selections[cat.id];
                          if (!sel) return null;
                          return (
                            <div key={cat.id} className="flex items-center gap-3 p-3 rounded-lg bg-card/50 border border-border">
                              <span className="text-2xl">{sel.emoji}</span>
                              <div className="flex-1">
                                <p className="text-xs text-muted-foreground">{cat.name}</p>
                                <p className="font-body text-foreground">{sel.option}</p>
                              </div>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${
                                sel.chooser === user?.id 
                                  ? 'bg-primary/20 text-primary' 
                                  : 'bg-secondary/20 text-secondary'
                              }`}>
                                {sel.chooser === user?.id ? 'You' : opponentName}
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      <div className="mt-6 flex gap-3 justify-center">
                        <Button
                          variant="neon"
                          onClick={handleDateRestart}
                        >
                          <Sparkles className="w-5 h-5 mr-2" />
                          Plan Another Date
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* End game button */}
                  <Button
                    variant="ghost"
                    className="mt-4 text-muted-foreground"
                    onClick={async () => {
                      await onEndGame();
                      setActiveGame(null);
                      setDreamDateState({ currentCategoryIndex: 0, selections: {}, isComplete: false });
                    }}
                  >
                    End Game
                  </Button>
                </div>
              )}

              {/* Trivia Challenge - Multiplayer game */}
              {activeGame === 'trivia' && (
                <>
                  {isTriviaLoading ? (
                    <div className="text-center py-12">
                      <Loader2 className="w-16 h-16 mx-auto mb-6 text-primary animate-spin" />
                      <h2 className="font-display text-2xl mb-2 text-foreground">
                        Setting up Trivia...
                      </h2>
                      <p className="text-muted-foreground font-body">
                        Inviting players to join the game
                      </p>
                    </div>
                  ) : triviaState || triviaSessionId ? (
                    <TriviaGame
                      triviaState={triviaState ?? null}
                      lobbyCountdown={triviaLobbyCountdown ?? null}
                      onSubmitAnswer={onSubmitTriviaAnswer || (async () => {})}
                      onNextQuestion={onNextTriviaQuestion || (async () => {})}
                      onEndGame={async () => {
                        if (onEndTriviaGame) await onEndTriviaGame();
                        setActiveGame(null);
                      }}
                      onStartGame={onStartTriviaGame || (async () => {})}
                      isHost={triviaState?.hostId === user?.id}
                    />
                  ) : (
                    <div className="text-center py-12">
                      <Loader2 className="w-16 h-16 mx-auto mb-6 text-primary animate-spin" />
                      <h2 className="font-display text-2xl mb-2 text-foreground">
                        Loading game...
                      </h2>
                    </div>
                  )}
                </>
              )}

              {/* Word Chain - Multiplayer game */}
              {activeGame === 'word-chain' && (
                <>
                  {isWordChainLoading ? (
                    <div className="text-center py-12">
                      <Loader2 className="w-16 h-16 mx-auto mb-6 text-primary animate-spin" />
                      <h2 className="font-display text-2xl mb-2 text-foreground">
                        Setting up Word Chain...
                      </h2>
                      <p className="text-muted-foreground font-body">
                        Inviting players to join the game
                      </p>
                    </div>
                  ) : wordChainState || wordChainSessionId ? (
                    <WordChainGame
                      gameState={wordChainState ?? null}
                      lobbyCountdown={wordChainLobbyCountdown ?? null}
                      turnTimeRemaining={wordChainTurnTimeRemaining ?? null}
                      sessionId={wordChainSessionId ?? null}
                      onSubmitWord={onSubmitWordChainWord || (async () => ({ success: false, error: 'Not available' }))}
                      onSkipTurn={onSkipWordChainTurn || (async () => {})}
                      onEndGame={async () => {
                        if (onEndWordChainGame) await onEndWordChainGame();
                        setActiveGame(null);
                      }}
                      onStartGame={onStartWordChainGame || (async () => {})}
                    />
                  ) : (
                    <div className="text-center py-12">
                      <Loader2 className="w-16 h-16 mx-auto mb-6 text-primary animate-spin" />
                      <h2 className="font-display text-2xl mb-2 text-foreground">
                        Loading game...
                      </h2>
                    </div>
                  )}
                </>
              )}

              {/* Coming soon games */}
              {!['dice-roll', 'card-game', 'truth-or-dare', 'would-you-rather', 'love-quiz', 'dream-date', 'trivia', 'word-chain'].includes(activeGame) && !isWaiting && (
                <div className="text-center">
                  <h2 className="font-display text-3xl mb-4 gradient-text">
                    {currentCategory?.games.find((g) => g.id === activeGame)?.name}
                  </h2>
                  <p className="text-muted-foreground mb-8 font-body">
                    {currentCategory?.games.find((g) => g.id === activeGame)?.description}
                  </p>
                  
                  <div className="p-12 rounded-2xl bg-card border border-border">
                    <Sparkles className="w-16 h-16 mx-auto mb-4 text-primary" />
                    <p className="text-xl font-body text-foreground">
                      Coming Soon!
                    </p>
                    <p className="text-muted-foreground mt-2">
                      This game is being developed. Stay tuned!
                    </p>
                  </div>
                </div>
              )}
            </div>
        ) : (
          /* Category Dropdowns View */
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground font-body mb-4">
              Pick a category and choose a game to play with {conversation?.name || 'your friend'}
            </p>
            
            {filteredCategories.map((category) => {
              const Icon = category.icon;
              return (
                <DropdownMenu key={category.id}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      className={`w-full justify-between h-12 ${
                        activeCategory === category.id ? `border-2 ${category.textColor}` : ''
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Icon className={`w-5 h-5 ${category.textColor}`} />
                        <span className="font-display text-sm">{category.title}</span>
                      </div>
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent 
                    className="w-[calc(100vw-2rem)] max-w-[400px] bg-card border border-border z-50"
                    align="start"
                  >
                    {category.games.map((game) => (
                      <DropdownMenuItem
                        key={game.id}
                        onClick={() => {
                          setActiveCategory(category.id);
                          handlePlayGame(game.id);
                        }}
                        className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50"
                      >
                        <span className="text-2xl">{game.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-display text-sm text-foreground">{game.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{game.description}</p>
                        </div>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default GamesPanel;
