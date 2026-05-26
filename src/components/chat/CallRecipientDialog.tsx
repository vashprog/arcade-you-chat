import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Phone, Video } from 'lucide-react';

export interface CallRecipient {
  id: string;
  username: string;
  avatar_url?: string | null;
  status?: string | null;
}

interface CallRecipientDialogProps {
  isOpen: boolean;
  onClose: () => void;
  recipients: CallRecipient[];
  callType: 'audio' | 'video';
  onSelectRecipient: (recipientId: string) => void;
}

const CallRecipientDialog = ({
  isOpen,
  onClose,
  recipients,
  callType,
  onSelectRecipient,
}: CallRecipientDialogProps) => {
  const CallIcon = callType === 'video' ? Video : Phone;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-card border-border">
        <DialogHeader>
          <DialogTitle className="font-display text-foreground flex items-center gap-2">
            <CallIcon className="w-5 h-5 text-primary" />
            Choose who to call
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-2 max-h-72 overflow-y-auto scrollbar-neon">
          {recipients.map((recipient) => (
            <button
              key={recipient.id}
              onClick={() => onSelectRecipient(recipient.id)}
              className="w-full p-3 rounded-xl flex items-center gap-3 bg-background hover:bg-primary/10 transition-colors border border-border"
            >
              <div className="relative shrink-0">
                <Avatar className="w-10 h-10 border-2 border-border">
                  <AvatarImage src={recipient.avatar_url || ''} />
                  <AvatarFallback className="bg-gradient-to-br from-primary to-secondary text-primary-foreground font-display">
                    {recipient.username.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                {recipient.status === 'online' && (
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-neon-green rounded-full border-2 border-background" />
                )}
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="font-semibold text-foreground truncate">{recipient.username}</p>
                <p className="text-xs text-muted-foreground">
                  {recipient.status === 'online' ? 'Online' : 'Offline'}
                </p>
              </div>
              <CallIcon className="w-5 h-5 text-primary shrink-0" />
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CallRecipientDialog;