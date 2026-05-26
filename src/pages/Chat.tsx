import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useConversations } from '@/hooks/useConversations';
import { useCallSignaling } from '@/hooks/useCallSignaling';
import { useGameSignaling } from '@/hooks/useGameSignaling';
import { useTriviaGame } from '@/hooks/useTriviaGame';
import { useWordChainGame } from '@/hooks/useWordChainGame';
import { useDiceRollGame } from '@/hooks/useDiceRollGame';
import { useCardGame } from '@/hooks/useCardGame';
import { useMobileLayout } from '@/hooks/useMobileLayout';
import ChatSidebar from '@/components/chat/ChatSidebar';
import ChatMain from '@/components/chat/ChatMain';
import VideoCallModal from '@/components/chat/VideoCallModal';
import IncomingCallModal from '@/components/chat/IncomingCallModal';
import CallRecipientDialog, { CallRecipient } from '@/components/chat/CallRecipientDialog';
import IncomingGameModal from '@/components/chat/IncomingGameModal';
import IncomingTriviaModal from '@/components/chat/IncomingTriviaModal';
import IncomingWordChainModal from '@/components/chat/IncomingWordChainModal';
import IncomingDiceRollModal from '@/components/chat/IncomingDiceRollModal';
import IncomingCardGameModal from '@/components/chat/IncomingCardGameModal';
import GamesPanel from '@/components/chat/GamesPanel';
import MobileChatOverlay from '@/components/chat/MobileChatOverlay';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export interface Conversation {
  id: string;
  name: string;
  avatar?: string;
  lastMessage?: string;
  timestamp?: string;
  unread?: number;
  isOnline?: boolean;
  isGroup?: boolean;
  participantIds?: string[];
  otherParticipantIds?: string[];
}

