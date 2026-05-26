import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Search, Loader2, Users, X, UserPlus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface UserResult {
  id: string;
  username: string;
  avatar_url: string | null;
  status: string | null;
}

interface NewGroupDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSearch: (userId: string) => Promise<UserResult[]>;
  onCreateGroup: (userIds: string[], groupName: string) => Promise<void>;
}

const NewGroupDialog = ({ isOpen, onClose, onSearch, onCreateGroup }: NewGroupDialogProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<UserResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<UserResult[]>([]);
  const [groupName, setGroupName] = useState('');

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setLoading(true);
    try {
      const users = await onSearch(searchQuery.trim());
      // Filter out already selected users
      const filteredUsers = users.filter(
        u => !selectedUsers.some(selected => selected.id === u.id)
      );
      setResults(filteredUsers);
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = (user: UserResult) => {
    setSelectedUsers(prev => [...prev, user]);
    setResults([]); // Clear search results
    setSearchQuery('');
  };

  const handleRemoveUser = (userId: string) => {
    setSelectedUsers(prev => prev.filter(u => u.id !== userId));
  };

  const handleCreateGroup = async () => {
    if (selectedUsers.length < 1) return;
    
    setCreating(true);
    try {
      const finalGroupName = groupName.trim() || selectedUsers.map(u => u.username).join(', ');
      await onCreateGroup(selectedUsers.map(u => u.id), finalGroupName);
      handleClose();
    } finally {
      setCreating(false);
    }
  };

  const handleClose = () => {
    onClose();
    setSearchQuery('');
    setResults([]);
    setSelectedUsers([]);
    setGroupName('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-foreground flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Create New Group
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Add members by searching their user ID
          </p>
        </DialogHeader>

        <div className="space-y-4">
          {/* Group Name Input */}
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">
              Group Name (optional)
            </label>
            <Input
              placeholder="Enter group name..."
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="bg-background border-border"
            />
          </div>

          {/* Selected Users */}
          {selectedUsers.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">
                Members ({selectedUsers.length})
              </label>
              <div className="flex flex-wrap gap-2">
                {selectedUsers.map((user) => (
                  <Badge
                    key={user.id}
                    variant="secondary"
                    className="flex items-center gap-2 pl-1 pr-2 py-1"
                  >
                    <Avatar className="w-5 h-5">
                      <AvatarImage src={user.avatar_url || ''} />
                      <AvatarFallback className="text-[10px] bg-primary text-primary-foreground">
                        {user.username.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs">{user.username}</span>
                    <button
                      onClick={() => handleRemoveUser(user.id)}
                      className="ml-1 hover:text-destructive transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Search Input */}
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">
              Search by User ID
            </label>
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
          </div>

          {/* Search Results */}
          {results.length > 0 && (
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {results.map((user) => (
                <button
                  key={user.id}
                  onClick={() => handleAddUser(user)}
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
                  <UserPlus className="w-5 h-5 text-primary" />
                </button>
              ))}
            </div>
          )}

          {results.length === 0 && searchQuery && !loading && (
            <p className="text-center text-muted-foreground py-2 text-sm">
              No user found. Check the ID and try again.
            </p>
          )}

          {/* Create Group Button */}
          <Button
            onClick={handleCreateGroup}
            disabled={selectedUsers.length < 1 || creating}
            className="w-full"
            variant="neon"
          >
            {creating ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Users className="w-4 h-4 mr-2" />
            )}
            Create Group {selectedUsers.length > 0 && `(${selectedUsers.length} members)`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NewGroupDialog;
