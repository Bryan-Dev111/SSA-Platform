import type { AppLanguage, AppLocale } from '../lib/locale';

declare global {
  namespace Express {
    interface Locals {
      language: AppLanguage;
      locale: AppLocale;
    }
  }
}

export {};
