import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { translations } from './translations';
import { Language, TranslationKey, LanguageContextType, SUPPORTED_LANGUAGES } from './types';

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const STORAGE_KEY = 'fun_profile_language';

/**
 * Detect browser language
 */
const detectBrowserLanguage = (): Language => {
  if (typeof navigator === 'undefined') return 'en';
  
  const browserLang = navigator.language.toLowerCase();
  // Check for supported languages
  for (const lang of SUPPORTED_LANGUAGES) {
    if (browserLang.startsWith(lang)) return lang;
  }
  return 'en'; // Default to English
};

/**
 * Get saved language or detect from browser
 */
const getInitialLanguage = (): Language => {
  if (typeof localStorage !== 'undefined') {
    const saved = localStorage.getItem(STORAGE_KEY) as Language | null;
    if (saved && SUPPORTED_LANGUAGES.includes(saved)) {
      return saved;
    }
  }
  return detectBrowserLanguage();
};

/**
 * Language Provider Component
 * Wrap your app with this to enable i18n
 * 
 * @example
 * <LanguageProvider>
 *   <App />
 * </LanguageProvider>
 */
export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(getInitialLanguage);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem(STORAGE_KEY, lang);
    // Update HTML lang attribute for accessibility
    document.documentElement.lang = lang;
  }, []);

  // Set initial HTML lang attribute
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  /**
   * Translation function
   * Returns the translated string for the given key
   */
  const t = useCallback((key: TranslationKey): string => {
    const langTranslations = translations[language] as Record<string, string>;
    const enTranslations = translations.en as Record<string, string>;
    return langTranslations[key] || enTranslations[key] || key;
  }, [language]);

  const value = useMemo(() => ({
    language,
    setLanguage,
    t,
  }), [language, setLanguage, t]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

/**
 * Hook to access language context
 * 
 * @example
 * const { t, language, setLanguage } = useLanguage();
 * return <h1>{t('welcome')}</h1>;
 */
export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

// Export translations for direct use
export { translations };
