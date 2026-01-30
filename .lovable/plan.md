

# Kế hoạch: Tạo Package @fun/core

## Tổng quan

Package `@fun/core` sẽ chứa tất cả types, hooks, và utilities dùng chung cho mọi module trong Fun Ecosystem (Chat, Wallet, Game...). Đây là foundation package mà các module khác sẽ phụ thuộc.

## Phân tích hiện trạng

### Files cần di chuyển vào @fun/core

| Loại | File nguồn | Mô tả |
|------|------------|-------|
| **Utils** | `src/lib/utils.ts` | Hàm `cn()` merge Tailwind classes |
| **Utils** | `src/lib/formatters.ts` | formatNumber, formatDate, formatRelativeTime, shortenAddress |
| **Hooks** | `src/hooks/use-mobile.tsx` | useIsMobile, useIsMobileOrTablet |
| **Hooks** | `src/hooks/useDebounce.ts` | Debounce hook cho search/input |
| **Hooks** | `src/hooks/useIntersectionObserver.ts` | Lazy loading, scroll animations |
| **i18n** | `src/i18n/LanguageContext.tsx` | LanguageProvider, useLanguage |
| **i18n** | `src/i18n/translations.ts` | 5500+ dòng translations (en/vi) |
| **Types** | `src/types/auth.ts` | AuthUser, AuthSession, OtpLoginResult |
| **Types** | `src/types/posts.ts` | Post, Comment, Reaction types |
| **Auth** | `src/utils/authHelpers.ts` | isSessionExpired, getValidSession |

---

## Cấu trúc Package

```text
packages/core/
├── package.json
├── tsconfig.json
├── rollup.config.js
├── README.md
│
└── src/
    ├── index.ts                    # Main entry point
    │
    ├── utils/
    │   ├── index.ts
    │   ├── cn.ts                   # Tailwind class merger
    │   ├── formatters.ts           # Number/date/address formatters
    │   └── auth.ts                 # Session validation helpers
    │
    ├── hooks/
    │   ├── index.ts
    │   ├── use-mobile.ts           # Responsive hooks
    │   ├── use-debounce.ts         # Debounce value
    │   └── use-intersection.ts     # Intersection observer
    │
    ├── i18n/
    │   ├── index.ts
    │   ├── context.tsx             # LanguageProvider
    │   ├── translations.ts         # All translations
    │   └── types.ts                # Language types
    │
    └── types/
        ├── index.ts
        ├── auth.ts                 # Authentication types
        ├── posts.ts                # Post/Feed types
        └── common.ts               # Shared common types
```

---

## Chi tiết Implementation

### 1. Package Configuration

**packages/core/package.json**
```json
{
  "name": "@fun-ecosystem/core",
  "version": "1.0.0",
  "description": "Core utilities, hooks, and types for Fun Ecosystem",
  "type": "module",
  "main": "dist/index.cjs.js",
  "module": "dist/index.esm.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.esm.js",
      "require": "./dist/index.cjs.js",
      "types": "./dist/index.d.ts"
    },
    "./utils": {
      "import": "./dist/utils/index.js",
      "types": "./dist/utils/index.d.ts"
    },
    "./hooks": {
      "import": "./dist/hooks/index.js",
      "types": "./dist/hooks/index.d.ts"
    },
    "./i18n": {
      "import": "./dist/i18n/index.js",
      "types": "./dist/i18n/index.d.ts"
    },
    "./types": {
      "import": "./dist/types/index.js",
      "types": "./dist/types/index.d.ts"
    }
  },
  "peerDependencies": {
    "react": "^18.0.0",
    "clsx": "^2.0.0",
    "tailwind-merge": "^2.0.0"
  }
}
```

### 2. Entry Points

**Main entry (index.ts)**
```typescript
// Utils
export { cn } from './utils/cn';
export * from './utils/formatters';
export * from './utils/auth';

// Hooks
export { useIsMobile, useIsMobileOrTablet } from './hooks/use-mobile';
export { useDebounce } from './hooks/use-debounce';
export { useIntersectionObserver } from './hooks/use-intersection';

// i18n
export { LanguageProvider, useLanguage } from './i18n/context';
export { translations } from './i18n/translations';
export type { Language, TranslationKey } from './i18n/types';

// Types
export type * from './types/auth';
export type * from './types/posts';
export type * from './types/common';
```

### 3. Các Module chi tiết

