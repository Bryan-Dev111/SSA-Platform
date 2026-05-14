import { useLanguage } from '../context/LanguageContext';
import type { AppLanguage } from '../i18n/translations';

const options: Array<{ code: AppLanguage; key: string }> = [
  { code: 'en', key: 'language.english' },
  { code: 'es', key: 'language.spanish' },
  { code: 'fr', key: 'language.french' },
];

function FlagIcon({ code }: { code: AppLanguage }) {
  if (code === 'en') {
    return (
      <svg className="language-flag-image" viewBox="0 0 64 48" aria-hidden>
        <rect width="64" height="48" fill="#b22234" />
        <rect y="4" width="64" height="4" fill="#fff" />
        <rect y="12" width="64" height="4" fill="#fff" />
        <rect y="20" width="64" height="4" fill="#fff" />
        <rect y="28" width="64" height="4" fill="#fff" />
        <rect y="36" width="64" height="4" fill="#fff" />
        <rect y="44" width="64" height="4" fill="#fff" />
        <rect width="28" height="20" fill="#3c3b6e" />
      </svg>
    );
  }
  if (code === 'es') {
    return (
      <svg className="language-flag-image" viewBox="0 0 64 48" aria-hidden>
        <rect width="64" height="48" fill="#c60b1e" />
        <rect y="12" width="64" height="24" fill="#ffc400" />
      </svg>
    );
  }
  return (
    <svg className="language-flag-image" viewBox="0 0 64 48" aria-hidden>
      <rect width="21.33" height="48" x="0" fill="#0055a4" />
      <rect width="21.34" height="48" x="21.33" fill="#fff" />
      <rect width="21.33" height="48" x="42.67" fill="#ef4135" />
    </svg>
  );
}

export function LanguageFlagSelector({ className }: { className?: string }) {
  const { language, setLanguage, t } = useLanguage();
  return (
    <div className={className ?? ''} role="group" aria-label={t('language.selectorAria')}>
      {options.map((opt) => (
        <button
          key={opt.code}
          type="button"
          className={`language-flag-btn${language === opt.code ? ' active' : ''}`}
          onClick={() => setLanguage(opt.code)}
          aria-label={t(opt.key)}
          title={t(opt.key)}
        >
          <FlagIcon code={opt.code} />
        </button>
      ))}
    </div>
  );
}

