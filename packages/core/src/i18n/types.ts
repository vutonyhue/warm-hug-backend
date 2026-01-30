import { translations } from './translations';

/**
 * Supported language codes
 */
export const SUPPORTED_LANGUAGES = ['en', 'vi', 'zh', 'ja', 'ko'] as const;

export type Language = (typeof SUPPORTED_LANGUAGES)[number];

/**
 * All available translation keys (derived from English translations)
 */
export type TranslationKey = keyof typeof translations.en;

/**
 * Language context type
 */
export interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey) => string;
}
