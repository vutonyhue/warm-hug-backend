# @fun-ecosystem/core

Core utilities, hooks, types, and i18n for Fun Ecosystem modules.

## Installation

```bash
pnpm add @fun-ecosystem/core
```

## Usage

### Utils

```typescript
import { cn, formatNumber, shortenAddress } from '@fun-ecosystem/core';
// Or from subpath
import { cn } from '@fun-ecosystem/core/utils';

// Tailwind class merger
cn('p-4', 'bg-primary', someCondition && 'text-white');

// Format numbers
formatNumber(1234567); // "1.234.567"
formatTokenBalance(0.00001234); // "0,00001234"

// Shorten wallet address
shortenAddress('0x1234...abcd'); // "0x1234...abcd"
```

### Hooks

```typescript
import { useIsMobile, useDebounce, useIntersectionObserver } from '@fun-ecosystem/core';
// Or from subpath
import { useIsMobile } from '@fun-ecosystem/core/hooks';

// Responsive detection
const isMobile = useIsMobile();

// Debounce values
const debouncedSearch = useDebounce(searchTerm, 300);

// Intersection observer for lazy loading
const [ref, isVisible] = useIntersectionObserver();
```

### i18n

```typescript
import { LanguageProvider, useLanguage } from '@fun-ecosystem/core/i18n';

// Wrap your app
<LanguageProvider>
  <App />
</LanguageProvider>

// Use in components
function MyComponent() {
  const { t, language, setLanguage } = useLanguage();
  return <h1>{t('welcome')}</h1>;
}
```

### Types

```typescript
import type { AuthUser, Post, ReactionType } from '@fun-ecosystem/core/types';

const user: AuthUser = {
  id: '123',
  email: 'user@example.com',
  username: 'johndoe',
};
```

## Modules

| Module | Description |
|--------|-------------|
| `utils` | Tailwind class merger, formatters, auth helpers |
| `hooks` | useIsMobile, useDebounce, useIntersectionObserver |
| `i18n` | LanguageProvider, useLanguage, translations |
| `types` | AuthUser, Post, Comment, ReactionType, etc. |

## Peer Dependencies

- `react` ^18.0.0
- `clsx` ^2.0.0
- `tailwind-merge` ^2.0.0

## License

MIT
