import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Loader2, 
  Users, 
  Trophy, 
  Clock, 
  Send, 
  SkipForward,
  Crown,
  XCircle,
  CheckCircle2,
  Link2,
  Sparkles
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import type { WordChainGameState } from '@/hooks/useWordChainGame';

interface WordChainGameProps {
  gameState: WordChainGameState | null;
  lobbyCountdown: number | null;
  turnTimeRemaining: number | null;
  sessionId: string | null;
  onSubmitWord: (word: string) => Promise<{ success: boolean; error?: string }>;
  onSkipTurn: () => Promise<void>;
  onEndGame: () => Promise<void>;
  onStartGame: () => Promise<void>;
}

const WordChainGame = ({
  gameState,
  lobbyCountdown,
  turnTimeRemaining,
  sessionId,
  onSubmitWord,
  onSkipTurn,
  onEndGame,
  onStartGame,
}: WordChainGameProps) => {
  const { user } = useAuth();
  const [wordInput, setWordInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const wordsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest word
  useEffect(() => {
    wordsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [gameState?.words.length]);

  // Clear error after 3 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  if (!sessionId || !gameState) {
    return (
      <div className="text-center py-12">
        <Loader2 className="w-12 h-12 mx-auto mb-4 text-primary animate-spin" />
        <p className="text-muted-foreground">Setting up Word Chain...</p>
      </div>
    );
  }

  const isHost = gameState.hostId === user?.id;
  const joinedPlayers = gameState.players.filter((p) => p.status === 'joined');
  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const isMyTurn = currentPlayer?.id === user?.id && gameState.gameStarted && !gameState.gameEnded;
  const lastWord = gameState.words[gameState.words.length - 1];
  const requiredLetter = lastWord?.word[lastWord.word.length - 1].toUpperCase();
  const amEliminated = gameState.eliminatedPlayers.includes(user?.id || '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wordInput.trim() || !isMyTurn || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    const result = await onSubmitWord(wordInput.trim());
    
    if (!result.success) {
      setError(result.error || 'Invalid word');
    } else {
      setWordInput('');
    }
    
    setIsSubmitting(false);
  };

  const handleSkip = async () => {
    if (!isMyTurn) return;
    await onSkipTurn();
  };

  // Lobby View
  if (!gameState.gameStarted) {
    const pendingPlayers = gameState.players.filter((p) => p.status === 'pending');
    
    return (
      <div className="text-center px-2">
        <h2 className="font-display text-2xl sm:text-3xl mb-2 gradient-text">Word Chain 🔗</h2>
        <p className="text-muted-foreground mb-4 sm:mb-6 text-sm sm:text-base">Waiting for players to join...</p>

        {/* Countdown */}
        {lobbyCountdown !== null && lobbyCountdown > 0 && (
          <div className="mb-4 sm:mb-6">
            <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 rounded-full bg-primary/10 border border-primary/30">
              <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              <span className="font-display text-primary text-sm sm:text-base">Starting in {lobbyCountdown}s</span>
            </div>
          </div>
        )}

        {/* Players list */}
        <div className="bg-card rounded-2xl border border-border p-4 sm:p-6 mb-4 sm:mb-6">
          <div className="flex items-center gap-2 mb-3 sm:mb-4">
            <Users className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
            <span className="font-display text-base sm:text-lg">Players ({joinedPlayers.length})</span>
          </div>

          <div className="space-y-2 sm:space-y-3 max-h-[200px] overflow-y-auto scrollbar-neon">
            {gameState.players.map((player) => (
              <div
                key={player.id}
                className={`flex items-center justify-between p-2 sm:p-3 rounded-xl ${
                  player.status === 'joined'
                    ? 'bg-neon-green/10 border border-neon-green/30'
                    : player.status === 'left'
                    ? 'bg-destructive/10 border border-destructive/30'
                    : 'bg-muted/50 border border-border'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {player.id === gameState.hostId && (
                    <Crown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-yellow-500 shrink-0" />
                  )}
                  <span className="font-body text-sm sm:text-base truncate">{player.username}</span>
                </div>
                <span
                  className={`text-xs sm:text-sm shrink-0 ml-2 ${
                    player.status === 'joined'
                      ? 'text-neon-green'
                      : player.status === 'left'
                      ? 'text-destructive'
                      : 'text-muted-foreground'
                  }`}
                >
                  {player.status === 'joined' ? '✓ Joined' : player.status === 'left' ? '✗ Left' : 'Waiting...'}
                </span>
              </div>
            ))}
          </div>

          {pendingPlayers.length > 0 && (
            <p className="text-xs sm:text-sm text-muted-foreground mt-3 sm:mt-4">
              Waiting for {pendingPlayers.length} more player(s)...
            </p>
          )}
        </div>

        {/* Start/Cancel buttons */}
        <div className="flex gap-2 sm:gap-3 justify-center flex-wrap">
          {isHost && joinedPlayers.length >= 2 && (
            <Button variant="neon" onClick={onStartGame} size="sm" className="sm:text-base">
              <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
              Start ({joinedPlayers.length} players)
            </Button>
          )}
          <Button variant="outline" onClick={onEndGame} size="sm" className="sm:text-base">
            Cancel
          </Button>
        </div>

        {joinedPlayers.length < 2 && (
          <p className="text-xs sm:text-sm text-muted-foreground mt-3 sm:mt-4">Need at least 2 players to start</p>
        )}
      </div>
    );
  }

  // Game Over View
  if (gameState.gameEnded) {
    return (
      <div className="text-center">
        <Trophy className="w-20 h-20 mx-auto mb-4 text-yellow-500" />
        <h2 className="font-display text-3xl gradient-text mb-2">Game Over!</h2>
        
        {gameState.winner ? (
          <div className="mb-6">
            <p className="text-xl mb-2">
              🎉 <span className="text-primary font-semibold">{gameState.winner.username}</span> wins!
            </p>
          </div>
        ) : (
          <p className="text-muted-foreground mb-6">No winner this round</p>
        )}

        {/* Final stats */}
        <div className="mb-6 p-4 rounded-xl bg-card border border-border">
          <h3 className="font-display text-lg mb-4">Final Standings</h3>
          <div className="space-y-2">
            {gameState.players
              .filter((p) => p.status === 'joined')
              .sort((a, b) => b.wordsPlayed - a.wordsPlayed)
              .map((player, index) => (
                <div
                  key={player.id}
                  className={`flex items-center justify-between p-3 rounded-lg ${
                    gameState.winner?.id === player.id
                      ? 'bg-yellow-500/10 border border-yellow-500/30'
                      : 'bg-muted/20'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground w-6">{index + 1}.</span>
                    {index === 0 && <Trophy className="w-4 h-4 text-yellow-500" />}
                    <span>{player.username}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {player.wordsPlayed} words
                  </span>
                </div>
              ))}
          </div>
        </div>

        {/* Word chain recap */}
        <div className="mb-6 p-4 rounded-xl bg-card border border-border text-left">
          <h3 className="font-display text-lg mb-2">Word Chain ({gameState.words.length} words)</h3>
          <p className="text-sm text-muted-foreground break-words">
            {gameState.words.map((w) => w.word).join(' → ')}
          </p>
        </div>

        <Button variant="neon" onClick={onEndGame}>
          Back to Games
        </Button>
      </div>
    );
  }

  // Active Game View
  return (
    <div className="flex flex-col h-full max-h-[600px]">
      {/* Header */}
      <div className="text-center mb-4">
        <h2 className="font-display text-2xl gradient-text mb-1">Word Chain</h2>
        <p className="text-sm text-muted-foreground">
          {gameState.words.length} words played
        </p>
      </div>

      {/* Turn indicator */}
      <div className={`mb-4 p-3 rounded-xl text-center ${
        isMyTurn 
          ? 'bg-neon-green/10 border border-neon-green/30' 
          : 'bg-card border border-border'
      }`}>
        {amEliminated ? (
          <p className="text-destructive">You've been eliminated! 😔</p>
        ) : isMyTurn ? (
          <div>
            <p className="text-neon-green font-semibold mb-1">Your turn!</p>
            {requiredLetter && (
              <p className="text-sm">
                Enter a word starting with "<span className="text-primary font-bold">{requiredLetter}</span>"
              </p>
            )}
            {!requiredLetter && (
              <p className="text-sm text-muted-foreground">Enter any word to start!</p>
            )}
          </div>
        ) : (
          <p className="text-muted-foreground">
            Waiting for <span className="text-primary">{currentPlayer?.username}</span>...
          </p>
        )}

        {/* Turn timer */}
        {turnTimeRemaining !== null && gameState.gameStarted && !amEliminated && (
          <div className="mt-2 flex items-center justify-center gap-2">
            <Clock className={`w-4 h-4 ${turnTimeRemaining <= 10 ? 'text-destructive' : 'text-muted-foreground'}`} />
            <span className={`text-sm font-mono ${turnTimeRemaining <= 10 ? 'text-destructive' : ''}`}>
              {turnTimeRemaining}s
            </span>
          </div>
        )}
      </div>

      {/* Players status bar */}
      <div className="flex flex-wrap gap-2 mb-4">
        {gameState.players
          .filter((p) => p.status === 'joined')
          .map((player) => {
            const isCurrentPlayer = player.id === currentPlayer?.id;
            const isEliminated = gameState.eliminatedPlayers.includes(player.id);
            return (
              <div
                key={player.id}
                className={`px-3 py-1 rounded-full text-xs flex items-center gap-1 ${
                  isEliminated
                    ? 'bg-destructive/20 text-destructive line-through'
                    : isCurrentPlayer
                    ? 'bg-primary/20 text-primary border border-primary/50'
                    : 'bg-muted/30 text-muted-foreground'
                }`}
              >
                {player.username}
                <span className="opacity-60">({player.wordsPlayed})</span>
              </div>
            );
          })}
      </div>

      {/* Word chain display */}
      <ScrollArea className="flex-1 mb-4 p-3 rounded-xl bg-card/50 border border-border">
        <div className="space-y-2">
          {gameState.words.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              No words yet. {isMyTurn ? 'You start!' : 'Waiting for first word...'}
            </p>
          ) : (
            gameState.words.map((entry, index) => {
              const player = gameState.players.find((p) => p.id === entry.playerId);
              const isMe = entry.playerId === user?.id;
              return (
                <div
                  key={index}
                  className={`flex items-center gap-2 p-2 rounded-lg ${
                    isMe ? 'bg-primary/10' : 'bg-muted/20'
                  }`}
                >
                  <span className="text-xs text-muted-foreground w-6">{index + 1}.</span>
                  <span className={`font-medium ${isMe ? 'text-primary' : ''}`}>
                    {entry.word}
                  </span>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {player?.username}
                  </span>
                </div>
              );
            })
          )}
          <div ref={wordsEndRef} />
        </div>
      </ScrollArea>

      {/* Error message */}
      {error && (
        <div className="mb-2 p-2 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm text-center">
          {error}
        </div>
      )}

      {/* Input area */}
      {!amEliminated && (
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            value={wordInput}
            onChange={(e) => setWordInput(e.target.value)}
            placeholder={requiredLetter ? `Word starting with ${requiredLetter}...` : 'Enter a word...'}
            disabled={!isMyTurn || isSubmitting}
            className="flex-1"
            autoComplete="off"
          />
          <Button 
            type="submit" 
            variant="neon" 
            disabled={!isMyTurn || isSubmitting || !wordInput.trim()}
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleSkip}
            disabled={!isMyTurn}
            title="Skip (eliminates you)"
          >
            <SkipForward className="w-4 h-4" />
          </Button>
        </form>
      )}

      {/* End game button */}
      <Button
        variant="ghost"
        className="mt-4 text-muted-foreground"
        onClick={onEndGame}
      >
        Leave Game
      </Button>
    </div>
  );
};

export default WordChainGame;
