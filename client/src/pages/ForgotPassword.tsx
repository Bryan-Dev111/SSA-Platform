/**
 * Public: request a password reset email (token link to /reset-password).
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { LoginBrandedShell } from '../components/LoginBrandedShell';
import { useLanguage } from '../context/LanguageContext';
import { apiJson } from '../api/client';

const contactEmail = import.meta.env.VITE_CONTACT_EMAIL as string | undefined;

export function ForgotPassword() {
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [doneMessage, setDoneMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setDoneMessage(null);
    if (!email.trim()) return;
    setSubmitting(true);
    try {
      const res = await apiJson<{ ok?: boolean; message?: string; error?: string }>('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      if (res.message) setDoneMessage(res.message);
      else setDoneMessage(t('forgot.defaultDone'));
    } catch (err) {
      let msg = err instanceof Error ? err.message : 'Request failed';
      try {
        const parsed = JSON.parse(msg) as { error?: string };
        if (parsed?.error) msg = parsed.error;
      } catch {
        /* keep msg */
      }
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <LoginBrandedShell>
      <div className="login-card">
        <div className="login-brand-row">
          <img src="/logo.png" alt="Sentinel" className="login-logo-mark" />
        </div>
        <div className="login-header">
          <h1 className="login-title">{t('forgot.title')}</h1>
          <p className="login-subtitle">{t('forgot.subtitle')}</p>
        </div>

        {error ? <div className="alert-error" style={{ marginBottom: '1rem' }}>{error}</div> : null}
        {doneMessage ? (
          <div
            style={{
              marginBottom: '1rem',
              padding: '0.75rem 1rem',
              borderRadius: 8,
              background: 'rgba(37, 99, 235, 0.1)',
              border: '1px solid rgba(37, 99, 235, 0.3)',
              color: 'var(--color-text, #111827)',
              fontSize: 'var(--text-sm)',
            }}
          >
            {doneMessage}
          </div>
        ) : null}

        {!doneMessage ? (
          <form onSubmit={handleSubmit} className="login-form">
            <div className="input-group">
              <label htmlFor="forgot-email" className="input-label">
                {t('auth.email')}
              </label>
              <input
                id="forgot-email"
                type="email"
                className="input login-input-soft"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="you@company.com"
                disabled={submitting}
              />
            </div>
            <button type="submit" className="btn login-submit login-submit-brand" disabled={submitting}>
              {submitting ? t('forgot.sending') : t('forgot.sendResetLink')}
            </button>
          </form>
        ) : null}

        <div className="login-help-body" style={{ marginTop: doneMessage ? '0.5rem' : '1rem' }}>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginBottom: '0.75rem' }}>
            {t('forgot.linkExpiry')}
          </p>
          {contactEmail ? (
            <p style={{ fontSize: 'var(--text-sm)' }}>
              {t('forgot.needHelp')}{' '}
              <a className="login-footer-link" href={`mailto:${contactEmail}?subject=Sentinel%20password%20help`}>
                {contactEmail}
              </a>
            </p>
          ) : null}
        </div>

        <p className="login-help-back">
          <Link to="/login" className="login-footer-link">
            {t('request.backToSignIn')}
          </Link>
        </p>
      </div>
    </LoginBrandedShell>
  );
}
