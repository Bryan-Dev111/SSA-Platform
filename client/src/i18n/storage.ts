import type { AppLanguage } from './translations';

/** Single source for persisted UI language (used by i18next init + LanguageContext). */
export const LANGUAGE_STORAGE_KEY = 'sentinel.language';

export function readStoredLanguage(): AppLanguage {
  try {
    const raw = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (raw === 'en' || raw === 'es' || raw === 'fr') return raw;
  } catch {
    /* ignore */
  }
  return 'en';
}
