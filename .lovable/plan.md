

# Kế hoạch: Chuyển đổi sang Monorepo với pnpm Workspaces

## Tổng quan

Chuyển đổi dự án Fun Profile sang kiến trúc Monorepo cho phép các team phát triển độc lập trên các module: **Chat**, **Wallet**, **Game** và chia sẻ code qua các package chung.

## Kiến trúc mục tiêu

```text
fun-profile/
├── apps/
│   └── web/                      # Ứng dụng chính (hiện tại là src/)
│       ├── src/
│       │   ├── pages/            # Pages sử dụng các packages
│       │   ├── components/       # Components riêng của app (admin, feed, friends, layout...)
│       │   └── ...
│       ├── package.json
│       └── vite.config.ts
│
├── packages/
│   ├── ui/                       # @fun/ui - Shared UI components (shadcn)
│   │   ├── src/
│   │   │   ├── button.tsx
│   │   │   ├── dialog.tsx
│   │   │   └── ... (50+ components)
│   │   └── package.json
│   │
│   ├── core/                     # @fun/core - Shared logic
│   │   ├── src/
│   │   │   ├── supabase/         # Supabase client & types
│   │   │   ├── i18n/             # Language context
│   │   │   ├── hooks/            # Shared hooks (use-mobile, use-toast)
│   │   │   └── utils/            # cn(), formatters
│   │   └── package.json
│   │
│   ├── chat/                     # @fun/chat - ĐÃ CÓ SẴN
│   │   └── ...
│   │
│   ├── wallet/                   # @fun/wallet - Team Wallet
│   │   ├── src/
│   │   │   ├── components/       # 7 wallet components
│   │   │   ├── hooks/            # useTokenBalances
│   │   │   ├── providers/        # WalletProvider (wagmi config)
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   └── game/                     # @fun/game - Team Game (tương lai)
│       └── ...
│
├── sdk-package/                  # @fun-ecosystem/sso-sdk - ĐÃ CÓ SẴN
│
├── pnpm-workspace.yaml           # Định nghĩa workspaces
├── package.json                  # Root scripts & shared devDeps
└── turbo.json                    # Optional: build orchestration
```

---

## Giai đoạn 1: Setup Monorepo (Tuần 1)

### 1.1 Cài đặt pnpm và workspace config

**Tạo file**: `pnpm-workspace.yaml`
```yaml
packages:
  - 'apps/*'
  - 'packages/*'
  - 'sdk-package'
```

**Cập nhật root**: `package.json`
```json
{
  "name": "fun-ecosystem",
  "private": true,
  "scripts": {
    "dev": "pnpm --filter @fun/web dev",
    "build": "pnpm -r build",
    "build:packages": "pnpm --filter './packages/*' build",
    "lint": "pnpm -r lint",
    "type-check": "pnpm -r type-check"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "turbo": "^2.0.0"
  },
  "engines": {
    "node": ">=20.0.0",
    "pnpm": ">=9.0.0"
  }
}
```

### 1.2 Di chuyển app chính vào apps/web/

```text
Trước:                          Sau:
src/                    →       apps/web/src/
vite.config.ts          →       apps/web/vite.config.ts
index.html              →       apps/web/index.html
public/                 →       apps/web/public/
tsconfig.app.json       →       apps/web/tsconfig.json
```

---

## Giai đoạn 2: Tạo Shared Packages (Tuần 1-2)

### 2.1 Package @fun/core

**Chứa:**
- Supabase client singleton với TypeScript types
- LanguageContext và translations
- Shared hooks: `use-mobile`, `use-toast`, `useDebounce`
- Utility functions: `cn()`, formatters

**File**: `packages/core/package.json`
```json
{
  "name": "@fun/core",
  "version": "1.0.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": "./dist/index.js",
    "./supabase": "./dist/supabase/index.js",
    "./i18n": "./dist/i18n/index.js",
    "./hooks": "./dist/hooks/index.js"
  },
  "peerDependencies": {
    "react": "^18.0.0",
    "@supabase/supabase-js": "^2.90.0"
  }
}
```

**Cách sử dụng trong các packages khác:**
```typescript
// Trong @fun/chat, @fun/wallet
import { supabase } from '@fun/core/supabase';
import { useLanguage } from '@fun/core/i18n';
import { cn } from '@fun/core';
```

