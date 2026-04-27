import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { translations, type AppLanguage } from '../i18n/translations';
import { localeFromLanguage } from '../i18n/locale';

const STORAGE_KEY = 'sentinel.language';

type LanguageContextValue = {
  language: AppLanguage;
  locale: string;
  setLanguage: (next: AppLanguage) => void;
  t: (key: string, fallback?: string) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

function readInitialLanguage(): AppLanguage {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === 'en' || raw === 'es' || raw === 'fr') return raw;
  } catch {
    // ignore storage errors
  }
  return 'en';
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<AppLanguage>(readInitialLanguage);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, language);
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
      t: (key, fallback) => translations[language][key] ?? translations.en[key] ?? fallback ?? key,
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