const Chat = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { conversations, deleteConversation, refetch: refetchConversations } = useConversations();
  const { incomingCall, rejectCall } = useCallSignaling();
  const { isMobile, sidebarOpen, setSidebarOpen } = useMobileLayout();
  const {
    incomingGameInvite,
    activeGameSession,
    gameMoves,
    inviteToGame,
    acceptGame,
    rejectGame,
    endGame,
    makeMove,
    clearSession,
  } = useGameSignaling();

  // Trivia game hook
  const {
    triviaInvite,
    triviaState,
    activeSessionId: triviaSessionId,
    lobbyCountdown: triviaLobbyCountdown,
    createTriviaSession,
    joinTriviaGame,
    rejectTriviaGame,
    startTriviaGame,
    submitAnswer: submitTriviaAnswer,
    nextQuestion: nextTriviaQuestion,
    endTriviaGame,
  } = useTriviaGame();

  // Word Chain game hook
  const {
    wordChainInvite,
    wordChainState,
    activeSessionId: wordChainSessionId,
    lobbyCountdown: wordChainLobbyCountdown,
    turnTimeRemaining: wordChainTurnTimeRemaining,
    createWordChainSession,
    joinWordChainGame,
    rejectWordChainGame,
    startWordChainGame,
    submitWord: submitWordChainWord,
    skipTurn: skipWordChainTurn,
    endWordChainGame,
  } = useWordChainGame();

  // Dice Roll game hook
  const {
    diceRollInvite,
    diceRollState,
    activeSessionId: diceRollSessionId,
    lobbyCountdown: diceRollLobbyCountdown,
    currentTurn: diceRollCurrentTurn,
    createDiceRollSession,
    joinDiceRollGame,
    rejectDiceRollGame,
    startDiceRollGame,
    rollDice,
    nextRound: nextDiceRollRound,
    endDiceRollGame,
  } = useDiceRollGame();

  // Card Game hook
  const {
    cardGameInvite,
    cardGameState,
    activeSessionId: cardGameSessionId,
    lobbyCountdown: cardGameLobbyCountdown,
    currentTurn: cardGameCurrentTurn,
    createCardGameSession,
    joinCardGame,
    rejectCardGame,
    startCardGame,
    drawCard,
    nextRound: nextCardGameRound,
    endCardGame,
  } = useCardGame();
  
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [showVideoCall, setShowVideoCall] = useState(false);
  const [showGames, setShowGames] = useState(false);
  const [callType, setCallType] = useState<'audio' | 'video'>('video');
  const [incomingCallId, setIncomingCallId] = useState<string | null>(null);
  const [incomingOffer, setIncomingOffer] = useState<RTCSessionDescriptionInit | null>(null);
  const [targetCalleeId, setTargetCalleeId] = useState<string | null>(null);
  const [showCallRecipientDialog, setShowCallRecipientDialog] = useState(false);
  const [pendingCallType, setPendingCallType] = useState<'audio' | 'video'>('audio');
  const [callRecipients, setCallRecipients] = useState<CallRecipient[]>([]);

  const handleDeleteConversation = async (conversationId: string) => {
    const success = await deleteConversation(conversationId);
    if (success) {
      setActiveConversation(null);
      toast.success('Chat deleted');
    } else {
      toast.error('Failed to delete chat');
    }
  };

  // Close sidebar when selecting a conversation on mobile
  const handleSelectConversation = (conversation: Conversation) => {
    setActiveConversation(conversation);
    if (isMobile) {
      setSidebarOpen(false);
    }
    // Refetch conversations after a short delay to update unread counts
    // (messages are marked as read when useMessages fetches them)
    setTimeout(() => {
      refetchConversations();
    }, 500);
  };

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  const getCallRecipients = async (conversation: Conversation): Promise<CallRecipient[]> => {
    if (!user?.id) return [];

    const knownIds = (conversation.otherParticipantIds || []).filter((id) => id !== user.id);
    let participantIds = knownIds;

    if (participantIds.length === 0) {
      const { data, error } = await supabase
        .from('conversation_participants')
        .select('user_id')
        .eq('conversation_id', conversation.id)
        .neq('user_id', user.id);

      if (error) {
        console.error('Error fetching call recipients:', error);
        return [];
      }

      participantIds = (data || [])
        .map((participant) => participant.user_id)
        .filter((id): id is string => Boolean(id));
    }

    if (participantIds.length === 0) return [];

    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, username, avatar_url, status')
      .in('id', participantIds);

    if (profileError) {
      console.error('Error fetching call recipient profiles:', profileError);
      return [];
    }

    const profilesById = new Map((profiles || []).map((profile) => [profile.id, profile]));

    return participantIds.reduce<CallRecipient[]>((recipients, id) => {
      const profile = profilesById.get(id);
      if (profile) {
        recipients.push({
          id: profile.id,
          username: profile.username,
          avatar_url: profile.avatar_url,
          status: profile.status,
        });
      }
      return recipients;
    }, []);
  };

  const handleStartCall = async (type: 'audio' | 'video') => {
    if (!activeConversation) return;

    const recipients = await getCallRecipients(activeConversation);
    if (recipients.length === 0) {
      toast.error('Could not find anyone to call in this chat');
      return;
    }

    if (activeConversation.isGroup && recipients.length > 1) {
      setPendingCallType(type);
      setCallRecipients(recipients);
      setShowCallRecipientDialog(true);
      return;
    }

    setCallType(type);
    setIncomingCallId(null);
    setIncomingOffer(null);
    setTargetCalleeId(recipients[0].id);
    setShowVideoCall(true);
  };

  const handleSelectCallRecipient = (recipientId: string) => {
    setCallType(pendingCallType);
    setIncomingCallId(null);
    setIncomingOffer(null);
    setTargetCalleeId(recipientId);
    setShowCallRecipientDialog(false);
    setShowVideoCall(true);
  };

  const handleAcceptIncomingCall = async () => {
    if (!incomingCall) return;

    // Find the conversation for this call
    const callConversation = conversations?.find(
      c => c.id === incomingCall.callData.conversation_id
    );

    if (callConversation) {
      // Convert to proper Conversation type
      const conv: Conversation = {
        id: callConversation.id,
        name: callConversation.name || 'Unknown',
        isOnline: true,
      };
      setActiveConversation(callConversation);
    } else {
      // Fetch conversation details if not in list
      const { data: convData } = await supabase
        .from('conversations')
        .select('id, name')
        .eq('id', incomingCall.callData.conversation_id)
        .single();

      if (convData) {
        const conv: Conversation = {
          id: convData.id,
          name: convData.name || incomingCall.callerProfile.username,
          isOnline: true,
        };
        setActiveConversation(conv);
      }
    }

    setCallType(incomingCall.callData.call_type as 'audio' | 'video');
    setIncomingCallId(incomingCall.callData.id);
    setIncomingOffer(incomingCall.callData.offer || null);
    setTargetCalleeId(null);
    setShowVideoCall(true);
  };

  const handleRejectIncomingCall = () => {
    if (incomingCall) {
      rejectCall(incomingCall.callData.id);
    }
  };

  const handleCloseVideoCall = () => {
    setShowVideoCall(false);
    setIncomingCallId(null);
    setIncomingOffer(null);
    setTargetCalleeId(null);
  };

  const handleShowGames = () => {
    setShowGames(true);
    // Close sidebar on mobile when opening games
    if (isMobile) {
      setSidebarOpen(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 text-primary animate-spin" />
          <p className="text-muted-foreground font-body">Loading ArcadeUChat...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="h-screen bg-background flex overflow-hidden relative">
      {/* Background Effects */}
      <div className="fixed inset-0 bg-cyber-grid bg-cyber-grid opacity-5 pointer-events-none" />
      <div className="fixed top-0 left-0 w-96 h-96 bg-primary/5 rounded-full blur-[150px] pointer-events-none" />
      <div className="fixed bottom-0 right-0 w-96 h-96 bg-secondary/5 rounded-full blur-[150px] pointer-events-none" />

      {/* Mobile Sidebar Overlay */}
      {isMobile && sidebarOpen && (
        <div 
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`
          ${isMobile 
            ? `fixed inset-y-0 left-0 z-50 w-full max-w-[320px] transform transition-transform duration-300 ease-in-out ${
                sidebarOpen ? 'translate-x-0' : '-translate-x-full'
              }`
            : 'relative'
          }
        `}
      >
        <ChatSidebar
          activeConversation={activeConversation}
          onSelectConversation={handleSelectConversation}
          onShowGames={handleShowGames}
        />
      </div>

      {/* Main Content Area - Split when games are open */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Chat Area */}
        <div
          className={`min-h-0 min-w-0 flex flex-col transition-all duration-300 ${
            showGames && !isMobile ? 'flex-[2_1_0%]' : 'flex-1'
          }`}
        >
          <ChatMain
            conversation={activeConversation}
            onStartCall={handleStartCall}
            onShowGames={handleShowGames}
            onDeleteConversation={handleDeleteConversation}
          />
        </div>

        {/* Games Panel - Side by side on desktop, fullscreen on mobile */}
        {showGames && (
          <div className={`
            ${isMobile 
              ? 'fixed inset-0 z-50 bg-background' 
              : 'min-h-0 min-w-0 flex-[3_1_0%] max-w-[560px]'
            }
          `}>
            <GamesPanel
              isOpen={showGames}
              onClose={() => {
                setShowGames(false);
                if (activeGameSession) {
                  endGame();
                }
                if (triviaSessionId) {
                  endTriviaGame();
                }
                if (wordChainSessionId) {
                  endWordChainGame();
                }
                if (diceRollSessionId) {
                  endDiceRollGame();
                }
                if (cardGameSessionId) {
                  endCardGame();
                }
              }}
              conversation={activeConversation}
              activeGameSession={activeGameSession}
              gameMoves={gameMoves}
              onInviteToGame={inviteToGame}
              onMakeMove={makeMove}
              onEndGame={endGame}
              // Trivia props
              triviaState={triviaState}
              triviaLobbyCountdown={triviaLobbyCountdown}
              onCreateTriviaSession={createTriviaSession}
              onSubmitTriviaAnswer={submitTriviaAnswer}
              onNextTriviaQuestion={nextTriviaQuestion}
              onEndTriviaGame={endTriviaGame}
              onStartTriviaGame={startTriviaGame}
              triviaSessionId={triviaSessionId}
              // Word Chain props
              wordChainState={wordChainState}
              wordChainLobbyCountdown={wordChainLobbyCountdown}
              wordChainTurnTimeRemaining={wordChainTurnTimeRemaining}
              wordChainSessionId={wordChainSessionId}
              onCreateWordChainSession={createWordChainSession}
              onSubmitWordChainWord={submitWordChainWord}
              onSkipWordChainTurn={skipWordChainTurn}
              onEndWordChainGame={endWordChainGame}
              onStartWordChainGame={startWordChainGame}
              // Dice Roll props
              diceRollState={diceRollState}
              diceRollLobbyCountdown={diceRollLobbyCountdown}
              diceRollSessionId={diceRollSessionId}
              diceRollCurrentTurn={diceRollCurrentTurn}
              onCreateDiceRollSession={createDiceRollSession}
              onRollDice={rollDice}
              onNextDiceRollRound={nextDiceRollRound}
              onEndDiceRollGame={endDiceRollGame}
              onStartDiceRollGame={startDiceRollGame}
              // Card Game props
              cardGameState={cardGameState}
              cardGameLobbyCountdown={cardGameLobbyCountdown}
              cardGameSessionId={cardGameSessionId}
              cardGameCurrentTurn={cardGameCurrentTurn}
              onCreateCardGameSession={createCardGameSession}
              onDrawCard={drawCard}
              onNextCardGameRound={nextCardGameRound}
              onEndCardGame={endCardGame}
              onStartCardGame={startCardGame}
            />
            
            {/* Mobile Chat Overlay - Show when games are open on mobile */}
            {isMobile && activeConversation && (
              <MobileChatOverlay
                conversationId={activeConversation.id}
                conversationName={activeConversation.name}
              />
            )}
          </div>
        )}
      </div>

      {/* Incoming Call Modal */}
      {incomingCall && !showVideoCall && (
        <IncomingCallModal
          callerName={incomingCall.callerProfile.username}
          callerAvatar={incomingCall.callerProfile.avatar_url}
          callType={incomingCall.callData.call_type as 'audio' | 'video'}
          onAccept={handleAcceptIncomingCall}
          onReject={handleRejectIncomingCall}
        />
      )}

      <CallRecipientDialog
        isOpen={showCallRecipientDialog}
        onClose={() => setShowCallRecipientDialog(false)}
        recipients={callRecipients}
        callType={pendingCallType}
        onSelectRecipient={handleSelectCallRecipient}
      />

      {/* Incoming Game Modal */}
      {incomingGameInvite && !showGames && (
        <IncomingGameModal
          inviterName={incomingGameInvite.inviterProfile.username}
          inviterAvatar={incomingGameInvite.inviterProfile.avatar_url}
          gameType={incomingGameInvite.session.game_type}
          onAccept={async () => {
            // Set the active conversation to the one where the game invite was sent
            const gameConversationId = incomingGameInvite.session.conversation_id;
            const existingConv = conversations?.find(c => c.id === gameConversationId);
            
            if (existingConv) {
              setActiveConversation({
                id: existingConv.id,
                name: existingConv.name || incomingGameInvite.inviterProfile.username,
                isOnline: true,
              });
            } else {
              // Fetch conversation if not in list
              const { data: convData } = await supabase
                .from('conversations')
                .select('id, name')
                .eq('id', gameConversationId)
                .single();
              
              if (convData) {
                setActiveConversation({
                  id: convData.id,
                  name: convData.name || incomingGameInvite.inviterProfile.username,
                  isOnline: true,
                });
              }
            }
            
            acceptGame();
            setShowGames(true);
          }}
          onReject={rejectGame}
        />
      )}

      {/* Incoming Trivia Modal */}
      {triviaInvite && !showGames && (
        <IncomingTriviaModal
          hostName={triviaInvite.hostName}
          onAccept={async () => {
            // Set the active conversation to the one where the trivia invite was sent
            const triviaConversationId = triviaInvite.conversationId;
            const existingConv = conversations?.find(c => c.id === triviaConversationId);
            
            if (existingConv) {
              setActiveConversation({
                id: existingConv.id,
                name: existingConv.name || triviaInvite.hostName,
                isOnline: true,
              });
            } else {
              // Fetch conversation if not in list
              const { data: convData } = await supabase
                .from('conversations')
                .select('id, name')
                .eq('id', triviaConversationId)
                .single();
              
              if (convData) {
                setActiveConversation({
                  id: convData.id,
                  name: convData.name || triviaInvite.hostName,
                  isOnline: true,
                });
              }
            }
            
            joinTriviaGame();
            await joinTriviaGame();
            setShowGames(true);
          }}
          onReject={rejectTriviaGame}
        />
      )}

      {/* Incoming Word Chain Modal */}
      {wordChainInvite && !showGames && (
        <IncomingWordChainModal
          hostName={wordChainInvite.hostName}
          onAccept={async () => {
            const wordChainConversationId = wordChainInvite.conversationId;
            const existingConv = conversations?.find(c => c.id === wordChainConversationId);
            
            if (existingConv) {
              setActiveConversation({
                id: existingConv.id,
                name: existingConv.name || wordChainInvite.hostName,
                isOnline: true,
              });
            } else {
              const { data: convData } = await supabase
                .from('conversations')
                .select('id, name')
                .eq('id', wordChainConversationId)
                .single();
              
              if (convData) {
                setActiveConversation({
                  id: convData.id,
                  name: convData.name || wordChainInvite.hostName,
                  isOnline: true,
                });
              }
            }
            
            joinWordChainGame();
            await joinWordChainGame();
            setShowGames(true);
          }}
          onReject={rejectWordChainGame}
        />
      )}

      {/* Incoming Dice Roll Modal */}
      {diceRollInvite && !showGames && (
        <IncomingDiceRollModal
          hostName={diceRollInvite.hostName}
          onAccept={async () => {
            const diceRollConversationId = diceRollInvite.conversationId;
            const existingConv = conversations?.find(c => c.id === diceRollConversationId);
            
            if (existingConv) {
              setActiveConversation({
                id: existingConv.id,
                name: existingConv.name || diceRollInvite.hostName,
                isOnline: true,
              });
            } else {
              const { data: convData } = await supabase
                .from('conversations')
                .select('id, name')
                .eq('id', diceRollConversationId)
                .single();
              
              if (convData) {
                setActiveConversation({
                  id: convData.id,
                  name: convData.name || diceRollInvite.hostName,
                  isOnline: true,
                });
              }
            }
            
            joinDiceRollGame();
            await joinDiceRollGame();
            setShowGames(true);
          }}
          onReject={rejectDiceRollGame}
        />
      )}

      {/* Incoming Card Game Modal */}
      {cardGameInvite && !showGames && (
        <IncomingCardGameModal
          hostName={cardGameInvite.hostName}
          onAccept={async () => {
            const cardGameConversationId = cardGameInvite.conversationId;
            const existingConv = conversations?.find(c => c.id === cardGameConversationId);
            
            if (existingConv) {
              setActiveConversation({
                id: existingConv.id,
                name: existingConv.name || cardGameInvite.hostName,
                isOnline: true,
              });
            } else {
              const { data: convData } = await supabase
                .from('conversations')
                .select('id, name')
                .eq('id', cardGameConversationId)
                .single();
              
              if (convData) {
                setActiveConversation({
                  id: convData.id,
                  name: convData.name || cardGameInvite.hostName,
                  isOnline: true,
                });
              }
            }
            
            joinCardGame();
            await joinCardGame();
            setShowGames(true);
          }}
          onReject={rejectCardGame}
        />
      )}
      <VideoCallModal
        isOpen={showVideoCall}
        onClose={handleCloseVideoCall}
        conversation={activeConversation}
        callType={callType}
        incomingCallId={incomingCallId}
        incomingOffer={incomingOffer}
        targetCalleeId={targetCalleeId}
      />

    </div>
  );
};

export default Chat;