### 2.2 Package @fun/ui

**Di chuyển tất cả shadcn components từ `src/components/ui/`**

**File**: `packages/ui/package.json`
```json
{
  "name": "@fun/ui",
  "version": "1.0.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": "./dist/index.js",
    "./button": "./dist/button.js",
    "./dialog": "./dist/dialog.js",
    "./avatar": "./dist/avatar.js"
  },
  "peerDependencies": {
    "react": "^18.0.0",
    "@radix-ui/react-dialog": "^1.1.0",
    "@radix-ui/react-avatar": "^1.1.0",
    "class-variance-authority": "^0.7.0",
    "tailwind-merge": "^2.0.0"
  }
}
```

**Cách import:**
```typescript
import { Button } from '@fun/ui/button';
import { Dialog } from '@fun/ui/dialog';
// Hoặc
import { Button, Dialog, Avatar } from '@fun/ui';
```

---

## Giai đoạn 3: Tách Wallet Module (Tuần 2-3)

### 3.1 Cấu trúc @fun/wallet

```text
packages/wallet/
├── src/
│   ├── index.ts
│   ├── types.ts
│   │
│   ├── providers/
│   │   └── WalletProvider.tsx    # Wagmi/RainbowKit config
│   │
│   ├── components/
│   │   ├── WalletHeader.tsx
│   │   ├── WalletManagement.tsx
│   │   ├── WalletCenterContainer.tsx
│   │   ├── WalletSettingsDialog.tsx
│   │   ├── SendTab.tsx
│   │   ├── ReceiveTab.tsx
│   │   └── index.ts
│   │
│   └── hooks/
│       ├── useTokenBalances.ts
│       └── index.ts
│
├── package.json
├── tsconfig.json
└── rollup.config.js
```

### 3.2 WalletProvider với Dependency Injection

```typescript
// packages/wallet/src/providers/WalletProvider.tsx
import { createContext, useContext, ReactNode } from 'react';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { bsc } from 'wagmi/chains';
import { RainbowKitProvider, getDefaultConfig } from '@rainbow-me/rainbowkit';

interface WalletConfig {
  projectId: string;                    // WalletConnect project ID
  appName: string;
  chains?: readonly [typeof bsc];
  supabase?: SupabaseClient;            // Optional: for custodial wallet
  onTransactionSuccess?: (tx: TransactionResult) => void;
}

export function WalletProvider({ 
  children, 
  config 
}: { 
  children: ReactNode; 
  config: WalletConfig 
}) {
  const wagmiConfig = createConfig({
    chains: config.chains || [bsc],
    transports: { [bsc.id]: http() },
    // ... RainbowKit setup
  });

  return (
    <WagmiProvider config={wagmiConfig}>
      <RainbowKitProvider>
        <WalletConfigContext.Provider value={config}>
          {children}
        </WalletConfigContext.Provider>
      </RainbowKitProvider>
    </WagmiProvider>
  );
}
```

### 3.3 Package.json cho Wallet

```json
{
  "name": "@fun/wallet",
  "version": "1.0.0",
  "peerDependencies": {
    "react": "^18.0.0",
    "wagmi": "^2.19.0",
    "viem": "^2.0.0",
    "@rainbow-me/rainbowkit": "^2.0.0",
    "@fun/ui": "workspace:*",
    "@fun/core": "workspace:*"
  }
}
```

---

## Giai đoạn 4: Cập nhật Chat Package (Tuần 2)

### 4.1 Thêm dependency vào @fun/ui và @fun/core

**Cập nhật**: `packages/chat/package.json`
```json
{
  "name": "@fun/chat",
  "peerDependencies": {
    "@fun/ui": "workspace:*",
    "@fun/core": "workspace:*",
    "react": "^18.0.0",
    "@tanstack/react-query": "^5.0.0"
  }
}
```

**Refactor imports trong chat components:**
```typescript
// Trước
import { cn } from '../utils/cn';
import { Button } from '../../ui/button';

// Sau
import { cn } from '@fun/core';
import { Button, Dialog, Avatar } from '@fun/ui';
```

---

## Giai đoạn 5: Tích hợp vào App chính (Tuần 3-4)

