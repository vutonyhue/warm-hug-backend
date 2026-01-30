import { useRef, useEffect, useState } from 'react';
import { useMessages } from '../hooks/useMessages';
import { useTypingIndicator } from '../hooks/useTypingIndicator';
import { useConversation } from '../hooks/useConversations';
import { MessageBubble } from './MessageBubble';
import { ChatInput } from './ChatInput';
import { TypingIndicator } from './TypingIndicator';
import { useChatUser, useChatQueryClient } from './ChatProvider';
import { Search, Settings, Users, Loader2 } from 'lucide-react';
import { cn } from '../utils/cn';
import type { Message, ConversationParticipant } from '../types';

interface MessageThreadProps {
  conversationId: string;
  /** Called when user clicks search button */
  onSearchClick?: () => void;
  /** Called when user clicks settings button (for group) */
  onSettingsClick?: () => void;
  /** Custom CSS classes */
  className?: string;
}

/**
 * Main message thread component showing messages, typing indicators, and input
 */
export function MessageThread({ 
  conversationId, 
  onSearchClick,
  onSettingsClick,
  className,
}: MessageThreadProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const queryClient = useChatQueryClient();
  const { userId, username } = useChatUser();
  const [replyTo, setReplyTo] = useState<Message | null>(null);

  const { data: conversation } = useConversation(conversationId);
  const {
    messages,
    isLoading,
    sendMessage,
    markAsRead,
    addReaction,
    removeReaction,
  } = useMessages(conversationId);

  const { typingUsers, sendTyping } = useTypingIndicator(conversationId);

  // Get other participant for header
  const otherParticipant = conversation?.participants?.find(
    (p: ConversationParticipant) => p.user_id !== userId && !p.left_at
  );
  const headerProfile = otherParticipant?.profile;
  const isGroup = conversation?.type === 'group';
  const participantCount = conversation?.participants?.filter((p: ConversationParticipant) => !p.left_at).length || 0;
  
  const headerName = isGroup
    ? conversation?.name
    : headerProfile?.username || 'User';
  const headerAvatar = isGroup
    ? conversation?.avatar_url
    : headerProfile?.avatar_url;

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  // Mark messages as read
  useEffect(() => {
    if (!userId || messages.length === 0) return;

    const unreadMessages = messages.filter(
      (m) => m.sender_id !== userId && !m.read_by?.includes(userId)
    );

    unreadMessages.forEach((m) => {
      markAsRead(m.id);
    });
  }, [messages, userId, markAsRead]);

  const handleSend = async (content: string, mediaUrls?: string[]) => {
    await sendMessage.mutateAsync({
      content,
      mediaUrls,
      replyToId: replyTo?.id,
    });
    setReplyTo(null);
  };

  const handleReaction = (messageId: string, emoji: string, hasReacted: boolean) => {
    if (hasReacted) {
      removeReaction.mutate({ messageId, emoji });
    } else {
      addReaction.mutate({ messageId, emoji });
    }
  };

  if (isLoading) {
    return (
      <div className={cn("flex-1 flex flex-col", className)}>
        <div className="p-4 border-b flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-muted animate-pulse" />
          <div className="h-5 w-32 bg-muted rounded animate-pulse" />
        </div>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex-1 flex flex-col", className)}>
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between bg-card">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center overflow-hidden">
            {headerAvatar ? (
              <img src={headerAvatar} alt={headerName || ''} className="h-full w-full object-cover" />
            ) : (
              <span className="text-lg font-medium">{(headerName || 'U')[0].toUpperCase()}</span>
            )}
          </div>
          <div>
            <p className="font-medium">{headerName}</p>
            {isGroup ? (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Users className="h-3 w-3" />
                {participantCount} thành viên
              </p>
            ) : typingUsers.length > 0 ? (
              <p className="text-xs text-muted-foreground">Đang nhập...</p>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-1">
          {onSearchClick && (
            <button 
              className="p-2 hover:bg-accent rounded-full"
              onClick={onSearchClick}
            >
              <Search className="h-5 w-5" />
            </button>
          )}
          {isGroup && onSettingsClick && (
            <button 
              className="p-2 hover:bg-accent rounded-full"
              onClick={onSettingsClick}
            >
              <Settings className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
        <div className="space-y-4">
          {messages.map((message, index) => {
            const isOwn = message.sender_id === userId;
            const showAvatar = !isOwn && (
              index === 0 || messages[index - 1]?.sender_id !== message.sender_id
            );

            return (
              <MessageBubble
                key={message.id}
                message={message}
                isOwn={isOwn}
                showAvatar={showAvatar}
                onReply={() => setReplyTo(message)}
                onReaction={(emoji, hasReacted) => handleReaction(message.id, emoji, hasReacted)}
              />
            );
          })}

          {typingUsers.length > 0 && (
            <TypingIndicator users={typingUsers} />
          )}
        </div>
      </div>

      {/* Input */}
      <ChatInput
        onSend={handleSend}
        onTyping={sendTyping}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
        isSending={sendMessage.isPending}
      />
    </div>
  );
}
