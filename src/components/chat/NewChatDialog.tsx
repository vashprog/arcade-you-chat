import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Search, Loader2, MessageCircle } from 'lucide-react';

interface UserResult {
  id: string;
  username: string;
  avatar_url: string | null;
  status: string | null;
}

interface NewChatDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSearch: (userId: string) => Promise<UserResult[]>;
  onSelectUser: (userId: string) => Promise<void>;
}

const NewChatDialog = ({ isOpen, onClose, onSearch, onSelectUser }: NewChatDialogProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<UserResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selecting, setSelecting] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setLoading(true);
    try {
      const users = await onSearch(searchQuery.trim());
      setResults(users);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectUser = async (userId: string) => {
    setSelecting(userId);
    try {
      await onSelectUser(userId);
      onClose();
      setSearchQuery('');
      setResults([]);
    } finally {
      setSelecting(null);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-card border-border">
        <DialogHeader>
          <DialogTitle className="font-display text-foreground flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-primary" />
            Start New Chat
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Enter the user ID to start a conversation
          </p>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Enter user ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                className="pl-10 bg-background border-border font-mono text-sm"
              />
            </div>
            <Button onClick={handleSearch} disabled={loading || !searchQuery.trim()}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Find'}
            </Button>
          </div>

          {results.length > 0 && (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {results.map((user) => (
                <button
                  key={user.id}
                  onClick={() => handleSelectUser(user.id)}
                  disabled={selecting === user.id}
                  className="w-full p-3 rounded-xl flex items-center gap-3 bg-background hover:bg-primary/10 transition-colors border border-border"
                >
                  <div className="relative">
                    <Avatar className="w-10 h-10 border-2 border-border">
                      <AvatarImage src={user.avatar_url || ''} />
                      <AvatarFallback className="bg-gradient-to-br from-primary to-secondary text-primary-foreground font-display">
                        {user.username.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    {user.status === 'online' && (
                      <div className="absolute bottom-0 right-0 w-3 h-3 bg-neon-green rounded-full border-2 border-background" />
                    )}
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-semibold text-foreground">{user.username}</p>
                    <p className="text-xs text-muted-foreground">
                      {user.status === 'online' ? 'Online' : 'Offline'}
                    </p>
                  </div>
                  {selecting === user.id ? (
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  ) : (
                    <MessageCircle className="w-5 h-5 text-primary" />
                  )}
                </button>
              ))}
            </div>
          )}

          {results.length === 0 && searchQuery && !loading && (
            <p className="text-center text-muted-foreground py-4">
              No user found with this ID. Check the ID and try again.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NewChatDialog;
