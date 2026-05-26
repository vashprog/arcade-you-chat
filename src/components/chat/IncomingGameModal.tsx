import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { X, Gamepad2 } from 'lucide-react';

interface IncomingGameModalProps {
  inviterName: string;
  inviterAvatar?: string | null;
  gameType: string;
  onAccept: () => void;
  onReject: () => void;
}

const gameDisplayNames: Record<string, { name: string; emoji: string }> = {
  'truth-or-dare': { name: 'Truth or Dare', emoji: '🎯' },
  'would-you-rather': { name: 'Would You Rather', emoji: '🤔' },
  'love-quiz': { name: 'Love Quiz', emoji: '💕' },
  'dream-date': { name: 'Dream Date Builder', emoji: '✨' },
  'trivia': { name: 'Trivia Challenge', emoji: '🧠' },
  'word-chain': { name: 'Word Chain', emoji: '🔗' },
  'dice-roll': { name: 'Dice Roll', emoji: '🎲' },
  'card-game': { name: 'Card Game', emoji: '🃏' },
};

const IncomingGameModal = ({
  inviterName,
  inviterAvatar,
  gameType,
  onAccept,
  onReject,
}: IncomingGameModalProps) => {
  const gameInfo = gameDisplayNames[gameType] || { name: gameType, emoji: '🎮' };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-xl flex items-center justify-center animate-fade-in">
      <div className="bg-card border border-border rounded-3xl p-8 shadow-2xl max-w-sm w-full mx-4 animate-scale-in">
        {/* Inviter Info */}
        <div className="text-center mb-8">
          <div className="relative inline-block mb-4">
            <Avatar className="w-24 h-24 border-4 border-primary/30">
              <AvatarImage src={inviterAvatar || undefined} />
              <AvatarFallback className="bg-gradient-to-br from-primary to-secondary text-primary-foreground font-display text-3xl">
                {inviterName.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div className="absolute -bottom-1 -right-1 w-10 h-10 bg-primary rounded-full flex items-center justify-center text-xl">
              {gameInfo.emoji}
            </div>
          </div>

          <h2 className="font-display text-2xl text-foreground mb-1">
            {inviterName}
          </h2>
          <p className="text-muted-foreground font-body mb-4">
            wants to play
          </p>
          
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/30">
            <Gamepad2 className="w-5 h-5 text-primary" />
            <span className="font-display text-primary">{gameInfo.name}</span>
          </div>
        </div>

        {/* Game icon animation */}
        <div className="flex justify-center gap-2 mb-8">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="w-3 h-3 bg-primary rounded-full animate-bounce"
              style={{
                animationDelay: `${i * 0.15}s`,
              }}
            />
          ))}
        </div>

        {/* Action Buttons */}
        <div className="flex justify-center gap-6">
          <Button
            variant="destructive"
            size="icon"
            className="w-16 h-16 rounded-full shadow-lg shadow-destructive/30 hover:scale-110 transition-transform"
            onClick={onReject}
          >
            <X className="w-7 h-7" />
          </Button>

          <Button
            size="icon"
            className="w-16 h-16 rounded-full bg-neon-green hover:bg-neon-green/90 text-background shadow-lg shadow-neon-green/30 hover:scale-110 transition-transform"
            onClick={onAccept}
          >
            <Gamepad2 className="w-7 h-7" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default IncomingGameModal;
