export type AppLanguage = 'en' | 'es' | 'fr';
export type AppLocale = 'en-US' | 'es-ES' | 'fr-FR';

const LANGUAGE_TO_LOCALE: Record<AppLanguage, AppLocale> = {
  en: 'en-US',
  es: 'es-ES',
  fr: 'fr-FR',
};

function toLanguage(raw: string | null | undefined): AppLanguage {
  const value = (raw ?? '').trim().toLowerCase();
  if (value.startsWith('es')) return 'es';
  if (value.startsWith('fr')) return 'fr';
  return 'en';
}

export function localeFromLanguage(language: AppLanguage): AppLocale {
  return LANGUAGE_TO_LOCALE[language] ?? LANGUAGE_TO_LOCALE.en;
}

export function parseRequestLanguage(acceptLanguageHeader: string | null | undefined): AppLanguage {
  const first = (acceptLanguageHeader ?? '').split(',')[0]?.trim() ?? '';
  return toLanguage(first);
}

export function parseRequestLocale(acceptLanguageHeader: string | null | undefined): AppLocale {
  return localeFromLanguage(parseRequestLanguage(acceptLanguageHeader));
}
