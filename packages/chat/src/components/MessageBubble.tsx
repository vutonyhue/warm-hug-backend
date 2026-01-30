import { useState, memo } from 'react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Reply, SmilePlus, Check, CheckCheck } from 'lucide-react';
import { cn } from '../utils/cn';
import { useChatUser } from './ChatProvider';
import { VoicePlayer } from './VoicePlayer';
import type { Message } from '../types';

const REACTION_EMOJIS = ['❤️', '😂', '😮', '😢', '😡', '👍'];

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  showAvatar: boolean;
  onReply: () => void;
  onReaction: (emoji: string, hasReacted: boolean) => void;
  /** Custom CSS classes */
  className?: string;
}

/**
 * Individual message bubble with reactions, read receipts, and voice message support
 */
export const MessageBubble = memo(function MessageBubble({
  message,
  isOwn,
  showAvatar,
  onReply,
  onReaction,
  className,
}: MessageBubbleProps) {
  const { userId } = useChatUser();
  const [showActions, setShowActions] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);

  const isVoiceMessage = message.media_type === 'voice';
  const mediaUrls = message.media_url ? [message.media_url] : [];
  
  // Group reactions by emoji
  const reactionCounts = message.reactions?.reduce((acc, r) => {
    acc[r.emoji] = (acc[r.emoji] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  const userReactions = message.reactions
    ?.filter((r) => r.user_id === userId)
    .map((r) => r.emoji) || [];

  const isRead = message.read_by && message.read_by.length > 0;

  return (
    <div
      className={cn('flex gap-2 group', isOwn ? 'flex-row-reverse' : '', className)}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => {
        setShowActions(false);
        setShowReactionPicker(false);
      }}
    >
      {/* Avatar */}
      <div className="w-8 flex-shrink-0">
        {showAvatar && !isOwn && message.sender && (
          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center overflow-hidden">
            {message.sender.avatar_url ? (
              <img
                src={message.sender.avatar_url}
                alt={message.sender.username}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-sm font-medium">
                {message.sender.username[0].toUpperCase()}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Message content */}
      <div className={cn('flex flex-col max-w-[70%]', isOwn ? 'items-end' : 'items-start')}>
        {/* Reply preview */}
        {message.reply_to && (
          <div className={cn(
            'text-xs px-3 py-1 rounded-t-lg bg-muted/50 border-l-2',
            isOwn ? 'border-primary' : 'border-muted-foreground'
          )}>
            <span className="text-muted-foreground">
              Trả lời {message.reply_to.sender?.username || 'tin nhắn'}
            </span>
            <p className="truncate">{message.reply_to.content}</p>
          </div>
        )}

        {/* Bubble */}
        <div
          className={cn(
            'px-4 py-2 rounded-2xl relative',
            isOwn
              ? 'bg-primary text-primary-foreground rounded-br-md'
              : 'bg-muted rounded-bl-md',
            message.reply_to && 'rounded-t-none'
          )}
        >
          {/* Text content */}
          {message.content && (
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
          )}

          {/* Voice message player */}
          {isVoiceMessage && message.media_url && (
            <VoicePlayer
              url={message.media_url}
              duration={message.voice_duration}
              isOwn={isOwn}
            />
          )}

          {/* Regular media (images/videos) - only show if not voice */}
          {!isVoiceMessage && mediaUrls.length > 0 && (
            <div className={cn('mt-2 grid gap-1', mediaUrls.length > 1 ? 'grid-cols-2' : '')}>
              {mediaUrls.map((url, i) => (
                <img
                  key={i}
                  src={url}
                  alt=""
                  className="rounded-lg max-w-full h-auto cursor-pointer hover:opacity-90"
                  loading="lazy"
                />
              ))}
            </div>
          )}

          {/* Reactions display */}
          {Object.keys(reactionCounts).length > 0 && (
            <div className={cn(
              'absolute -bottom-3 flex gap-0.5 bg-card rounded-full px-1 py-0.5 shadow-sm border',
              isOwn ? 'right-2' : 'left-2'
            )}>
              {Object.entries(reactionCounts).map(([emoji, count]) => (
                <span key={emoji} className="text-xs">
                  {emoji}{count > 1 && <span className="text-muted-foreground">{count}</span>}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Timestamp & read status */}
        <div className="flex items-center gap-1 mt-1 px-2">
          <span className="text-[10px] text-muted-foreground">
            {message.created_at && format(new Date(message.created_at), 'HH:mm', { locale: vi })}
          </span>
          {isOwn && (
            <span className="text-muted-foreground">
              {isRead ? (
                <CheckCheck className="h-3 w-3 text-primary" />
              ) : (
                <Check className="h-3 w-3" />
              )}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div
        className={cn(
          'flex items-center gap-1 opacity-0 transition-opacity',
          showActions && 'opacity-100'
        )}
      >
        <button
          className="p-1.5 hover:bg-accent rounded-full"
          onClick={onReply}
          title="Trả lời"
        >
          <Reply className="h-4 w-4" />
        </button>

        <div className="relative">
          <button 
            className="p-1.5 hover:bg-accent rounded-full"
            onClick={() => setShowReactionPicker(!showReactionPicker)}
          >
            <SmilePlus className="h-4 w-4" />
          </button>
          
          {showReactionPicker && (
            <div className="absolute bottom-full right-0 mb-1 p-2 bg-card border rounded-lg shadow-lg flex gap-1 z-10">
              {REACTION_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => {
                    onReaction(emoji, userReactions.includes(emoji));
                    setShowReactionPicker(false);
                  }}
                  className={cn(
                    'text-xl p-1 rounded hover:bg-accent transition-colors',
                    userReactions.includes(emoji) && 'bg-accent'
                  )}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
