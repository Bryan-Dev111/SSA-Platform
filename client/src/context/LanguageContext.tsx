import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { TOptions } from 'i18next';
import i18n from '../i18n/i18n';
import { type AppLanguage } from '../i18n/translations';
import { localeFromLanguage } from '../i18n/locale';
import { LANGUAGE_STORAGE_KEY, readStoredLanguage } from '../i18n/storage';

type LanguageContextValue = {
  language: AppLanguage;
  locale: string;
  setLanguage: (next: AppLanguage) => void;
  /** Pass a string as the second arg for default text; pass an object for i18n interpolation/plural options. */
  t: (key: string, fallbackOrOptions?: string | TOptions) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<AppLanguage>(readStoredLanguage);

  useEffect(() => {
    void i18n.changeLanguage(language);
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    } catch {
      // ignore storage errors
    }
    document.documentElement.lang = localeFromLanguage(language);
  }, [language]);

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      locale: localeFromLanguage(language),
      setLanguage,
      t: (key, fallbackOrOptions) => {
        const fixedT = i18n.getFixedT(language);
        if (fallbackOrOptions === undefined) {
          return String(fixedT(key));
        }
        if (typeof fallbackOrOptions === 'string') {
          return String(fixedT(key, { defaultValue: fallbackOrOptions }));
        }
        return String(fixedT(key, fallbackOrOptions));
      },
    }),
    [language]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return ctx;
}

