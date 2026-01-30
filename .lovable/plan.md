

# Kế hoạch: Sửa lỗi và hoàn thiện tính năng Kết bạn

## Tình trạng hiện tại

### ✅ Đã hoạt động tốt
| Thành phần | Trạng thái |
|------------|-----------|
| Bảng `friendships` | Có đầy đủ columns: id, requester_id, addressee_id, status, created_at |
| RLS Policies | SELECT, INSERT, UPDATE, DELETE đều có policy phù hợp |
| Gửi lời mời | Hoạt động ✓ (có 2 pending requests trong DB) |
| Hủy lời mời | Hoạt động ✓ |
| Network requests | Trả về 200 OK |

### ⚠️ Vấn đề cần sửa

| Vấn đề | Mô tả |
|--------|-------|
| **Query profiles** | Dùng `.in('id', userIds)` có thể trả về rỗng nếu userIds = [] |
| **Suggestions filter** | Dùng `.not('id', 'in', ...)` sẽ lỗi nếu excludedUserIds chỉ có 1 phần tử |
| **Thiếu error handling** | Không log lỗi khi query fails |
| **Thiếu loading state cho actions** | UI không phản hồi khi đang xử lý |
| **Thiếu liên kết Chat** | Chưa có nút "Nhắn tin" nhanh với bạn bè |

---

## Các thay đổi chi tiết

### 1. Sửa `src/pages/Friends.tsx`

**Vấn đề 1:** Khi `userIds` hoặc `friendIds` là array rỗng, query `.in('id', [])` có thể gây lỗi hoặc trả về không đúng.

**Vấn đề 2:** Thiếu error handling và logging.

```typescript
// Sửa fetchFriendRequests
const fetchFriendRequests = async (userId: string) => {
  const { data, error } = await supabase
    .from('friendships')
    .select('*')
    .eq('addressee_id', userId)
    .eq('status', 'pending');
  
  // Thêm error handling
  if (error) {
    console.error('[Friends] Error fetching friend requests:', error);
    setFriendRequests([]);
    return;
  }
  
  if (!data?.length) {
    setFriendRequests([]);
    return;
  }

  const userIds = data.map(f => f.requester_id);
  
  // Guard: không query nếu không có userIds
  if (userIds.length === 0) {
    setFriendRequests([]);
    return;
  }
  
  const { data: profilesData, error: profilesError } = await supabase
    .from('profiles')
    .select('id, username, full_name, avatar_url')
    .in('id', userIds);
  
  if (profilesError) {
    console.error('[Friends] Error fetching profiles:', profilesError);
  }
  
  // ... rest of the code
};
```

**Tương tự cho `fetchSentRequests` và `fetchSuggestions`.**

### 2. Sửa `src/components/friends/FriendsList.tsx`

**Vấn đề:** `.not('id', 'in', ...)` với 1 phần tử sẽ không format đúng.

```typescript
// Sửa fetchSuggestions
const fetchSuggestions = async () => {
  const { data: existingRelations } = await supabase
    .from("friendships")
    .select("requester_id, addressee_id")
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);

  const excludedUserIds = new Set([userId]);
  existingRelations?.forEach(rel => {
    excludedUserIds.add(rel.requester_id);
    excludedUserIds.add(rel.addressee_id);
  });

  // Sử dụng public_profiles view thay vì profiles
  // và filter phía client để tránh lỗi SQL
  const { data: profilesData, error } = await supabase
    .from("public_profiles")
    .select("id, username, full_name, avatar_url")
    .limit(20);

  if (error) {
    console.error('[FriendsList] Error fetching suggestions:', error);
    setSuggestions([]);
    return;
  }

  // Filter phía client
  const suggestionsList: Friend[] = (profilesData || [])
    .filter(profile => profile.id && !excludedUserIds.has(profile.id))
    .map(profile => ({
      id: profile.id!,
      username: profile.username || 'Unknown',
      full_name: profile.full_name || "",
      avatar_url: profile.avatar_url || "",
      friendship_id: ""
    }));

  setSuggestions(suggestionsList);
};
```

