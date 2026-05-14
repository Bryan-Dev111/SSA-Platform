import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { translations } from './translations';
import { readStoredLanguage } from './storage';

const resources = {
  en: { translation: translations.en },
  es: { translation: translations.es },
  fr: { translation: translations.fr },
};

void i18n.use(initReactI18next).init({
  resources,
  lng: readStoredLanguage(),
  fallbackLng: 'en',
  supportedLngs: ['en', 'es', 'fr'],
  nonExplicitSupportedLngs: true,
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});

export default i18n;
