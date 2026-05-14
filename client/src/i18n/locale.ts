import type { AppLanguage } from './translations';
import i18n from './i18n';

export const languageToLocale: Record<AppLanguage, string> = {
  en: 'en-US',
  es: 'es-ES',
  fr: 'fr-FR',
};

export function localeFromLanguage(language: AppLanguage): string {
  return languageToLocale[language] ?? languageToLocale.en;
}

/** BCP-47-ish locale for Intl formatting; follows active i18n language (not only `document.lang`). */
export function getDocumentLocale(): string {
  const raw = (i18n.resolvedLanguage ?? i18n.language ?? 'en').toLowerCase();
  const code = raw.split('-')[0] ?? 'en';
  if (code === 'es') return languageToLocale.es;
  if (code === 'fr') return languageToLocale.fr;
  return languageToLocale.en;
}