**utils/cn.ts** - Class merger cho Tailwind
```typescript
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

**utils/formatters.ts** - Formatting utilities
```typescript
export const formatNumber = (num: number, decimals?: number): string => {...}
export const formatUsd = (num: number): string => {...}
export const formatTokenBalance = (num: number): string => {...}
export const formatDate = (dateString: string): string => {...}
export const formatRelativeTime = (dateString: string): string => {...}
export const formatDurationTime = (seconds: number): string => {...}
export const shortenAddress = (address: string, chars?: number): string => {...}
```

**hooks/use-debounce.ts** - Debounce hook
```typescript
export function useDebounce<T>(value: T, delay: number): T {...}
```

**hooks/use-mobile.ts** - Responsive detection
```typescript
export function useIsMobile(): boolean {...}
export function useIsMobileOrTablet(): boolean {...}
```

**hooks/use-intersection.ts** - Intersection observer
```typescript
export function useIntersectionObserver<T extends HTMLElement>(
  options?: UseIntersectionObserverOptions
): [RefObject<T>, boolean] {...}
```

**i18n/context.tsx** - Language system
```typescript
export const LanguageProvider: React.FC<{children: ReactNode}> = ({children}) => {...}
export const useLanguage = (): LanguageContextType => {...}
```

**types/auth.ts** - Auth types
```typescript
export interface AuthUser {...}
export interface AuthSession {...}
export interface OtpLoginResult {...}
export interface Web3AuthResult {...}
export type AuthMethod = 'email' | 'wallet' | 'google';
```

**types/posts.ts** - Feed types
```typescript
export interface Post {...}
export interface Comment {...}
export interface PostReaction {...}
export type ReactionType = 'like' | 'love' | 'haha' | 'wow' | 'sad' | 'angry';
```

---

## Cách sử dụng trong các modules khác

### Trong @fun-ecosystem/chat
```typescript
// Cập nhật imports
import { cn } from '@fun-ecosystem/core';
import { useDebounce } from '@fun-ecosystem/core/hooks';
import { useLanguage } from '@fun-ecosystem/core/i18n';
```

### Trong App chính (src/)
```typescript
// Direct import
import { cn, formatNumber, useIsMobile } from '@fun-ecosystem/core';
import { useLanguage, LanguageProvider } from '@fun-ecosystem/core/i18n';
import type { AuthUser, Post } from '@fun-ecosystem/core/types';
```

### Trong tương lai @fun/wallet
```typescript
import { cn, shortenAddress, formatTokenBalance } from '@fun-ecosystem/core';
import { useIsMobile } from '@fun-ecosystem/core/hooks';
```

---

## Files cần tạo

| File | Mô tả |
|------|-------|
| `packages/core/package.json` | Package configuration |
| `packages/core/tsconfig.json` | TypeScript config |
| `packages/core/rollup.config.js` | Build configuration |
| `packages/core/README.md` | Documentation |
| `packages/core/src/index.ts` | Main entry point |
| `packages/core/src/utils/index.ts` | Utils entry |
| `packages/core/src/utils/cn.ts` | Class merger |
| `packages/core/src/utils/formatters.ts` | Formatters |
| `packages/core/src/utils/auth.ts` | Auth helpers |
| `packages/core/src/hooks/index.ts` | Hooks entry |
| `packages/core/src/hooks/use-mobile.ts` | Mobile detection |
| `packages/core/src/hooks/use-debounce.ts` | Debounce |
| `packages/core/src/hooks/use-intersection.ts` | Intersection observer |
| `packages/core/src/i18n/index.ts` | i18n entry |
| `packages/core/src/i18n/context.tsx` | Language provider |
| `packages/core/src/i18n/translations.ts` | Translations |
| `packages/core/src/i18n/types.ts` | Language types |
| `packages/core/src/types/index.ts` | Types entry |
| `packages/core/src/types/auth.ts` | Auth types |
| `packages/core/src/types/posts.ts` | Post types |
| `packages/core/src/types/common.ts` | Common types |

---

## Lợi ích

| Lợi ích | Mô tả |
|---------|-------|
| **DRY** | Không duplicate code giữa Chat, Wallet, Game |
| **Type Safety** | Shared types đảm bảo consistency |
| **i18n centralized** | Một nơi quản lý tất cả translations |
| **Easy updates** | Cập nhật utility 1 lần, apply cho toàn bộ |
| **Independent testing** | Unit test riêng cho core functions |

---

## Dependency Graph sau khi hoàn thành

```text
@fun-ecosystem/core (foundation)
       │
       ├── @fun-ecosystem/chat (depends on core)
       │
       ├── @fun-ecosystem/wallet (depends on core)
       │
       └── @fun-ecosystem/game (depends on core)
              │
              └── apps/web (imports all)
```

