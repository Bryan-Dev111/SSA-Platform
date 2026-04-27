import type { AppLanguage } from './translations';

export const languageToLocale: Record<AppLanguage, string> = {
  en: 'en-US',
  es: 'es-ES',
  fr: 'fr-FR',
};

export function localeFromLanguage(language: AppLanguage): string {
  return languageToLocale[language] ?? languageToLocale.en;
}

export function getDocumentLocale(): string {
  if (typeof document === 'undefined') return languageToLocale.en;
  const lang = document.documentElement.lang?.toLowerCase() ?? '';
  if (lang.startsWith('es')) return languageToLocale.es;
  if (lang.startsWith('fr')) return languageToLocale.fr;
  return languageToLocale.en;
}
