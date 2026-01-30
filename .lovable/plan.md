# Kế hoạch: Chuyển đổi sang Monorepo với pnpm Workspaces

> **Trạng thái**: 🚧 Đang triển khai
> **Cập nhật**: 2026-01-30
> **Tiến độ**: Giai đoạn 1 hoàn thành

## ✅ Đã hoàn thành

### Giai đoạn 1: Setup Monorepo
- [x] `pnpm-workspace.yaml` - Workspace definition
- [x] `turbo.json` - Build pipeline configuration
- [x] `packages/chat/` - Chat module đã được tách ra

### Chat Module (@fun-ecosystem/chat)
- [x] ChatProvider với Dependency Injection
- [x] 10 Components: MessageThread, ConversationList, ChatInput, etc.
- [x] 7 Hooks: useConversations, useMessages, useTypingIndicator, etc.
- [x] Types và translations

---

## 📋 Còn lại

### Giai đoạn 2: Shared Packages (Tuần 1-2)
- [ ] `packages/core/` - Supabase client, i18n, shared hooks
- [ ] `packages/ui/` - 50+ shadcn components

### Giai đoạn 3: Wallet Module (Tuần 2-3)
- [ ] `packages/wallet/` - Team Wallet

### Giai đoạn 4: Integration (Tuần 3-4)
- [ ] Cập nhật imports trong app chính
- [ ] CI/CD pipeline

---

## Kiến trúc hiện tại

```text
fun-profile/
├── packages/
│   └── chat/                 # ✅ @fun-ecosystem/chat
│       ├── src/
│       │   ├── components/   # 10 React components
│       │   ├── hooks/        # 7 custom hooks
│       │   ├── utils/        # cn, translations
│       │   └── index.ts      # Entry point
│       ├── package.json
│       ├── tsconfig.json
│       └── rollup.config.js
│
├── sdk-package/              # ✅ @fun-ecosystem/sso-sdk
│
├── src/                      # App chính (giữ nguyên trong Lovable)
│   ├── components/
│   ├── pages/
│   └── ...
│
├── pnpm-workspace.yaml       # ✅ Workspace config
└── turbo.json                # ✅ Build orchestration
```

---

## Lưu ý Lovable

Do Lovable build trực tiếp từ `src/`, chúng ta sử dụng **Cách 2: Development trong packages/**:

1. **Develop** modules trong `packages/`
2. **Build** packages qua GitHub Actions khi push
3. **Publish** lên npm registry (private hoặc public)
4. **Import** vào app chính qua npm dependencies

Trong Lovable, app chính vẫn giữ structure `src/` để deploy hoạt động.

---

## Hướng dẫn Team

### Team Chat
```bash
cd packages/chat
npm run dev    # Watch mode
npm run build  # Build for production
```

### Sử dụng trong App
```typescript
// Sau khi publish lên npm
import { ChatProvider, MessageThread } from '@fun-ecosystem/chat';

// Hoặc import trực tiếp từ source (development)
import { ChatProvider } from '../packages/chat/src';
```

---

## Dependencies giữa Packages

```text
@fun-ecosystem/chat
  ├── peerDeps: react, @supabase/supabase-js, @tanstack/react-query
  └── (future) @fun/ui, @fun/core

@fun/wallet (planned)
  ├── peerDeps: react, wagmi, viem
  └── (future) @fun/ui, @fun/core

@fun/core (planned)
  └── exports: supabase client, i18n, utils

@fun/ui (planned)
  └── exports: shadcn components
```
