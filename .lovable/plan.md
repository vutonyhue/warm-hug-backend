

# Kế hoạch: Sửa lỗi Chat - Không thể tạo cuộc trò chuyện mới

## Vấn đề đã xác định

### 1. Lỗi RLS Policy (Ưu tiên cao)

**Network request log cho thấy:**
```
POST /rest/v1/conversations → 403 Forbidden
Response: {"code":"42501","message":"new row violates row-level security policy for table \"conversations\""}
```

**Request body:**
```json
{"type":"direct","created_by":"c720a49a-f7cb-4580-af53-c49b9376d5b6"}
```

**Phân tích:**
- User đang authenticated với JWT hợp lệ
- `created_by` trong request = `auth.uid()` của user
- Policy INSERT: `with_check: (auth.uid() = created_by)` - lẽ ra phải pass

**Nguyên nhân tiềm năng:**
Useful-context cho thấy policies được tạo dưới dạng **RESTRICTIVE** (`Permissive: No`), nhưng query DB thực tế cho thấy chúng là **PERMISSIVE**. Điều này có thể do:
- Context không được cập nhật sau khi policies được sửa
- Hoặc có vấn đề với cách policies được enforce

**Giải pháp:** Cần recreate RLS policies đảm bảo chúng là PERMISSIVE.

### 2. Thiếu xử lý Query Param `?user=xxx`

**Tình huống:**
- Từ trang Friends, khi click "Nhắn tin" → Navigate tới `/chat?user={friendId}`
- Chat page hiện tại KHÔNG xử lý query param `user`
- User phải tự mở NewConversationDialog và chọn lại người dùng

**Giải pháp:** Thêm logic xử lý `searchParams.get('user')` trong Chat page.

---

## Thay đổi chi tiết

### 1. Sửa RLS Policy cho bảng `conversations`

**Migration SQL:**
```sql
-- Drop existing INSERT policy (if it's RESTRICTIVE)
DROP POLICY IF EXISTS "Users can create conversations" ON conversations;

-- Recreate as PERMISSIVE (default)
CREATE POLICY "Users can create conversations"
  ON conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);
```

### 2. Cập nhật `src/pages/Chat.tsx`

Thêm xử lý query param `user` để tự động tạo conversation:

```typescript
// Thêm import
import { useSearchParams } from 'react-router-dom';

export default function Chat() {
  const { conversationId } = useParams<{ conversationId?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  // ... existing code

  // Xử lý query param ?user=xxx
  const targetUserId = searchParams.get('user');
  
  // ... existing code
  
  return (
    <ChatProvider config={chatConfig}>
      <ChatContent 
        conversationId={conversationId}
        targetUserId={targetUserId}  // Truyền xuống
        clearTargetUser={() => setSearchParams({})}  // Clear sau khi xử lý
        // ... other props
      />
    </ChatProvider>
  );
}
```

**Trong `ChatContent`:**

```typescript
interface ChatContentProps {
  conversationId?: string;
  targetUserId?: string | null;
  clearTargetUser: () => void;
  // ... other props
}

function ChatContent({
  conversationId,
  targetUserId,
  clearTargetUser,
  // ... other props
}: ChatContentProps) {
  const navigate = useNavigate();
  const { conversations, isLoading, createDirectConversation } = useConversations();
  
  // Auto-create conversation when targetUserId is provided
  useEffect(() => {
    if (!targetUserId || isLoading || createDirectConversation.isPending) return;
    
    // Check if conversation already exists with this user
    const existingConv = conversations.find(conv => 
      conv.type === 'direct' && 
      conv.participants?.some(p => p.user_id === targetUserId)
    );
    
    if (existingConv) {
      // Navigate to existing conversation
      navigate(`/chat/${existingConv.id}`);
      clearTargetUser();
      return;
    }
    
    // Create new conversation
    const createChat = async () => {
      try {
        const result = await createDirectConversation.mutateAsync(targetUserId);
        if (result) {
          navigate(`/chat/${result.id}`);
        }
      } catch (error) {
        console.error('[Chat] Error creating conversation:', error);
        toast.error('Không thể tạo cuộc trò chuyện');
      } finally {
        clearTargetUser();
      }
    };
    
    createChat();
  }, [targetUserId, isLoading, conversations, createDirectConversation, navigate, clearTargetUser]);
  
  // ... rest of component
}
```

---

## Tóm tắt thay đổi

| Thành phần | Thay đổi |
|------------|----------|
| **Database** | Recreate RLS policy cho `conversations` INSERT (PERMISSIVE) |
| `src/pages/Chat.tsx` | Thêm xử lý `?user=xxx` query param để auto-create conversation |

---

## Flow sau khi sửa

```text
Từ trang Friends:
1. Click "Nhắn tin" với bạn A
2. Navigate → /chat?user={friendId}
3. Chat.tsx detect targetUserId từ query param
4. Kiểm tra có conversation với A chưa
   - Có → Navigate tới conversation đó
   - Chưa → Gọi createDirectConversation
5. RLS policy cho phép INSERT (PERMISSIVE)
6. Conversation được tạo thành công
7. Navigate tới /chat/{conversationId}
8. Clear query param

Từ NewConversationDialog:
1. User click vào friend trong dialog
2. handleNewConversation được gọi
3. createDirectConversation tạo conversation
4. Navigate tới /chat/{conversationId}
```

---

## Kết quả mong đợi

1. ✅ Click "Nhắn tin" từ Friends → Tự động tạo và mở conversation
2. ✅ Click user trong NewConversationDialog → Tạo conversation thành công (không còn 403)
3. ✅ Nếu đã có conversation → Navigate tới conversation cũ thay vì tạo mới
4. ✅ Error handling hiển thị toast khi có lỗi

