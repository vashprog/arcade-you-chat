import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Phone, PhoneOff, Video } from 'lucide-react';

interface IncomingCallModalProps {
  callerName: string;
  callerAvatar?: string;
  callType: 'audio' | 'video';
  onAccept: () => void;
  onReject: () => void;
}

const IncomingCallModal = ({
  callerName,
  callerAvatar,
  callType,
  onAccept,
  onReject,
}: IncomingCallModalProps) => {
  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-xl flex items-center justify-center animate-fade-in">
      <div className="bg-card border border-border rounded-3xl p-8 shadow-2xl max-w-sm w-full mx-4 animate-scale-in">
        {/* Caller Info */}
        <div className="text-center mb-8">
          <div className="relative inline-block mb-4">
            <Avatar className="w-24 h-24 border-4 border-primary/30 animate-pulse">
              <AvatarImage src={callerAvatar} />
              <AvatarFallback className="bg-gradient-to-br from-primary to-secondary text-primary-foreground font-display text-3xl">
                {callerName.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-neon-green rounded-full flex items-center justify-center animate-bounce">
              {callType === 'video' ? (
                <Video className="w-4 h-4 text-background" />
              ) : (
                <Phone className="w-4 h-4 text-background" />
              )}
            </div>
          </div>
          
          <h2 className="font-display text-2xl text-foreground mb-1">
            {callerName}
          </h2>
          <p className="text-muted-foreground font-body">
            Incoming {callType} call...
          </p>
        </div>

        {/* Audio visualization for ringing */}
        <div className="flex justify-center gap-1 mb-8">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="w-1 bg-primary rounded-full animate-pulse"
              style={{
                height: `${Math.random() * 24 + 8}px`,
                animationDelay: `${i * 0.15}s`,
                animationDuration: '0.6s',
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
            <PhoneOff className="w-7 h-7" />
          </Button>
          
          <Button
            size="icon"
            className="w-16 h-16 rounded-full bg-neon-green hover:bg-neon-green/90 text-background shadow-lg shadow-neon-green/30 hover:scale-110 transition-transform"
            onClick={onAccept}
          >
            <Phone className="w-7 h-7" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default IncomingCallModal;
