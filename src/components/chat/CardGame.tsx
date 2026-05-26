import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Trophy,
  Users,
  Clock,
  Crown,
  Sparkles,
  Loader2,
  Zap,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import type { CardGameState, CardGamePlayer, CardDraw } from '@/hooks/useCardGame';

interface CardGameProps {
  cardGameState: CardGameState | null;
  lobbyCountdown: number | null;
  currentTurn: string | null;
  onDrawCard: () => Promise<void>;
  onNextRound: () => Promise<void>;
  onEndGame: () => Promise<void>;
  onStartGame: () => Promise<void>;
  isHost: boolean;
}

const SUITS = ['♠', '♥', '♦', '♣'];
const SUIT_COLORS = ['text-foreground', 'text-red-500', 'text-red-500', 'text-foreground'];

const getCardLabel = (value: number): string => {
  if (value === 14) return 'A';
  if (value === 13) return 'K';
  if (value === 12) return 'Q';
  if (value === 11) return 'J';
  return String(value);
};

const CardDisplay = ({
  draw,
  label,
  isRevealed,
  hasDrawn,
  isAnimating,
}: {
  draw?: CardDraw;
  label: string;
  isRevealed: boolean;
  hasDrawn: boolean;
  isAnimating?: boolean;
}) => {
  if (!isRevealed && !hasDrawn) {
    // Not drawn yet
    return (
      <div className="flex flex-col items-center gap-2">
        <div className="w-20 h-28 sm:w-24 sm:h-32 rounded-xl bg-muted/30 border-2 border-dashed border-border flex items-center justify-center">
          <span className="text-2xl text-muted-foreground">?</span>
        </div>
        <span className="text-xs sm:text-sm text-muted-foreground truncate max-w-[80px]">{label}</span>
      </div>
    );
  }

  if (!isRevealed && hasDrawn) {
    // Drawn but not revealed
    return (
      <div className="flex flex-col items-center gap-2">
        <div className="w-20 h-28 sm:w-24 sm:h-32 rounded-xl bg-gradient-to-br from-primary/40 to-secondary/40 border-2 border-neon-green/30 flex items-center justify-center shadow-lg">
          <span className="text-2xl text-neon-green">✓</span>
        </div>
        <span className="text-xs sm:text-sm text-muted-foreground truncate max-w-[80px]">{label}</span>
        <span className="text-xs text-neon-green">Drawn!</span>
      </div>
    );
  }

  if (!draw) return null;

  const suitSymbol = SUITS[draw.suit];
  const suitColor = SUIT_COLORS[draw.suit];
  const cardLabel = getCardLabel(draw.value);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className={`w-20 h-28 sm:w-24 sm:h-32 rounded-xl bg-card border-2 border-border shadow-xl flex flex-col items-center justify-center relative overflow-hidden ${isAnimating ? 'animate-scale-in' : ''}`}>
        {/* Card top-left */}
        <div className={`absolute top-1.5 left-2 ${suitColor} text-xs sm:text-sm font-bold leading-tight`}>
          <div>{cardLabel}</div>
          <div>{suitSymbol}</div>
        </div>
        {/* Center */}
        <span className={`text-3xl sm:text-4xl ${suitColor}`}>{suitSymbol}</span>
        <span className={`text-lg sm:text-xl font-bold ${suitColor} mt-0.5`}>{cardLabel}</span>
        {/* Card bottom-right */}
        <div className={`absolute bottom-1.5 right-2 ${suitColor} text-xs sm:text-sm font-bold leading-tight rotate-180`}>
          <div>{cardLabel}</div>
          <div>{suitSymbol}</div>
        </div>
      </div>
      <span className="text-xs sm:text-sm text-muted-foreground truncate max-w-[80px]">{label}</span>
    </div>
  );
};

