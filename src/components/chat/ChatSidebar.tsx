import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useConversations } from '@/hooks/useConversations';
import { useMobileLayout } from '@/hooks/useMobileLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import NewChatDialog from './NewChatDialog';
import NewGroupDialog from './NewGroupDialog';
import {
  Zap,
  Search,
  Plus,
  Settings,
  LogOut,
  Gamepad2,
  Users,
  Loader2,
  X,
} from 'lucide-react';
import type { Conversation } from '@/pages/Chat';

interface ChatSidebarProps {
  activeConversation: Conversation | null;
  onSelectConversation: (conversation: Conversation) => void;
  onShowGames: () => void;
}

const ChatSidebar = ({ activeConversation, onSelectConversation, onShowGames }: ChatSidebarProps) => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { conversations, loading, createConversation, createGroupConversation, findUserById } = useConversations();
  const { isMobile, setSidebarOpen } = useMobileLayout();
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewChat, setShowNewChat] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [profileUsername, setProfileUsername] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.username) setProfileUsername(data.username);
      });
  }, [user?.id]);

  const filteredConversations = conversations.filter((conv) =>
    conv.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleNewChat = async (userId: string) => {
    const conversation = await createConversation(userId);
    if (conversation) {
      onSelectConversation(conversation);
    }
  };

  const handleNewGroup = async (userIds: string[], groupName: string) => {
    const conversation = await createGroupConversation(userIds, groupName);
    if (conversation) {
      onSelectConversation(conversation);
    }
  };

  const handleCloseSidebar = () => {
    setSidebarOpen(false);
  };

  return (
    <div className="w-80 max-w-full h-full bg-sidebar border-r border-sidebar-border flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Zap className="w-6 h-6 text-primary" />
            <span className="font-display text-lg font-bold text-foreground">ArcadeUChat</span>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={onShowGames}>
              <Gamepad2 className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => navigate('/profile')}>
              <Settings className="w-5 h-5" />
            </Button>
            {/* Mobile close button */}
            {isMobile && (
              <Button variant="ghost" size="icon" onClick={handleCloseSidebar}>
                <X className="w-5 h-5" />
              </Button>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-sidebar-accent border-sidebar-border"
          />
        </div>
      </div>

      {/* Quick Actions */}
      <div className="p-3 border-b border-sidebar-border">
        <div className="flex gap-2">
          <Button 
            variant="glass" 
            size="sm" 
            className="flex-1 text-xs"
            onClick={() => setShowNewChat(true)}
          >
            <Plus className="w-4 h-4 mr-1" />
            New Chat
          </Button>
          <Button 
            variant="glass" 
            size="sm" 
            className="flex-1 text-xs"
            onClick={() => setShowNewGroup(true)}
          >
            <Users className="w-4 h-4 mr-1" />
            New Group
          </Button>
        </div>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto scrollbar-neon">
        <div className="p-2">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">No conversations yet</p>
              <p className="text-xs mt-1">Click "New Chat" to start chatting!</p>
            </div>
          ) : (
            filteredConversations.map((conversation, index) => (
              <button
                key={conversation.id}
                onClick={() => onSelectConversation(conversation)}
                className={`w-full p-3 rounded-xl flex items-center gap-3 transition-all duration-200 mb-1 animate-fade-in-up ${
                  activeConversation?.id === conversation.id
                    ? 'bg-primary/20 border border-primary/30'
                    : 'hover:bg-sidebar-accent'
                }`}
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <div className="relative shrink-0">
                  <Avatar className="w-12 h-12 border-2 border-sidebar-border">
                    <AvatarImage src={conversation.avatar} />
                    <AvatarFallback className="bg-gradient-to-br from-primary to-secondary text-primary-foreground font-display">
                      {conversation.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  {conversation.isOnline && (
                    <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-neon-green rounded-full border-2 border-sidebar" />
                  )}
                </div>

                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="font-semibold text-foreground truncate">
                      {conversation.name}
                    </span>
                    <span className="text-xs text-muted-foreground shrink-0 ml-2">
                      {conversation.timestamp}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground truncate">
                    {conversation.lastMessage}
                  </p>
                </div>

                {conversation.unread != null && conversation.unread > 0 ? (
                  <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-secondary-foreground">
                      {conversation.unread}
                    </span>
                  </div>
                ) : null}
              </button>
            ))
          )}
        </div>
      </div>

      {/* User Profile */}
      <div className="p-3 border-t border-sidebar-border">
        <div className="flex items-center gap-3 p-2 rounded-xl bg-sidebar-accent">
          <Avatar 
            className="w-10 h-10 border-2 border-primary/30 cursor-pointer hover:border-primary transition-colors shrink-0"
            onClick={() => navigate('/profile')}
          >
            <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-primary-foreground font-display">
              {(profileUsername || user?.email)?.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground text-sm truncate">
              {profileUsername || user?.email?.split('@')[0]}
            </p>
            <p className="text-xs text-neon-green flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-neon-green" />
              Online
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={signOut}
            className="text-muted-foreground hover:text-destructive shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* New Chat Dialog */}
      <NewChatDialog
        isOpen={showNewChat}
        onClose={() => setShowNewChat(false)}
        onSearch={findUserById}
        onSelectUser={handleNewChat}
      />

      {/* New Group Dialog */}
      <NewGroupDialog
        isOpen={showNewGroup}
        onClose={() => setShowNewGroup(false)}
        onSearch={findUserById}
        onCreateGroup={handleNewGroup}
      />
    </div>
  );
};

export default ChatSidebar;
