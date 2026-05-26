import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  MessageSquare,
  Send,
  X,
  ChevronDown,
  Smile,
} from 'lucide-react';
import { useMessages, Message } from '@/hooks/useMessages';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

interface MobileChatOverlayProps {
  conversationId: string | null;
  conversationName: string;
}

const MobileChatOverlay = ({ conversationId, conversationName }: MobileChatOverlayProps) => {
  const { user } = useAuth();
  const { messages, sendMessage } = useMessages(conversationId);
  const [isExpanded, setIsExpanded] = useState(false);
  const [message, setMessage] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastMessageCountRef = useRef(messages.length);

  // Track new messages when collapsed
  useEffect(() => {
    if (!isExpanded && messages.length > lastMessageCountRef.current) {
      const newMessages = messages.slice(lastMessageCountRef.current);
      const otherUserMessages = newMessages.filter(m => m.senderId !== user?.id);
      setUnreadCount(prev => prev + otherUserMessages.length);
    }
    lastMessageCountRef.current = messages.length;
  }, [messages, isExpanded, user?.id]);

  // Clear unread when expanded
  useEffect(() => {
    if (isExpanded) {
      setUnreadCount(0);
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isExpanded]);

  // Scroll to bottom when new messages arrive while expanded
  useEffect(() => {
    if (isExpanded) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isExpanded]);

  const handleSend = async () => {
    if (message.trim()) {
      await sendMessage(message.trim(), 'text');
      setMessage('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (!conversationId) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 pointer-events-none">
      <div className="pointer-events-auto">
        {/* Expanded Chat View */}
        {isExpanded ? (
          <div className="bg-card/95 backdrop-blur-xl border-t border-border animate-in slide-in-from-bottom duration-200">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-border/50">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-primary" />
                <span className="font-medium text-sm">{conversationName}</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsExpanded(false)}
                className="h-7 w-7"
              >
                <ChevronDown className="w-4 h-4" />
              </Button>
            </div>

            {/* Messages */}
            <ScrollArea className="h-40 px-3 py-2">
              <div className="space-y-2">
                {messages.slice(-20).map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      'flex',
                      msg.senderId === user?.id ? 'justify-end' : 'justify-start'
                    )}
                  >
                    <div
                      className={cn(
                        'max-w-[80%] px-3 py-1.5 rounded-2xl text-sm',
                        msg.senderId === user?.id
                          ? 'bg-primary text-primary-foreground rounded-br-md'
                          : 'bg-muted text-foreground rounded-bl-md'
                      )}
                    >
                      <p className="break-words">{msg.content}</p>
                      <p className={cn(
                        'text-[10px] mt-0.5',
                        msg.senderId === user?.id ? 'text-primary-foreground/70' : 'text-muted-foreground'
                      )}>
                        {formatTime(msg.timestamp.toISOString())}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Input */}
            <div className="flex items-center gap-2 p-2 border-t border-border/50">
              <Input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type a message..."
                className="flex-1 h-9 text-sm bg-input/50"
              />
              <Button
                onClick={handleSend}
                disabled={!message.trim()}
                size="icon"
                className="h-9 w-9 shrink-0"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ) : (
          /* Collapsed Chat Button */
          <div className="flex justify-center pb-3 px-4">
            <Button
              onClick={() => setIsExpanded(true)}
              variant="glass"
              className="relative gap-2 px-4 py-2 h-10 shadow-lg border border-border/50"
            >
              <MessageSquare className="w-4 h-4" />
              <span className="text-sm font-medium">Chat</span>
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] bg-destructive text-destructive-foreground text-xs font-bold rounded-full flex items-center justify-center px-1">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MobileChatOverlay;
