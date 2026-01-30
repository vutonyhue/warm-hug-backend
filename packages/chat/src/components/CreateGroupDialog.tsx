import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Loader2, X, Users } from 'lucide-react';
import { cn } from '../utils/cn';
import { useDebounce } from '../hooks/useDebounce';
import { useChatSupabase, useChatUser } from './ChatProvider';
import type { UserProfile } from '../types';

interface CreateGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateGroup: (name: string, memberIds: string[]) => void;
  isCreating?: boolean;
  /** Custom CSS classes */
  className?: string;
}

/**
 * Dialog for creating new group conversations
 */
export function CreateGroupDialog({
  open,
  onOpenChange,
  onCreateGroup,
  isCreating = false,
  className,
}: CreateGroupDialogProps) {
  const supabase = useChatSupabase();
  const { userId } = useChatUser();
  const [groupName, setGroupName] = useState('');
  const [search, setSearch] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<UserProfile[]>([]);
  const debouncedSearch = useDebounce(search, 300);

  // Fetch friends
  const { data: friends, isLoading: friendsLoading } = useQuery({
    queryKey: ['friends-for-group', userId],
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

  // Search users
  const { data: searchResults, isLoading: searchLoading } = useQuery({
    queryKey: ['search-users-group', debouncedSearch],
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
    const users = debouncedSearch.length >= 2 ? searchResults || [] : friends || [];
    return users.filter((u) => !selectedUsers.some((s) => s.id === u.id));
  }, [debouncedSearch, friends, searchResults, selectedUsers]);

  const isLoading = friendsLoading || searchLoading;

  const handleSelectUser = (user: UserProfile) => {
    setSelectedUsers((prev) => [...prev, user]);
    setSearch('');
  };

  const handleRemoveUser = (userId: string) => {
    setSelectedUsers((prev) => prev.filter((u) => u.id !== userId));
  };

  const handleCreate = () => {
    if (groupName.trim() && selectedUsers.length >= 1) {
      onCreateGroup(groupName.trim(), selectedUsers.map((u) => u.id));
      // Reset state
      setGroupName('');
      setSelectedUsers([]);
      setSearch('');
    }
  };

  const canCreate = groupName.trim().length > 0 && selectedUsers.length >= 1 && !isCreating;

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
        <div className="flex items-center gap-2 mb-4">
          <Users className="h-5 w-5" />
          <h2 className="text-lg font-semibold">Tạo nhóm mới</h2>
        </div>

        <div className="space-y-4">
          {/* Group name */}
          <input
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="Tên nhóm..."
            className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />

          {/* Selected members */}
          {selectedUsers.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedUsers.map((user) => (
                <span
                  key={user.id}
                  className="flex items-center gap-1 px-2 py-1 bg-secondary text-secondary-foreground rounded-full text-sm"
                >
                  <div className="h-4 w-4 rounded-full bg-muted overflow-hidden">
                    {user.avatar_url ? (
                      <img src={user.avatar_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-[8px]">{user.username[0].toUpperCase()}</span>
                    )}
                  </div>
                  <span>{user.full_name || user.username}</span>
                  <button
                    onClick={() => handleRemoveUser(user.id)}
                    className="ml-1 hover:bg-muted rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Thêm thành viên..."
              className="w-full pl-9 pr-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* User list */}
          <div className="h-[200px] overflow-y-auto">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : displayUsers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                {debouncedSearch.length >= 2
                  ? 'Không tìm thấy người dùng'
                  : 'Chọn bạn bè để thêm vào nhóm'}
              </div>
            ) : (
              <div className="space-y-1">
                {displayUsers.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => handleSelectUser(user)}
                    className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-accent transition-colors text-left"
                  >
                    <div className="h-8 w-8 rounded-full bg-muted overflow-hidden flex items-center justify-center">
                      {user.avatar_url ? (
                        <img src={user.avatar_url} alt={user.username} className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-sm font-medium">{user.username[0].toUpperCase()}</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{user.full_name || user.username}</p>
                      <p className="text-xs text-muted-foreground">@{user.username}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={() => onOpenChange(false)}
            className="px-4 py-2 border border-input rounded-md text-sm hover:bg-accent"
          >
            Hủy
          </button>
          <button
            onClick={handleCreate}
            disabled={!canCreate}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 disabled:opacity-50"
          >
            {isCreating ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Đang tạo...
              </span>
            ) : (
              'Tạo nhóm'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
