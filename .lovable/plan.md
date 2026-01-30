
# Hướng dẫn: Tách Chat Module thành Package độc lập

## Tổng quan

Chat module hiện tại bao gồm **10 components** và **6 hooks** với các dependencies nội bộ. Việc tách thành package độc lập sẽ giúp:
- Team Chat làm việc riêng biệt
- Phát triển song song với các module khác
- Dễ dàng tích hợp vào Fun Profile hoặc các ứng dụng khác

## Kiến trúc hiện tại của Chat Module

```text
src/
├── components/chat/          # 10 components
│   ├── ChatInput.tsx
│   ├── ChatSettingsDialog.tsx
│   ├── ConversationList.tsx
│   ├── CreateGroupDialog.tsx
│   ├── GroupSettingsDialog.tsx
│   ├── MessageBubble.tsx
│   ├── MessageSearch.tsx
│   ├── MessageThread.tsx
│   ├── NewConversationDialog.tsx
│   └── TypingIndicator.tsx
│
├── hooks/                    # 6 hooks liên quan
│   ├── useChatNotifications.ts
│   ├── useChatSettings.ts
│   ├── useConversations.ts
│   ├── useGroupConversations.ts
│   ├── useMessages.ts
│   └── useTypingIndicator.ts
│
└── pages/Chat.tsx            # Page chính
```

## Dependencies cần xử lý

| Loại | Packages | Cách xử lý |
|------|----------|------------|
| **UI Components** | Button, Avatar, Dialog, Textarea, ScrollArea, Badge, Skeleton, DropdownMenu | Đưa vào `peerDependencies` |
| **Backend** | `@supabase/supabase-js` | Inject qua Provider hoặc peerDeps |
| **State** | `@tanstack/react-query` | peerDependencies |
| **Utilities** | `date-fns`, `lucide-react`, `sonner` | peerDependencies |
| **Internal** | `@/lib/utils`, `@/i18n/LanguageContext` | Copy hoặc inject qua Provider |

---

## Bước 1: Tạo cấu trúc thư mục cho Package

```text
packages/
└── chat/                          # Thư mục package độc lập
    ├── package.json
    ├── tsconfig.json
    ├── rollup.config.js           # Hoặc vite library mode
    ├── src/
    │   ├── index.ts               # Entry point - export tất cả
    │   ├── types.ts               # TypeScript interfaces
    │   │
    │   ├── components/            # React components
    │   │   ├── ChatInput.tsx
    │   │   ├── ChatSettingsDialog.tsx
    │   │   ├── ConversationList.tsx
    │   │   ├── CreateGroupDialog.tsx
    │   │   ├── GroupSettingsDialog.tsx
    │   │   ├── MessageBubble.tsx
    │   │   ├── MessageSearch.tsx
    │   │   ├── MessageThread.tsx
    │   │   ├── NewConversationDialog.tsx
    │   │   ├── TypingIndicator.tsx
    │   │   └── ChatProvider.tsx   # Context Provider (MỚI)
    │   │
    │   ├── hooks/                 # Custom hooks
    │   │   ├── useChatNotifications.ts
    │   │   ├── useChatSettings.ts
    │   │   ├── useConversations.ts
    │   │   ├── useGroupConversations.ts
    │   │   ├── useMessages.ts
    │   │   └── useTypingIndicator.ts
    │   │
    │   └── utils/                 # Utilities riêng
    │       └── cn.ts              # Class merger utility
    │
    └── dist/                      # Build output
        ├── index.esm.js
        ├── index.cjs.js
        └── index.d.ts
```

---

## Bước 2: Tạo ChatProvider để inject dependencies

Thay vì import trực tiếp Supabase client, sử dụng Context để inject:

```typescript
// packages/chat/src/components/ChatProvider.tsx
import { createContext, useContext, ReactNode } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { QueryClient } from '@tanstack/react-query';

interface ChatConfig {
  supabase: SupabaseClient;
  queryClient: QueryClient;
  uploadMedia?: (file: File) => Promise<{ url: string }>;
  translations?: Record<string, string>;
}

const ChatContext = createContext<ChatConfig | null>(null);

export function ChatProvider({ 
  children, 
  config 
}: { 
  children: ReactNode; 
  config: ChatConfig;
}) {
  return (
    <ChatContext.Provider value={config}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChatConfig() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChatConfig must be used within ChatProvider');
  }
  return context;
}
```

---

## Bước 3: Refactor hooks để dùng inject dependencies

```typescript
// packages/chat/src/hooks/useConversations.ts
import { useQuery, useMutation } from '@tanstack/react-query';
import { useChatConfig } from '../components/ChatProvider';

export function useConversations(userId: string | null) {
  const { supabase, queryClient } = useChatConfig();
  
  // ... logic giữ nguyên, chỉ thay supabase import
  const conversationsQuery = useQuery({
    queryKey: ['conversations', userId],
    queryFn: async () => {
      if (!userId) return [];
      
      const { data, error } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', userId)
        .is('left_at', null);
        
      // ... rest of logic
    },
    enabled: !!userId,
  });
  
  // ... mutations
}
```

---

## Bước 4: Tạo package.json cho Chat package

