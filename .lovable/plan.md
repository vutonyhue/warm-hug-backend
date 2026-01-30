

# Kế hoạch: Tích hợp Package Chat vào Fun Profile

## Mục tiêu

Sửa `src/pages/Chat.tsx` để sử dụng `ChatProvider` và components từ `packages/chat/` thay vì các components local trong `src/components/chat/`. Điều này sẽ:

1. Kích hoạt tính năng **Voice Message** đã có trong package
2. Thống nhất codebase - chỉ duy trì 1 nơi (package)
3. Đúng pattern SDK với Dependency Injection

---

## Cấu trúc thay đổi

```text
src/pages/Chat.tsx
├── Trước: Import từ src/components/chat/ và src/hooks/
└── Sau: Import từ packages/chat/ và wrap với ChatProvider
```

---

## Chi tiết thay đổi

### 1. Import từ packages/chat/ thay vì src/components/chat/

**Trước:**
```typescript
import { useConversations } from '@/hooks/useConversations';
import { useGroupConversations } from '@/hooks/useGroupConversations';
import { useChatNotifications } from '@/hooks/useChatNotifications';
import { ConversationList } from '@/components/chat/ConversationList';
import { MessageThread } from '@/components/chat/MessageThread';
import { NewConversationDialog } from '@/components/chat/NewConversationDialog';
import { CreateGroupDialog } from '@/components/chat/CreateGroupDialog';
import { ChatSettingsDialog } from '@/components/chat/ChatSettingsDialog';
```

**Sau:**
```typescript
// Import từ package chat
import {
  ChatProvider,
  ConversationList,
  MessageThread,
  NewConversationDialog,
  CreateGroupDialog,
  ChatSettingsDialog,
  useConversations,
  useGroupConversations,
  useChatNotifications,
} from '../../packages/chat/src';
```

### 2. Wrap nội dung với ChatProvider

Package chat yêu cầu `ChatProvider` để inject các dependencies:

```typescript
// Config cho ChatProvider
const chatConfig = {
  supabase: supabase,
  queryClient: queryClient,
  currentUserId: userId,
  currentUsername: username,
  uploadMedia: uploadChatMedia, // Hàm upload media
  dateLocale: vi, // Locale tiếng Việt
};

return (
  <ChatProvider config={chatConfig}>
    {/* Nội dung chat */}
  </ChatProvider>
);
```

### 3. Tạo hàm uploadMedia adapter

Package chat cần function `uploadMedia` với signature đơn giản. Ta cần adapter từ `uploadCommentMedia`:

```typescript
// Adapter để phù hợp với ChatConfig.uploadMedia
const uploadChatMedia = async (file: File) => {
  const result = await uploadCommentMedia(file);
  return { 
    url: result.url, 
    type: file.type.startsWith('audio/') ? 'voice' : undefined 
  };
};
```

### 4. Điều chỉnh cách sử dụng hooks

**Trước:** Hooks nhận `userId` qua parameter
```typescript
const { conversations, isLoading } = useConversations(userId);
const { createGroupConversation } = useGroupConversations(userId);
useChatNotifications(userId, conversationId);
```

**Sau:** Hooks lấy userId từ ChatProvider context
```typescript
const { conversations, isLoading, createDirectConversation } = useConversations();
const { createGroupConversation } = useGroupConversations();
useChatNotifications(conversationId);
```

### 5. Component MessageThread đơn giản hơn

**Trước:** Truyền userId, username qua props
```tsx
<MessageThread
  conversationId={conversationId}
  userId={userId}
  username={username}
/>
```

**Sau:** Không cần truyền userId/username (lấy từ context)
```tsx
<MessageThread
  conversationId={conversationId}
  onSearchClick={() => setShowSearch(true)}
  onSettingsClick={() => setShowGroupSettings(true)}
/>
```

### 6. Điều chỉnh ChatSettingsDialog

**Trước:** Nhận `userId` qua props
```tsx
<ChatSettingsDialog
  open={showSettings}
  onOpenChange={setShowSettings}
  userId={userId}
/>
```

**Sau:** Không cần truyền userId (lấy từ context)
```tsx
<ChatSettingsDialog
  open={showSettings}
  onOpenChange={setShowSettings}
/>
```

---

## File cần sửa

| File | Hành động | Mô tả |
|------|-----------|-------|
| `src/pages/Chat.tsx` | Sửa | Tích hợp ChatProvider và import từ package |

---

## Cấu trúc code mới (src/pages/Chat.tsx)

```typescript
import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { vi } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { uploadCommentMedia } from '@/utils/mediaUpload';
import { FacebookNavbar } from '@/components/layout/FacebookNavbar';
import { MobileBottomNav } from '@/components/layout/MobileBottomNav';
import { useIsMobile, useIsMobileOrTablet } from '@/hooks/use-mobile';
// ... UI components

// Import từ package chat SDK
import {
  ChatProvider,
  ConversationList,
  MessageThread,
  NewConversationDialog,
  CreateGroupDialog,
  ChatSettingsDialog,
  useConversations,
  useGroupConversations,
  useChatNotifications,
} from '../../packages/chat/src';

export default function Chat() {
  // ... state

  // Upload adapter cho package chat
  const uploadChatMedia = async (file: File) => {
    const result = await uploadCommentMedia(file);
    return { url: result.url, type: file.type.startsWith('audio/') ? 'voice' : undefined };
  };

  // Chat config
  const queryClient = useQueryClient();
  const chatConfig = useMemo(() => ({
    supabase,
    queryClient,
    currentUserId: userId,
    currentUsername: username,
    uploadMedia: uploadChatMedia,
    dateLocale: vi,
  }), [userId, username, queryClient]);

  return (
    <ChatProvider config={chatConfig}>
      <ChatContent />
    </ChatProvider>
  );
}

// Tách thành component riêng để sử dụng hooks từ ChatProvider
function ChatContent() {
  const { conversations, isLoading, createDirectConversation } = useConversations();
  const { createGroupConversation } = useGroupConversations();
  
  useChatNotifications(conversationId);

  // ... render logic (giữ nguyên structure)
}
```

---

## Lưu ý quan trọng

1. **ChatProvider phải wrap component dùng hooks**: Các hooks như `useConversations()` cần được gọi bên trong `ChatProvider`, nên ta cần tách `ChatContent` thành component riêng.

2. **Voice Message sẽ tự động hoạt động**: Vì `packages/chat/src/components/ChatInput.tsx` đã có `VoiceRecordButton` và `VoicePreview`, chỉ cần tích hợp package là nút ghi âm sẽ xuất hiện.

3. **Import path**: Do package chưa publish lên npm, ta dùng relative import `../../packages/chat/src`.

---

## Kết quả sau khi tích hợp

- Nút **🎤 ghi âm** xuất hiện trong ChatInput
- Có thể **nhấn giữ** để ghi âm voice message
- **Voice Preview** cho phép nghe lại trước khi gửi
- **VoicePlayer** hiển thị trong tin nhắn đã gửi
- Code duy trì tập trung tại `packages/chat/`