### 3. Thêm nút "Nhắn tin" trong FriendsList

**File:** `src/components/friends/FriendsList.tsx`

Thêm chức năng navigate tới Chat khi click "Nhắn tin":

```typescript
const handleStartChat = async (friendId: string) => {
  // Tìm hoặc tạo conversation với friend
  // Sau đó navigate tới /chat?user={friendId}
  navigate(`/chat?user=${friendId}`);
};

// Trong DropdownMenuItem
<DropdownMenuItem onClick={() => handleStartChat(friend.id)}>
  <MessageCircle className="w-4 h-4 mr-2" />
  Nhắn tin
</DropdownMenuItem>
```

### 4. Thêm Realtime subscription

**File:** `src/pages/Friends.tsx`

Cải thiện realtime subscription để catch tất cả các thay đổi:

```typescript
useEffect(() => {
  // ... existing code
  
  // Subscribe to friendships changes
  const channel = supabase
    .channel('friendships-realtime')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'friendships',
        filter: `requester_id=eq.${currentUserId}`
      },
      (payload) => {
        console.log('[Friends] Realtime update (requester):', payload);
        fetchFriendRequests(currentUserId);
        fetchSentRequests(currentUserId);
        fetchSuggestions(currentUserId);
      }
    )
    .on(
      'postgres_changes', 
      {
        event: '*',
        schema: 'public',
        table: 'friendships',
        filter: `addressee_id=eq.${currentUserId}`
      },
      (payload) => {
        console.log('[Friends] Realtime update (addressee):', payload);
        fetchFriendRequests(currentUserId);
        fetchSentRequests(currentUserId);
        fetchSuggestions(currentUserId);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [currentUserId]);
```

### 5. Cải thiện UX với loading states

**File:** `src/pages/Friends.tsx`

```typescript
const [actionLoading, setActionLoading] = useState<string | null>(null);

const handleRequestAction = async (id: string, action: string) => {
  setActionLoading(id);
  try {
    if (action === 'accept') {
      const { error } = await supabase
        .from('friendships')
        .update({ status: 'accepted' })
        .eq('id', id);
      if (!error) {
        toast.success('Đã chấp nhận lời mời kết bạn!');
        // Refresh data
        await Promise.all([
          fetchFriendRequests(currentUserId),
          fetchSuggestions(currentUserId)
        ]);
      } else {
        toast.error('Không thể chấp nhận lời mời');
        console.error('[Friends] Accept error:', error);
      }
    }
    // ... similar for other actions
  } finally {
    setActionLoading(null);
  }
};
```

---

## Tóm tắt thay đổi

| File | Thay đổi |
|------|----------|
| `src/pages/Friends.tsx` | Thêm error handling, realtime subscription, loading states |
| `src/components/friends/FriendsList.tsx` | Sửa fetchSuggestions filter, thêm handleStartChat |
| `src/components/friends/FriendCarousel.tsx` | Thêm loading state cho buttons |

---

## Chuẩn bị cho tính năng Chat

Sau khi hoàn thành các sửa đổi trên, hệ thống sẽ sẵn sàng cho:

1. **Nhắn tin 1-1** giữa bạn bè
2. **Tạo nhóm chat** với nhiều bạn bè
3. **Video call** (sẽ cần thêm WebRTC integration)

### Kiến trúc Chat đã có sẵn

Dự án đã có module Chat (`@fun-ecosystem1/chat`) với:
- `conversations` table
- `messages` table
- `conversation_participants` table
- Realtime messaging
- Voice messages

**Chỉ cần kết nối Friends → Chat** là có thể sử dụng ngay.

---

## Kết quả mong đợi

1. ✅ Gửi/nhận lời mời kết bạn hoạt động ổn định
2. ✅ Chấp nhận/từ chối lời mời cập nhật realtime
3. ✅ Gợi ý bạn bè hiển thị đúng
4. ✅ Có nút "Nhắn tin" nhanh với bạn bè
5. ✅ Error handling đầy đủ để dễ debug

