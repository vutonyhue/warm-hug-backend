import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Loader2 } from 'lucide-react';
import { cn } from '../utils/cn';
import { useDebounce } from '../hooks/useDebounce';
import { useChatSupabase, useChatUser } from './ChatProvider';
import type { UserProfile } from '../types';

interface NewConversationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectUser: (userId: string) => void;
  /** Custom CSS classes */
  className?: string;
}

/**
 * Dialog for starting a new direct conversation
 */
export function NewConversationDialog({
  open,
  onOpenChange,
  onSelectUser,
  className,
}: NewConversationDialogProps) {
  const supabase = useChatSupabase();
  const { userId } = useChatUser();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);

  // Fetch friends first
  const { data: friends, isLoading: friendsLoading } = useQuery({
    queryKey: ['friends-for-chat', userId],
    queryFn: async () => {
      if (!userId) return [];

      const { data: friendships, error } = await supabase
        .from('friendships')
        .select('requester_id, addressee_id')
        .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
        .eq('status', 'accepted');

      if (error) throw error;

      const friendIds = friendships?.map((f) =>
        f.requester_id === userId ? f.addressee_id : f.requester_id
      ) || [];

      if (friendIds.length === 0) return [];

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url')
        .in('id', friendIds);

      return (profiles || []) as UserProfile[];
    },
    enabled: open && !!userId,
  });

  // Search all users
  const { data: searchResults, isLoading: searchLoading } = useQuery({
    queryKey: ['search-users-chat', debouncedSearch],
    queryFn: async () => {
      if (!debouncedSearch || debouncedSearch.length < 2) return [];

      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url')
        .neq('id', userId)
        .or(`username.ilike.%${debouncedSearch}%,full_name.ilike.%${debouncedSearch}%`)
        .limit(10);

      if (error) throw error;
      return (data || []) as UserProfile[];
    },
    enabled: open && debouncedSearch.length >= 2,
  });

  const displayUsers = useMemo(() => {
    if (debouncedSearch.length >= 2) {
      return searchResults || [];
    }
    return friends || [];
  }, [debouncedSearch, friends, searchResults]);

  const isLoading = friendsLoading || (debouncedSearch.length >= 2 && searchLoading);

  const handleSelect = (selectedUserId: string) => {
    onSelectUser(selectedUserId);
    setSearch('');
    onOpenChange(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50" 
        onClick={() => onOpenChange(false)}
      />
      
      {/* Dialog */}
      <div className={cn("relative bg-card rounded-lg shadow-lg w-full max-w-md mx-4 p-6", className)}>
        <h2 className="text-lg font-semibold mb-4">Cuộc trò chuyện mới</h2>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm kiếm người dùng..."
            className="w-full pl-9 pr-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="h-[300px] overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : displayUsers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {debouncedSearch.length >= 2
                ? 'Không tìm thấy người dùng'
                : 'Bạn chưa có bạn bè nào'}
            </div>
          ) : (
            <div className="space-y-1">
              {!debouncedSearch && friends && friends.length > 0 && (
                <p className="text-xs text-muted-foreground px-3 py-2">Bạn bè</p>
              )}
              {displayUsers.map((user) => (
                <button
                  key={user.id}
                  onClick={() => handleSelect(user.id)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-accent transition-colors text-left"
                >
                  <div className="h-10 w-10 rounded-full bg-muted overflow-hidden flex items-center justify-center">
                    {user.avatar_url ? (
                      <img src={user.avatar_url} alt={user.username} className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-lg font-medium">{user.username[0].toUpperCase()}</span>
                    )}
                  </div>
                  <div>
                    <p className="font-medium">{user.full_name || user.username}</p>
                    <p className="text-sm text-muted-foreground">@{user.username}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
