import { Button } from '@/components/ui/button';
import { PhoneOff, Gamepad2 } from 'lucide-react';

interface IncomingCardGameModalProps {
  hostName: string;
  onAccept: () => void;
  onReject: () => void;
}

const IncomingCardGameModal = ({ hostName, onAccept, onReject }: IncomingCardGameModalProps) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-fade-in">
      <div className="relative bg-card border border-border rounded-2xl p-8 shadow-2xl max-w-sm mx-4 animate-scale-in">
        <div className="absolute inset-0 rounded-2xl overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-secondary/20 to-primary/20 animate-pulse" />
        </div>

        <div className="relative text-center">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-secondary to-primary flex items-center justify-center animate-bounce">
            <span className="text-4xl">🃏</span>
          </div>

          <h2 className="font-display text-xl mb-1 text-foreground">Card Game! 🃏</h2>
          <p className="text-muted-foreground mb-6 font-body">
            {hostName} invited you to play
          </p>

          <div className="flex gap-4 justify-center">
            <Button
              variant="destructive"
              size="lg"
              className="w-16 h-16 rounded-full"
              onClick={onReject}
            >
              <PhoneOff className="w-6 h-6" />
            </Button>
            <Button
              variant="neon"
              size="lg"
              className="w-16 h-16 rounded-full"
              onClick={onAccept}
            >
              <Gamepad2 className="w-6 h-6" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IncomingCardGameModal;