### 5.1 Cập nhật apps/web/package.json

```json
{
  "name": "@fun/web",
  "dependencies": {
    "@fun/core": "workspace:*",
    "@fun/ui": "workspace:*",
    "@fun/chat": "workspace:*",
    "@fun/wallet": "workspace:*"
  }
}
```

### 5.2 Sử dụng packages trong Pages

**Chat Page:**
```typescript
// apps/web/src/pages/Chat.tsx
import { ChatProvider, ConversationList, MessageThread } from '@fun/chat';
import { supabase } from '@fun/core/supabase';
import { useQueryClient } from '@tanstack/react-query';

export default function Chat() {
  const queryClient = useQueryClient();
  
  return (
    <ChatProvider config={{
      supabase,
      queryClient,
      currentUserId: user.id,
      uploadMedia: async (file) => uploadToR2(file),
    }}>
      <ConversationList />
      <MessageThread />
    </ChatProvider>
  );
}
```

**Wallet Page:**
```typescript
// apps/web/src/pages/Wallet.tsx
import { WalletProvider, WalletManagement } from '@fun/wallet';

export default function Wallet() {
  return (
    <WalletProvider config={{
      projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID,
      appName: 'Fun Profile',
    }}>
      <WalletManagement />
    </WalletProvider>
  );
}
```

---

## Giai đoạn 6: Setup CI/CD và Git Workflow

### 6.1 Branch Strategy

```text
main                    # Production
├── develop             # Integration branch
│   ├── feature/chat-*          # Team Chat
│   ├── feature/wallet-*        # Team Wallet
│   ├── feature/game-*          # Team Game (tương lai)
│   └── feature/core-*          # Shared infrastructure
```

### 6.2 Turbo.json cho Build Optimization

```json
{
  "$schema": "https://turbo.build/schema.json",
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {},
    "type-check": {}
  }
}
```

### 6.3 GitHub Actions

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm build:packages
      - run: pnpm lint
      - run: pnpm type-check
```

---

## Tóm tắt các bước thực hiện

| Tuần | Công việc | Package | Chi tiết |
|------|-----------|---------|----------|
| **1** | Setup monorepo | Root | pnpm workspace, turbo.json |
| **1** | Di chuyển app | apps/web | src/, configs |
| **1-2** | Tạo @fun/core | packages/core | supabase, i18n, utils |
| **1-2** | Tạo @fun/ui | packages/ui | 50+ shadcn components |
| **2** | Cập nhật @fun/chat | packages/chat | Dùng @fun/ui, @fun/core |
| **2-3** | Tách @fun/wallet | packages/wallet | 7 components, useTokenBalances |
| **3-4** | Tích hợp | apps/web | Import từ packages |
| **4** | CI/CD | GitHub | Actions, branch protection |

---

## Lợi ích đạt được

| Lợi ích | Mô tả |
|---------|-------|
| **Phát triển song song** | Team Chat, Wallet, Game làm việc độc lập |
| **Code sharing** | UI và Core dùng chung, không duplicate |
| **Build nhanh hơn** | Turbo cache, chỉ build những gì thay đổi |
| **Testing dễ** | Test riêng từng package |
| **Versioning** | Mỗi package có version riêng |
| **Onboarding nhanh** | Dev mới chỉ cần hiểu 1 package |

---

## Lưu ý cho Lovable

Do Lovable chưa hỗ trợ pnpm workspaces natively, có 2 cách tiếp cận:

**Cách 1: Development trên Lovable + Build/Deploy riêng**
- Develop packages trong thư mục packages/
- Build và publish qua GitHub Actions
- Import packages từ npm registry

**Cách 2: Symbolic linking trong Lovable**
- Giữ structure packages/ nhưng import trực tiếp từ source
- Dùng tsconfig paths để alias
- Build thành single bundle khi deploy

---

## Files cần tạo

1. `pnpm-workspace.yaml` - Workspace definition
2. `turbo.json` - Build pipeline
3. `packages/core/` - Shared logic package
4. `packages/ui/` - UI components package
5. `packages/wallet/` - Wallet module
6. `apps/web/` - Di chuyển app hiện tại
7. `.github/workflows/ci.yml` - CI pipeline