```json
{
  "name": "@fun-ecosystem/chat",
  "version": "1.0.0",
  "type": "module",
  "main": "dist/index.cjs.js",
  "module": "dist/index.esm.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.esm.js",
      "require": "./dist/index.cjs.js",
      "types": "./dist/index.d.ts"
    }
  },
  "files": ["dist", "README.md"],
  "scripts": {
    "build": "rollup -c",
    "dev": "rollup -c -w",
    "test": "vitest"
  },
  "peerDependencies": {
    "react": "^18.0.0",
    "react-dom": "^18.0.0",
    "@supabase/supabase-js": "^2.90.0",
    "@tanstack/react-query": "^5.0.0",
    "date-fns": "^4.0.0",
    "lucide-react": "^0.400.0",
    "sonner": "^1.0.0"
  },
  "devDependencies": {
    "@rollup/plugin-typescript": "^11.1.6",
    "rollup": "^4.9.0",
    "rollup-plugin-dts": "^6.1.0",
    "typescript": "^5.3.0",
    "vitest": "^1.2.0"
  }
}
```

---

## Bước 5: Entry point export tất cả

```typescript
// packages/chat/src/index.ts

// Provider
export { ChatProvider, useChatConfig } from './components/ChatProvider';

// Components
export { ChatInput } from './components/ChatInput';
export { ChatSettingsDialog } from './components/ChatSettingsDialog';
export { ConversationList } from './components/ConversationList';
export { CreateGroupDialog } from './components/CreateGroupDialog';
export { GroupSettingsDialog } from './components/GroupSettingsDialog';
export { MessageBubble } from './components/MessageBubble';
export { MessageSearch } from './components/MessageSearch';
export { MessageThread } from './components/MessageThread';
export { NewConversationDialog } from './components/NewConversationDialog';
export { TypingIndicator } from './components/TypingIndicator';

// Hooks
export { useChatNotifications } from './hooks/useChatNotifications';
export { useChatSettings } from './hooks/useChatSettings';
export { useConversations, useConversation } from './hooks/useConversations';
export { useGroupConversations } from './hooks/useGroupConversations';
export { useMessages } from './hooks/useMessages';
export { useTypingIndicator } from './hooks/useTypingIndicator';

// Types
export type {
  Conversation,
  ConversationParticipant,
  Message,
  MessageReaction,
  ChatSettings,
} from './types';
```

---

## Bước 6: Sử dụng trong Fun Profile (Host App)

```typescript
// apps/fun-profile/src/pages/Chat.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { 
  ChatProvider, 
  ConversationList, 
  MessageThread 
} from '@fun-ecosystem/chat';

const queryClient = new QueryClient();

export default function ChatPage() {
  return (
    <QueryClientProvider client={queryClient}>
      <ChatProvider
        config={{
          supabase,
          queryClient,
          uploadMedia: async (file) => {
            // Custom upload logic
            const result = await uploadToR2(file);
            return { url: result.publicUrl };
          },
          translations: {
            'noConversations': 'Chưa có cuộc trò chuyện nào',
            'newMessage': 'Tin nhắn mới',
          }
        }}
      >
        <div className="flex">
          <ConversationList 
            conversations={[]}
            onSelect={(id) => navigate(`/chat/${id}`)}
          />
          <MessageThread conversationId={selectedId} />
        </div>
      </ChatProvider>
    </QueryClientProvider>
  );
}
```

---

## Bước 7: UI Components Strategy

### Option A: Copy các UI components cần thiết
```text
packages/chat/src/ui/
├── avatar.tsx      # Copy từ shadcn
├── button.tsx
├── dialog.tsx
├── scroll-area.tsx
└── ... 
```

### Option B: Tạo shared UI package (Khuyến nghị)
```text
packages/
├── ui/                    # Shared UI components
│   ├── src/
│   │   ├── button.tsx
│   │   ├── avatar.tsx
│   │   └── ...
│   └── package.json       # @fun-ecosystem/ui
│
└── chat/
    └── package.json       # Depends on @fun-ecosystem/ui
```

---

## Workflow cho Team Chat

```text
┌─────────────────────────────────────────────────────────────┐
│                    GIT WORKFLOW                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   fun-profile (main repo)                                   │
│   └── packages/                                             │
│       ├── chat/      ← Team Chat làm việc ở đây            │
│       ├── wallet/    ← Team Wallet                         │
│       └── ui/        ← Shared                              │
│                                                             │
│   Branch strategy:                                          │
│   - main                    (production)                    │
│   - develop                 (integration)                   │
│   - feature/chat-*          (Team Chat)                    │
│   - feature/wallet-*        (Team Wallet)                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Kế hoạch triển khai từng bước

| Tuần | Công việc | Chi tiết |
|------|-----------|----------|
| **1** | Setup monorepo | Cài pnpm workspaces, tạo cấu trúc thư mục |
| **1** | Tạo @fun-ecosystem/ui | Tách shadcn components dùng chung |
| **2** | Tạo ChatProvider | Dependency injection cho Supabase |
| **2** | Di chuyển hooks | Refactor để dùng ChatProvider |
| **3** | Di chuyển components | Cập nhật imports, test từng component |
| **3** | Build và publish | Setup rollup, build test |
| **4** | Integration testing | Tích hợp lại vào Fun Profile |

---

## Database Schema cần lưu ý

Chat module sử dụng các bảng sau (cần đảm bảo tồn tại):
- `conversations`
- `conversation_participants`
- `messages`
- `message_reactions`
- `message_reads`
- `chat_settings`

Team Chat cần tài liệu về schema này để phát triển.

---

## Lợi ích sau khi tách

1. **Phát triển độc lập**: Team Chat có thể add features mà không ảnh hưởng code khác
2. **Testing dễ hơn**: Unit test cho Chat module riêng
3. **Reusable**: Có thể dùng Chat trong nhiều apps (Fun Farm, Fun Play...)
4. **Versioning**: Quản lý version riêng, rollback dễ dàng
5. **Code ownership**: Rõ ràng ai chịu trách nhiệm gì

