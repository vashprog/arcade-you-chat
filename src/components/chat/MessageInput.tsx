import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Send,
  Smile,
  Mic,
  MicOff,
  Paperclip,
  Sparkles,
  Sticker,
  X,
} from 'lucide-react';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface MessageInputProps {
  onSendMessage: (content: string, type?: 'text' | 'image' | 'gif' | 'sticker' | 'audio' | 'video' | 'document', mediaUrl?: string) => void;
  onToggleEmoji: () => void;
  onToggleGif: () => void;
  onToggleSticker: () => void;
}

const MessageInput = ({
  onSendMessage,
  onToggleEmoji,
  onToggleGif,
  onToggleSticker,
}: MessageInputProps) => {
  const [message, setMessage] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const {
    isRecording,
    formattedTime,
    startRecording,
    stopRecording,
    cancelRecording,
  } = useAudioRecorder();

  const handleSend = () => {
    if (message.trim()) {
      onSendMessage(message.trim());
      setMessage('');
      inputRef.current?.focus();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleRecordAudio = async () => {
    if (isRecording) {
      // Stop recording and send
      const audioBlob = await stopRecording();
      if (audioBlob) {
        await uploadAndSendAudio(audioBlob);
      }
    } else {
      // Start recording
      const started = await startRecording();
      if (!started) {
        toast({
          title: "Microphone Access Denied",
          description: "Please allow microphone access to send voice messages.",
          variant: "destructive",
        });
      }
    }
  };

  const uploadAndSendAudio = async (audioBlob: Blob) => {
    setIsUploading(true);
    try {
      const fileName = `audio_${Date.now()}.webm`;
      const filePath = `voice-messages/${fileName}`;

      const { data, error } = await supabase.storage
        .from('chat-media')
        .upload(filePath, audioBlob, {
          contentType: audioBlob.type,
          upsert: false,
        });

      if (error) throw error;

      const { data: urlData, error: urlError } = await supabase.storage
        .from('chat-media')
        .createSignedUrl(filePath, 3600);

      if (urlError) throw urlError;

      onSendMessage('🎤 Voice message', 'audio', urlData.signedUrl);
      
      toast({
        title: "Voice message sent",
        description: "Your audio message was sent successfully.",
      });
    } catch (error) {
      console.error('Error uploading audio:', error);
      toast({
        title: "Upload Failed",
        description: "Failed to send voice message. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleCancelRecording = () => {
    cancelRecording();
    toast({
      title: "Recording cancelled",
      description: "Voice message was discarded.",
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so same file can be selected again
    e.target.value = '';

    const maxSize = 20 * 1024 * 1024; // 20MB
    if (file.size > maxSize) {
      toast({
        title: "File too large",
        description: "Maximum file size is 20MB.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `file_${Date.now()}.${fileExt}`;
      
      // Determine folder based on file type
      const isImage = file.type.startsWith('image/');
      const folder = isImage ? 'images' : 'documents';
      const filePath = `${folder}/${fileName}`;

      const { error } = await supabase.storage
        .from('chat-media')
        .upload(filePath, file, {
          contentType: file.type,
          upsert: false,
        });

      if (error) throw error;

      const { data: urlData, error: urlError } = await supabase.storage
        .from('chat-media')
        .createSignedUrl(filePath, 3600);

      if (urlError) throw urlError;

      const messageType = isImage ? 'image' : 'document';
      const displayName = file.name;
      
      onSendMessage(displayName, messageType, urlData.signedUrl);
      
      toast({
        title: isImage ? "Image sent" : "Document sent",
        description: `${displayName} was sent successfully.`,
      });
    } catch (error) {
      console.error('Error uploading file:', error);
      toast({
        title: "Upload Failed",
        description: "Failed to send file. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="p-2 border-t border-border bg-card/50 backdrop-blur-xl">
      <div className="flex items-center gap-1 sm:gap-2">
        {isRecording ? (
          // Recording UI
          <>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleCancelRecording}
              className="text-destructive hover:text-destructive/80 h-8 w-8 sm:h-10 sm:w-10"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5" />
            </Button>
            
            <div className="flex-1 flex items-center justify-center gap-2 sm:gap-3 bg-destructive/10 rounded-lg py-2 px-3 sm:px-4">
              <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-destructive rounded-full animate-pulse" />
              <span className="text-destructive font-medium text-sm sm:text-base">{formattedTime}</span>
              <span className="text-muted-foreground text-xs sm:text-sm hidden sm:inline">Recording...</span>
            </div>

            <Button
              onClick={handleRecordAudio}
              disabled={isUploading}
              variant="default"
              size="icon"
              className="shrink-0 bg-primary hover:bg-primary/90 h-8 w-8 sm:h-10 sm:w-10"
            >
              <Send className="w-4 h-4 sm:w-5 sm:h-5" />
            </Button>
          </>
        ) : (
          // Normal UI
          <>
            {/* Media Buttons - Hide some on mobile */}
            <div className="flex items-center">
              <Button
                variant="ghost"
                size="icon"
                onClick={onToggleEmoji}
                className="text-muted-foreground hover:text-primary h-8 w-8 sm:h-10 sm:w-10"
              >
                <Smile className="w-4 h-4 sm:w-5 sm:h-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={onToggleGif}
                className="text-muted-foreground hover:text-secondary h-8 w-8 sm:h-10 sm:w-10 hidden sm:flex"
              >
                <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={onToggleSticker}
                className="text-muted-foreground hover:text-accent h-8 w-8 sm:h-10 sm:w-10 hidden sm:flex"
              >
                <Sticker className="w-4 h-4 sm:w-5 sm:h-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="text-muted-foreground hover:text-primary h-8 w-8 sm:h-10 sm:w-10"
              >
                <Paperclip className="w-4 h-4 sm:w-5 sm:h-5" />
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileUpload}
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
                className="hidden"
              />
            </div>

            {/* Text Input */}
            <div className="flex-1 relative">
              <Input
                ref={inputRef}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type a message..."
                className="pr-10 sm:pr-12 bg-input/50 border-border/50 focus:border-primary text-sm sm:text-base h-9 sm:h-10"
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={handleRecordAudio}
                disabled={isUploading}
                className="absolute right-0.5 sm:right-1 top-1/2 -translate-y-1/2 w-7 h-7 sm:w-8 sm:h-8 text-muted-foreground hover:text-primary"
              >
                <Mic className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </Button>
            </div>

            {/* Send Button */}
            <Button
              onClick={handleSend}
              disabled={!message.trim() || isUploading}
              variant="default"
              size="icon"
              className="shrink-0 h-8 w-8 sm:h-10 sm:w-10"
            >
              <Send className="w-4 h-4 sm:w-5 sm:h-5" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

export default MessageInput;
