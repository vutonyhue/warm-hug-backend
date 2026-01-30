import { formatDistanceToNow } from 'date-fns';
import { vi, enUS } from 'date-fns/locale';
import { Users, Loader2 } from 'lucide-react';
import { cn } from '../utils/cn';
import { useChatConfig } from './ChatProvider';
import type { Conversation, ConversationParticipant, Locale } from '../types';

interface ConversationListProps {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  isLoading: boolean;
  /** Custom CSS classes */
  className?: string;
}

/**
 * List of conversations with search and selection
 */
export function ConversationList({
  conversations,
  selectedId,
  onSelect,
  isLoading,
  className,
}: ConversationListProps) {
  const { currentUserId, t, dateLocale } = useChatConfig();
  const locale = dateLocale || vi;

  if (isLoading) {
    return (
      <div className={cn("p-4 space-y-3", className)}>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-3 animate-pulse">
            <div className="h-12 w-12 rounded-full bg-muted" />
            <div className="flex-1">
              <div className="h-4 w-24 mb-2 bg-muted rounded" />
              <div className="h-3 w-40 bg-muted rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className={cn("flex-1 flex items-center justify-center p-4 text-muted-foreground", className)}>
        <p>{t('noConversations')}</p>
      </div>
    );
  }

  return (
    <div className={cn("flex-1 overflow-y-auto p-2", className)}>
      {conversations.map((conversation) => {
        const isGroup = conversation.type === 'group';
        const otherParticipant = conversation.participants?.find(
          (p: ConversationParticipant) => p.user_id !== currentUserId && !p.left_at
        );
        const profile = otherParticipant?.profile;
        const participantCount = conversation.participants?.filter(
          (p: ConversationParticipant) => !p.left_at
        ).length || 0;

        const displayName = isGroup
          ? conversation.name
          : profile?.username || t('user');

        const avatarUrl = isGroup
          ? conversation.avatar_url
          : profile?.avatar_url;

        return (
          <button
            key={conversation.id}
            onClick={() => onSelect(conversation.id)}
            className={cn(
              'w-full flex items-center gap-3 p-3 rounded-full text-left transition-all duration-300 border hover:bg-accent hover:shadow-sm',
              selectedId === conversation.id 
                ? 'bg-primary/10 border-primary/60' 
                : 'border-transparent hover:border-primary/40'
            )}
          >
            <div className="relative">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={displayName || ''} className="h-full w-full object-cover" />
                ) : isGroup ? (
                  <Users className="h-5 w-5" />
                ) : (
                  <span className="text-lg font-medium">
                    {(displayName || 'U')[0].toUpperCase()}
                  </span>
                )}
              </div>
              {isGroup && (
                <div className="absolute -bottom-1 -right-1 bg-primary rounded-full p-0.5">
                  <Users className="h-3 w-3 text-primary-foreground" />
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-medium truncate">{displayName}</span>
                  {isGroup && (
                    <span className="text-[10px] px-1.5 py-0 bg-secondary text-secondary-foreground rounded-full">
                      {participantCount}
                    </span>
                  )}
                </div>
                {conversation.last_message_at && (
                  <span className="text-xs text-muted-foreground flex-shrink-0">
                    {formatDistanceToNow(new Date(conversation.last_message_at), {
                      addSuffix: false,
                      locale,
                    })}
                  </span>
                )}
              </div>
              {conversation.last_message_preview && (
                <p className="text-sm text-muted-foreground truncate">
                  {conversation.last_message_preview}
                </p>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
