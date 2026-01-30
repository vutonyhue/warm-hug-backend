import { useState, useRef, useCallback } from 'react';
import { ImagePlus, Send, X, Smile } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../utils/cn';
import { useChatConfig } from './ChatProvider';
import type { Message } from '../types';

interface ChatInputProps {
  onSend: (content: string, mediaUrls?: string[]) => Promise<void>;
  onTyping: (isTyping: boolean) => void;
  replyTo: Message | null;
  onCancelReply: () => void;
  isSending: boolean;
  /** Custom CSS classes */
  className?: string;
}

const EMOJI_LIST = ['😀', '😂', '😍', '🥰', '😎', '🤔', '👍', '❤️', '🔥', '🎉'];

/**
 * Chat input component with media upload and emoji support
 */
export function ChatInput({
  onSend,
  onTyping,
  replyTo,
  onCancelReply,
  isSending,
  className,
}: ChatInputProps) {
  const { uploadMedia } = useChatConfig();
  const [content, setContent] = useState('');
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [mediaPreviews, setMediaPreviews] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    onTyping(true);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Limit to 4 files
    const newFiles = files.slice(0, 4 - mediaFiles.length);
    if (files.length > newFiles.length) {
      toast.warning('Tối đa 4 ảnh/video mỗi tin nhắn');
    }

    // Create previews
    const newPreviews = newFiles.map((file) => URL.createObjectURL(file));
    
    setMediaFiles((prev) => [...prev, ...newFiles]);
    setMediaPreviews((prev) => [...prev, ...newPreviews]);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeMedia = (index: number) => {
    URL.revokeObjectURL(mediaPreviews[index]);
    setMediaFiles((prev) => prev.filter((_, i) => i !== index));
    setMediaPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSend = async () => {
    const trimmedContent = content.trim();
    if (!trimmedContent && mediaFiles.length === 0) return;

    try {
      setIsUploading(true);

      // Upload media files
      let uploadedUrls: string[] = [];
      if (mediaFiles.length > 0 && uploadMedia) {
        const uploadPromises = mediaFiles.map((file) => uploadMedia(file));
        const results = await Promise.all(uploadPromises);
        uploadedUrls = results.map((r) => r.url);
      }

      await onSend(trimmedContent, uploadedUrls.length > 0 ? uploadedUrls : undefined);

      // Clear input
      setContent('');
      setMediaFiles([]);
      mediaPreviews.forEach((url) => URL.revokeObjectURL(url));
      setMediaPreviews([]);
      onTyping(false);

    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Không thể gửi tin nhắn');
    } finally {
      setIsUploading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleEmojiSelect = useCallback((emoji: string) => {
    setContent((prev) => prev + emoji);
    setShowEmoji(false);
    textareaRef.current?.focus();
  }, []);

  const isDisabled = isSending || isUploading;
  const canSend = (content.trim() || mediaFiles.length > 0) && !isDisabled;

  return (
    <div className={cn("border-t bg-card p-3", className)}>
      {/* Reply preview */}
      {replyTo && (
        <div className="flex items-center gap-2 mb-2 px-3 py-2 bg-muted rounded-lg">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">
              Trả lời {replyTo.sender?.username}
            </p>
            <p className="text-sm truncate">{replyTo.content}</p>
          </div>
          <button 
            onClick={onCancelReply}
            className="p-1 hover:bg-background rounded-full"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Media previews */}
      {mediaPreviews.length > 0 && (
        <div className="flex gap-2 mb-2 overflow-x-auto pb-2">
          {mediaPreviews.map((preview, index) => (
            <div key={index} className="relative flex-shrink-0">
              <img
                src={preview}
                alt=""
                className="h-16 w-16 object-cover rounded-lg"
              />
              <button
                className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"
                onClick={() => removeMedia(index)}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input area */}
      <div className="flex items-end gap-2">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          accept="image/*,video/*"
          multiple
          className="hidden"
        />

        <button
          className="flex-shrink-0 p-2 border border-border hover:border-primary/60 rounded-full disabled:opacity-50"
          onClick={() => fileInputRef.current?.click()}
          disabled={isDisabled || mediaFiles.length >= 4}
        >
          <ImagePlus className="h-5 w-5" />
        </button>

        {/* Simple emoji picker */}
        <div className="relative">
          <button
            className="p-2 border border-border hover:border-primary/60 rounded-full"
            onClick={() => setShowEmoji(!showEmoji)}
          >
            <Smile className="h-5 w-5" />
          </button>
          {showEmoji && (
            <div className="absolute bottom-full left-0 mb-2 p-2 bg-card border rounded-lg shadow-lg flex gap-1 flex-wrap w-48">
              {EMOJI_LIST.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => handleEmojiSelect(emoji)}
                  className="text-xl p-1 hover:bg-accent rounded"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>

        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleContentChange}
          onKeyDown={handleKeyDown}
          placeholder="Nhập tin nhắn..."
          className="min-h-[40px] max-h-[120px] resize-none flex-1 px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          rows={1}
          disabled={isDisabled}
        />

        <button
          onClick={handleSend}
          disabled={!canSend}
          className={cn(
            'flex-shrink-0 p-2 rounded-full transition-colors disabled:opacity-50',
            canSend && 'bg-primary text-primary-foreground hover:bg-primary/90'
          )}
        >
          <Send className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
