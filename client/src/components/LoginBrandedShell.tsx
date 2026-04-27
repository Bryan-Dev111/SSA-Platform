import type { ReactNode } from 'react';
import { useLanguage } from '../context/LanguageContext';

/** Split-screen layout: branded blue panel (left), form column (right). Shared by login and related auth pages. */
export function LoginBrandedShell({ children }: { children: ReactNode }) {
  const { t } = useLanguage();
  return (
    <div className="login-page">
      <div className="login-shell">
        <aside className="login-brand-panel">
          <div className="login-brand-bg-pattern" aria-hidden="true" />
          <div className="login-brand-content">
            <p className="login-brand-welcome">{t('auth.welcome')}</p>
            <div className="login-brand-message">
              <p className="login-brand-product-name">{t('auth.platformName')}</p>
              <p className="login-brand-tagline">
                {t('auth.brandTaglineLine1')}
                <br />
                {t('auth.brandTaglineLine2')}
              </p>
            </div>
            <p className="login-brand-attribution">{t('auth.bySentinel')}</p>
          </div>
        </aside>
        <div className="login-form-column">{children}</div>
      </div>
    </div>
  );
}
