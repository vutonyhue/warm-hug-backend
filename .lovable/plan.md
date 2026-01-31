

# Kế hoạch: Sửa lỗi tạo cuộc trò chuyện Chat

## Vấn đề đã xác định

Sau khi phân tích kỹ console logs, network requests và database policies, tôi đã tìm ra nguyên nhân thực sự của lỗi.

### Console Log cho thấy:
```
[Chat] Creating new conversation with: 842a01c8-cbd1-4e08-8aed-f3b0564c4c12
[Chat] Error creating conversation: {
  "code": "42501",
  "message": "new row violates row-level security policy for table \"conversations\""
}
```

### Nguyên nhân gốc

Trong hook `useConversations.ts`, khi tạo direct conversation:

```typescript
// Step 1: Insert conversation (OK - policy cho phép)
const { data: conversation } = await supabase
  .from('conversations')
  .insert({ type: 'direct', created_by: userId })
  .select().single();

// Step 2: Insert BOTH participants (FAIL!)
await supabase
  .from('conversation_participants')
  .insert([
    { conversation_id: id, user_id: userId, role: 'member' },      // OK
    { conversation_id: id, user_id: otherUserId, role: 'member' }, // FAIL!
  ]);
```

**RLS Policy trên `conversation_participants`:**
```sql
Policy: "Users can join conversations"
FOR INSERT WITH CHECK (auth.uid() = user_id)
```

User chỉ có thể INSERT row với `user_id = auth.uid()`. Nhưng code đang cố INSERT 2 rows, trong đó 1 row có `user_id = otherUserId` (không phải current user) → **bị RLS chặn**.

Lỗi được throw ở step 2 nhưng message hiển thị không rõ ràng (vì cả 2 thao tác nằm trong cùng một transaction logic).

---

## Giải pháp

### Cách 1: Sửa RLS Policy (Khuyến nghị)

Thêm policy cho phép **conversation creator** thêm participants vào conversation của họ:

```sql
-- Drop existing restrictive policy
DROP POLICY IF EXISTS "Users can join conversations" ON conversation_participants;

-- Policy 1: User có thể tự thêm mình vào conversation
CREATE POLICY "Users can join conversations"
ON conversation_participants FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Policy 2: Conversation creator có thể thêm participants (cho direct/group chat setup)
CREATE POLICY "Creators can add participants"
ON conversation_participants FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM conversations 
    WHERE id = conversation_id 
    AND created_by = auth.uid()
  )
);
```

### Cách 2: Sửa Code (Tách 2 INSERT riêng)

Nếu không muốn thay đổi policy, có thể sửa code để tách 2 lần INSERT:

```typescript
// Insert current user first (sẽ pass RLS)
await supabase.from('conversation_participants').insert({
  conversation_id: conversation.id,
  user_id: userId,
  role: 'member',
});

// Sau đó cần một cách khác để add otherUser
// Ví dụ: Edge function với service_role, hoặc invitation system
```

**Cách 1 được khuyến nghị** vì nó giữ logic đơn giản và cho phép creator setup conversation ngay lập tức.

---

## Chi tiết thay đổi

### Migration SQL mới

```sql
-- Sửa RLS cho conversation_participants để cho phép creator thêm participants

-- Policy hiện tại chỉ cho user tự thêm mình
-- Cần thêm policy cho creator có thể thêm người khác vào conversation

-- Thêm policy mới
CREATE POLICY "Creators can add participants"
ON public.conversation_participants FOR INSERT
TO authenticated
WITH CHECK (
  -- Cho phép nếu user là creator của conversation này
  EXISTS (
    SELECT 1 FROM public.conversations 
    WHERE id = conversation_id 
    AND created_by = auth.uid()
  )
);
```

---

## Tóm tắt thay đổi

| Thành phần | Thay đổi |
|------------|----------|
| **Database** | Thêm RLS policy "Creators can add participants" cho bảng `conversation_participants` |

---

## Flow sau khi sửa

```text
User A muốn chat với User B:
1. Click "Nhắn tin"
2. Navigate → /chat?user={userB_id}
3. createDirectConversation được gọi:
   a. INSERT vào conversations (created_by = userA) ✓
   b. INSERT 2 rows vào conversation_participants:
      - Row 1: user_id = userA → Pass policy "Users can join"
      - Row 2: user_id = userB → Pass policy "Creators can add participants"
4. Conversation được tạo thành công
5. Navigate tới /chat/{conversationId}
```

---

## Kết quả mong đợi

1. Tạo direct conversation từ Friends page hoạt động
2. Tạo direct conversation từ NewConversationDialog hoạt động
3. Tạo group conversation hoạt động
4. Không còn lỗi 403 RLS violation

