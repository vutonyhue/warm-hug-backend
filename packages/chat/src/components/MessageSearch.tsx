import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, X, Loader2, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { cn } from '../utils/cn';
import { useDebounce } from '../hooks/useDebounce';
import { useChatSupabase } from './ChatProvider';

interface MessageSearchProps {
  conversationId: string;
  onSelectMessage?: (messageId: string) => void;
  onClose?: () => void;
  /** Custom CSS classes */
  className?: string;
}

interface SearchResult {
  id: string;
  content: string | null;
  created_at: string | null;
  sender: {
    id: string;
    username: string;
    avatar_url: string | null;
  } | null;
}

/**
 * Search messages within a conversation
 */
export function MessageSearch({
  conversationId,
  onSelectMessage,
  onClose,
  className,
}: MessageSearchProps) {
  const supabase = useChatSupabase();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 400);

  const { data: results, isLoading } = useQuery({
    queryKey: ['message-search', conversationId, debouncedSearch],
    queryFn: async () => {
      if (!debouncedSearch || debouncedSearch.length < 2) return [];

      const { data: messages, error } = await supabase
        .from('messages')
        .select('id, content, created_at, sender_id')
        .eq('conversation_id', conversationId)
        .ilike('content', `%${debouncedSearch}%`)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      // Fetch sender profiles
      const senderIds = [...new Set(messages?.map((m) => m.sender_id).filter(Boolean) || [])] as string[];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .in('id', senderIds);

      const profileMap = new Map(profiles?.map((p) => [p.id, p]) || []);

      return messages?.map((m) => ({
        ...m,
        sender: profileMap.get(m.sender_id) || null,
      })) as SearchResult[];
    },
    enabled: debouncedSearch.length >= 2,
  });

  const handleSelect = useCallback(
    (messageId: string) => {
      onSelectMessage?.(messageId);
    },
    [onSelectMessage]
  );

  const highlightMatch = (text: string | null, query: string) => {
    if (!text) return null;
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === query.toLowerCase() ? (
        <mark key={i} className="bg-primary/30 text-foreground rounded-sm px-0.5">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Search header */}
      <div className="flex items-center gap-2 p-3 border-b">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm kiếm tin nhắn..."
            className="w-full pl-9 pr-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            autoFocus
          />
        </div>
        {onClose && (
          <button 
            onClick={onClose}
            className="p-2 hover:bg-accent rounded-full"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !debouncedSearch || debouncedSearch.length < 2 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <MessageSquare className="h-12 w-12 mb-4 opacity-50" />
            <p>Nhập từ khóa để tìm kiếm</p>
          </div>
        ) : results?.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Search className="h-12 w-12 mb-4 opacity-50" />
            <p>Không tìm thấy kết quả</p>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {results?.map((result) => (
              <button
                key={result.id}
                onClick={() => handleSelect(result.id)}
                className="w-full flex items-start gap-3 p-3 rounded-lg hover:bg-accent text-left transition-colors"
              >
                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {result.sender?.avatar_url ? (
                    <img src={result.sender.avatar_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-sm font-medium">
                      {(result.sender?.username || 'U')[0].toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-sm">
                      {result.sender?.username}
                    </span>
                    {result.created_at && (
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(result.created_at), 'dd/MM/yyyy HH:mm', {
                          locale: vi,
                        })}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {highlightMatch(result.content, debouncedSearch)}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
