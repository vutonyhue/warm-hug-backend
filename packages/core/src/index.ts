/**
 * @fun-ecosystem/core
 * Core utilities, hooks, and types for Fun Ecosystem
 */

// Utils
export { cn } from './utils/cn';
export {
  formatNumber,
  formatUsd,
  formatTokenBalance,
  formatDate,
  formatRelativeTime,
  formatDurationTime,
  shortenAddress,
} from './utils/formatters';

// Hooks
export { useIsMobile, useIsMobileOrTablet } from './hooks/use-mobile';
export { useDebounce, usePrevious, useStableCallback } from './hooks/use-debounce';
export { useIntersectionObserver } from './hooks/use-intersection';

// i18n
export { LanguageProvider, useLanguage, translations } from './i18n/context';
export type { Language, TranslationKey, LanguageContextType } from './i18n/types';

// Types
export type * from './types/auth';
export type * from './types/posts';
export type * from './types/common';
