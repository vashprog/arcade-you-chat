import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useMessages, Message } from '@/hooks/useMessages';
import { useMobileLayout } from '@/hooks/useMobileLayout';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import MessageInput from './MessageInput';
import EmojiPicker from './EmojiPicker';
import GifPicker from './GifPicker';
import StickerPicker from './StickerPicker';
import AudioPlayer from './AudioPlayer';
import {
  Phone,
  Video,
  MoreVertical,
  Gamepad2,
  MessageSquare,
  Loader2,
  Trash2,
  FileText,
  Download,
  Menu,
} from 'lucide-react';
import type { Conversation } from '@/pages/Chat';
import { toast } from 'sonner';

interface ChatMainProps {
  conversation: Conversation | null;
  onStartCall: (type: 'audio' | 'video') => void;
  onShowGames: () => void;
  onDeleteConversation: (conversationId: string) => void;
}

const ChatMain = ({ conversation, onStartCall, onShowGames, onDeleteConversation }: ChatMainProps) => {
  const { user } = useAuth();
  const { messages, loading, sendMessage, deleteMessage } = useMessages(conversation?.id || null);
  const { isMobile, toggleSidebar } = useMobileLayout();
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (content: string, type: Message['type'] = 'text', mediaUrl?: string) => {
    await sendMessage(content, type, mediaUrl);
    setShowEmojiPicker(false);
    setShowGifPicker(false);
    setShowStickerPicker(false);
  };

  const handleDeleteMessage = async (messageId: string) => {
    const success = await deleteMessage(messageId);
    if (success) {
      toast.success('Message deleted');
    } else {
      toast.error('Failed to delete message');
    }
  };

  const handleDeleteConversation = () => {
    if (conversation) {
      onDeleteConversation(conversation.id);
    }
  };

  if (!conversation) {
    return (
      <div className="h-full flex flex-col bg-background/50">
        {/* Mobile header with menu */}
        {isMobile && (
          <div className="h-14 px-3 flex items-center border-b border-border bg-card/50 backdrop-blur-xl shrink-0">
            <Button variant="ghost" size="icon" onClick={toggleSidebar}>
              <Menu className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2 ml-2">
              <MessageSquare className="w-5 h-5 text-primary" />
              <span className="font-display text-lg font-bold">ArcadeUChat</span>
            </div>
          </div>
        )}
        
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center animate-fade-in-up px-4">
            <div className="w-20 h-20 sm:w-24 sm:h-24 mx-auto mb-4 sm:mb-6 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
              <MessageSquare className="w-10 h-10 sm:w-12 sm:h-12 text-primary" />
            </div>
            <h2 className="font-display text-xl sm:text-2xl font-bold text-foreground mb-2">
              Welcome to ArcadeUChat
            </h2>
            <p className="text-muted-foreground font-body max-w-sm text-sm sm:text-base">
              Select a conversation from the sidebar to start chatting, or create a new one!
            </p>
            {isMobile && (
              <Button variant="neon" className="mt-4" onClick={toggleSidebar}>
                <Menu className="w-4 h-4 mr-2" />
                Open Chats
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background/30 relative min-h-0">
      {/* Header */}
      <div className="h-14 px-2 sm:px-3 flex items-center justify-between border-b border-border bg-card/50 backdrop-blur-xl shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          {/* Mobile menu button */}
          {isMobile && (
            <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8" onClick={toggleSidebar}>
              <Menu className="w-5 h-5" />
            </Button>
          )}
          <div className="relative shrink-0">
            <Avatar className="w-8 h-8 border-2 border-primary/30">
              <AvatarImage src={conversation.avatar} />
              <AvatarFallback className="bg-gradient-to-br from-primary to-secondary text-primary-foreground font-display text-sm">
                {conversation.name.charAt(0)}
              </AvatarFallback>
            </Avatar>
            {conversation.isOnline && (
              <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-neon-green rounded-full border-2 border-card" />
            )}
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-foreground text-sm truncate max-w-[120px] sm:max-w-none">{conversation.name}</h3>
            <p className="text-xs text-neon-green">
              {conversation.isOnline ? 'Online' : 'Offline'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
          <Button
            variant="glass"
            size="icon"
            className="h-8 w-8"
            onClick={() => onStartCall('audio')}
          >
            <Phone className="w-4 h-4 text-neon-green" />
          </Button>
          <Button
            variant="glass"
            size="icon"
            className="h-8 w-8"
            onClick={() => onStartCall('video')}
          >
            <Video className="w-4 h-4 text-primary" />
          </Button>
          <Button
            variant="glass"
            size="icon"
            className="h-8 w-8"
            onClick={onShowGames}
          >
            <Gamepad2 className="w-4 h-4 text-secondary" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-popover border-border">
              <DropdownMenuItem 
                onClick={handleDeleteConversation}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Chat
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-2 sm:p-4 scrollbar-neon">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <p className="text-sm sm:text-base text-center px-4">No messages yet. Send one to start the conversation!</p>
          </div>
        ) : (
          <div className="space-y-3 sm:space-y-4">
            {messages.map((message, index) => {
              const isOwn = message.senderId === user?.id;
              return (
                <div
                  key={message.id}
                  className={`flex ${isOwn ? 'justify-end' : 'justify-start'} animate-fade-in-up group`}
                  style={{ animationDelay: `${index * 0.02}s` }}
                >
                  <div className={`flex items-center gap-1 sm:gap-2 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
                    <div
                      className={`max-w-[85%] sm:max-w-[70%] ${
                        isOwn
                          ? 'bg-gradient-to-r from-primary to-primary/80 text-primary-foreground'
                          : 'bg-card border border-border'
                      } rounded-2xl ${
                        message.type === 'gif' || message.type === 'sticker' ? 'p-1' : 'px-3 py-2 sm:px-4 sm:py-3'
                      } shadow-lg ${isOwn ? 'shadow-primary/20' : 'shadow-border/10'}`}
                    >
                    {message.type === 'gif' && message.mediaUrl ? (
                        <img
                          src={message.mediaUrl}
                          alt="GIF"
                          className="w-[140px] sm:w-[180px] max-w-full rounded-xl object-cover"
                        />
                      ) : message.type === 'sticker' ? (
                        message.mediaUrl?.startsWith('http') ? (
                          <img
                            src={message.mediaUrl}
                            alt="Sticker"
                            className="w-[80px] sm:w-[100px] max-w-full rounded-xl object-cover"
                          />
                        ) : (
                          <span className="text-3xl sm:text-4xl">{message.content || message.mediaUrl}</span>
                        )
                      ) : message.type === 'image' && message.mediaUrl ? (
                        <img
                          src={message.mediaUrl}
                          alt={message.content}
                          className="w-[160px] sm:w-[200px] max-w-full rounded-xl cursor-pointer object-cover"
                          onClick={() => window.open(message.mediaUrl, '_blank')}
                        />
                      ) : message.type === 'audio' && message.mediaUrl ? (
                        <AudioPlayer src={message.mediaUrl} isOwn={isOwn} />
                      ) : message.type === 'document' && message.mediaUrl ? (
                        <a 
                          href={message.mediaUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className={`flex items-center gap-2 sm:gap-3 p-2 rounded-lg ${
                            isOwn ? 'bg-primary-foreground/10 hover:bg-primary-foreground/20' : 'bg-muted/50 hover:bg-muted'
                          } transition-colors`}
                        >
                          <div className={`p-1.5 sm:p-2 rounded-lg ${isOwn ? 'bg-primary-foreground/20' : 'bg-primary/20'}`}>
                            <FileText className={`h-4 w-4 sm:h-5 sm:w-5 ${isOwn ? 'text-primary-foreground' : 'text-primary'}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-xs sm:text-sm font-medium truncate ${isOwn ? 'text-primary-foreground' : 'text-foreground'}`}>
                              {message.content}
                            </p>
                            <p className={`text-xs ${isOwn ? 'text-primary-foreground/60' : 'text-muted-foreground'} hidden sm:block`}>
                              Click to download
                            </p>
                          </div>
                          <Download className={`h-4 w-4 shrink-0 ${isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'}`} />
                        </a>
                      ) : (
                        <p className="font-body text-sm sm:text-base">{message.content}</p>
                      )}
                      <p
                        className={`text-[10px] sm:text-xs mt-1 ${
                          isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'
                        }`}
                      >
                        {message.timestamp.toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                    {isOwn && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 sm:h-8 sm:w-8"
                          >
                            <MoreVertical className="w-3 h-3 sm:w-4 sm:h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align={isOwn ? 'end' : 'start'} className="bg-popover border-border">
                          <DropdownMenuItem 
                            onClick={() => handleDeleteMessage(message.id)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete Message
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Pickers */}
      {showEmojiPicker && (
        <EmojiPicker
          onSelect={(emoji) => handleSendMessage(emoji)}
          onClose={() => setShowEmojiPicker(false)}
        />
      )}
      {showGifPicker && (
        <GifPicker
          onSelect={(gifUrl) => handleSendMessage(gifUrl, 'gif', gifUrl)}
          onClose={() => setShowGifPicker(false)}
        />
      )}
      {showStickerPicker && (
        <StickerPicker
          onSelect={(stickerUrl) => handleSendMessage(stickerUrl, 'sticker', stickerUrl)}
          onClose={() => setShowStickerPicker(false)}
        />
      )}

      {/* Message Input */}
      <MessageInput
        onSendMessage={handleSendMessage}
        onToggleEmoji={() => {
          setShowEmojiPicker(!showEmojiPicker);
          setShowGifPicker(false);
          setShowStickerPicker(false);
        }}
        onToggleGif={() => {
          setShowGifPicker(!showGifPicker);
          setShowEmojiPicker(false);
          setShowStickerPicker(false);
        }}
        onToggleSticker={() => {
          setShowStickerPicker(!showStickerPicker);
          setShowEmojiPicker(false);
          setShowGifPicker(false);
        }}
      />
    </div>
  );
};

export default ChatMain;