const CardGame = ({
  cardGameState,
  lobbyCountdown,
  currentTurn,
  onDrawCard,
  onNextRound,
  onEndGame,
  onStartGame,
  isHost,
}: CardGameProps) => {
  const { user } = useAuth();
  const [isDrawing, setIsDrawing] = useState(false);

  if (!cardGameState) {
    return (
      <div className="text-center py-8 sm:py-12">
        <Loader2 className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-4 text-primary animate-spin" />
        <p className="text-muted-foreground text-sm sm:text-base">Loading game...</p>
      </div>
    );
  }

  const joinedPlayers = cardGameState.players.filter((p) => p.status === 'joined');
  const pendingPlayers = cardGameState.players.filter((p) => p.status === 'pending');

  // Lobby view
  if (!cardGameState.gameStarted) {
    return (
      <div className="text-center px-2">
        <h2 className="font-display text-2xl sm:text-3xl mb-2 gradient-text">Card Game 🃏</h2>
        <p className="text-muted-foreground mb-4 sm:mb-6 text-sm sm:text-base">Waiting for players to join...</p>

        {lobbyCountdown !== null && lobbyCountdown > 0 && (
          <div className="mb-4 sm:mb-6">
            <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 rounded-full bg-primary/10 border border-primary/30">
              <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              <span className="font-display text-primary text-sm sm:text-base">Starting in {lobbyCountdown}s</span>
            </div>
          </div>
        )}

        <div className="bg-card rounded-2xl border border-border p-4 sm:p-6 mb-4 sm:mb-6">
          <div className="flex items-center gap-2 mb-3 sm:mb-4">
            <Users className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
            <span className="font-display text-base sm:text-lg">Players ({joinedPlayers.length})</span>
          </div>

          <div className="space-y-2 sm:space-y-3 max-h-[200px] overflow-y-auto scrollbar-neon">
            {cardGameState.players.map((player) => (
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
                  {player.id === cardGameState.hostId && (
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

  // Game ended - final results
  if (cardGameState.gameEnded) {
    const sortedPlayers = [...cardGameState.players]
      .filter((p) => p.status === 'joined')
      .sort((a, b) => b.score - a.score);

    const winner = sortedPlayers[0];

    return (
      <div className="text-center px-2">
        <h2 className="font-display text-2xl sm:text-3xl mb-2 gradient-text">Game Over! 🎉</h2>

        <div className="bg-gradient-to-br from-yellow-500/20 to-orange-500/20 rounded-2xl border border-yellow-500/30 p-4 sm:p-6 mb-4 sm:mb-6">
          <Trophy className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 text-yellow-500" />
          <p className="text-xl sm:text-2xl font-display text-yellow-500 mb-1 sm:mb-2">{winner.username} Wins!</p>
          <p className="text-muted-foreground text-sm sm:text-base">with {winner.score} rounds won</p>
        </div>

        <div className="bg-card rounded-2xl border border-border p-4 sm:p-6 mb-4 sm:mb-6">
          <h3 className="font-display text-base sm:text-lg mb-3 sm:mb-4">Final Scores</h3>
          <div className="space-y-2 max-h-[200px] overflow-y-auto scrollbar-neon">
            {sortedPlayers.map((player, index) => (
              <div
                key={player.id}
                className={`flex items-center justify-between p-2 sm:p-3 rounded-xl ${
                  index === 0 ? 'bg-yellow-500/10 border border-yellow-500/30' : 'bg-muted/50'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-muted flex items-center justify-center text-xs sm:text-sm font-bold shrink-0">
                    {index + 1}
                  </span>
                  <span className="font-body text-sm sm:text-base truncate">{player.username}</span>
                  {player.id === user?.id && (
                    <span className="text-[10px] sm:text-xs text-muted-foreground">(You)</span>
                  )}
                </div>
                <span className="font-bold text-primary text-sm sm:text-base shrink-0 ml-2">{player.score}</span>
              </div>
            ))}
          </div>
        </div>

        <Button variant="neon" onClick={onEndGame} size="sm" className="sm:text-base">
          Back to Games
        </Button>
      </div>
    );
  }

  // Active game view
  const isMyTurn = currentTurn === user?.id;
  const myDraw = user ? cardGameState.currentDraws[user.id] : undefined;
  const allDrawn = joinedPlayers.every(p => cardGameState.currentDraws[p.id] !== undefined);

  // Find round winner
  let roundWinnerText: string | null = null;
  if (allDrawn) {
    let maxVal = 0;
    const winners: CardGamePlayer[] = [];
    for (const p of joinedPlayers) {
      const d = cardGameState.currentDraws[p.id];
      const v = d?.value || 0;
      if (v > maxVal) {
        maxVal = v;
        winners.length = 0;
        winners.push(p);
      } else if (v === maxVal) {
        winners.push(p);
      }
    }
    if (winners.length > 1) {
      roundWinnerText = "It's a tie! 🤝";
    } else if (winners[0]?.id === user?.id) {
      roundWinnerText = 'You win this round! 🎉';
    } else {
      roundWinnerText = `${winners[0]?.username} wins this round!`;
    }
  }

  const handleDraw = async () => {
    if (!isMyTurn || isDrawing) return;
    setIsDrawing(true);
    await onDrawCard();
    setIsDrawing(false);
  };

  return (
    <div className="text-center px-2">
      <h2 className="font-display text-2xl sm:text-3xl mb-2 gradient-text">Card Game 🃏</h2>
      <p className="text-sm text-muted-foreground mb-1">Round {cardGameState.round} • High Card Wins</p>
      <p className="text-xs text-muted-foreground/70 mb-4">Draw a card — highest value takes the round!</p>

      {/* Scoreboard */}
      <div className="flex flex-wrap justify-center gap-3 mb-6">
        {joinedPlayers.map((player) => (
          <div
            key={player.id}
            className={`p-2 sm:p-3 rounded-xl border ${
              player.id === user?.id
                ? 'bg-primary/10 border-primary/30'
                : 'bg-muted/30 border-border'
            }`}
          >
            <p className="text-xs text-muted-foreground mb-1 truncate max-w-[60px]">
              {player.id === user?.id ? 'You' : player.username}
            </p>
            <p className="text-xl font-bold text-primary">{player.score}</p>
          </div>
        ))}
      </div>

      {/* Card display */}
      <div className="flex flex-wrap justify-center gap-4 sm:gap-6 mb-6">
        {joinedPlayers.map((player) => {
          const draw = cardGameState.currentDraws[player.id];
          const hasDrawn = draw !== undefined;
          const isMe = player.id === user?.id;

          return (
            <CardDisplay
              key={player.id}
              draw={allDrawn || isMe ? draw : undefined}
              label={isMe ? 'You' : player.username}
              isRevealed={allDrawn}
              hasDrawn={hasDrawn}
              isAnimating={allDrawn}
            />
          );
        })}
      </div>

      {/* Round result */}
      {allDrawn && roundWinnerText && (
        <div className="mb-6 p-3 rounded-xl bg-card border border-border animate-scale-in">
          <p className="text-lg font-display">{roundWinnerText}</p>
        </div>
      )}

      {/* Draw button / waiting indicator */}
      <div className="mb-6">
        {allDrawn ? (
          isHost ? (
            <Button variant="neon" size="lg" onClick={onNextRound} className="min-w-[200px]">
              <Sparkles className="w-5 h-5 mr-2" />
              Next Round
            </Button>
          ) : (
            <p className="text-muted-foreground text-sm">Waiting for host to start next round...</p>
          )
        ) : isMyTurn ? (
          <Button
            variant="neon"
            size="lg"
            onClick={handleDraw}
            disabled={isDrawing}
            className="min-w-[200px]"
          >
            <Zap className="w-5 h-5 mr-2" />
            {isDrawing ? 'Drawing...' : 'Draw Card!'}
          </Button>
        ) : myDraw !== undefined ? (
          <div className="p-4 rounded-xl bg-card border border-border">
            <p className="text-muted-foreground">
              Waiting for others to draw...
            </p>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-card border border-border">
            <p className="text-muted-foreground">
              Waiting for <span className="text-primary">{joinedPlayers.find(p => p.id === currentTurn)?.username || 'opponent'}</span> to draw...
            </p>
          </div>
        )}
      </div>

      {/* End game button */}
      <Button
        variant="ghost"
        className="text-muted-foreground text-xs sm:text-sm"
        onClick={onEndGame}
        size="sm"
      >
        Leave Game
      </Button>
    </div>
  );
};

export default CardGame;
