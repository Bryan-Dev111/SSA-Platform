/**
 * Public: submit an access request (stored + admin notification email when configured).
 */
import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { LoginBrandedShell } from '../components/LoginBrandedShell';
import { useLanguage } from '../context/LanguageContext';
import { apiJson } from '../api/client';

const contactEmail = import.meta.env.VITE_CONTACT_EMAIL as string | undefined;

export function RequestAccess() {
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [organization, setOrganization] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [doneMessage, setDoneMessage] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setDoneMessage(null);
    setSubmitting(true);
    try {
      const res = await apiJson<{ ok?: boolean; message?: string; error?: string }>(
        '/auth/request-access',
        {
          method: 'POST',
          body: JSON.stringify({
            email: email.trim().toLowerCase(),
            fullName: fullName.trim(),
            organization: organization.trim() || undefined,
            message: message.trim() || undefined,
          }),
        }
      );
      if (res.message) setDoneMessage(res.message);
      else
        setDoneMessage(t('request.thankYou'));
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
          <h1 className="login-title">{t('request.title')}</h1>
          <p className="login-subtitle">
            {t('request.subtitle')}
          </p>
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
              <label htmlFor="req-email" className="input-label">
                {t('auth.email')} <span style={{ color: 'var(--color-danger, #b91c1c)' }}>*</span>
              </label>
              <input
                id="req-email"
                type="email"
                className="input login-input-soft"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="you@company.com"
                disabled={submitting}
                maxLength={254}
              />
            </div>
            <div className="input-group">
              <label htmlFor="req-name" className="input-label">
                {t('request.fullName')} <span style={{ color: 'var(--color-danger, #b91c1c)' }}>*</span>
              </label>
              <input
                id="req-name"
                type="text"
                className="input login-input-soft"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                autoComplete="name"
                placeholder="Jane Doe"
                disabled={submitting}
                maxLength={200}
              />
            </div>
            <div className="input-group">
              <label htmlFor="req-org" className="input-label">
                {t('request.organization')}
              </label>
              <input
                id="req-org"
                type="text"
                className="input login-input-soft"
                value={organization}
                onChange={(e) => setOrganization(e.target.value)}
                autoComplete="organization"
                placeholder="Company or team"
                disabled={submitting}
                maxLength={200}
              />
            </div>
            <div className="input-group">
              <label htmlFor="req-message" className="input-label">
                {t('request.message')}{' '}
                <span style={{ fontWeight: 400, color: 'var(--color-text-muted)' }}>{t('request.optional')}</span>
              </label>
              <textarea
                id="req-message"
                className="input login-input-soft"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Role needed, supplier name, or other context"
                disabled={submitting}
                rows={4}
                maxLength={4000}
                style={{ resize: 'vertical', minHeight: '5rem' }}
              />
            </div>
            <button type="submit" className="btn login-submit login-submit-brand" disabled={submitting}>
              {submitting ? t('request.submitting') : t('request.submit')}
            </button>
          </form>
        ) : null}

        <div className="login-help-body" style={{ marginTop: doneMessage ? '0.5rem' : '1rem' }}>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginBottom: '0.75rem' }}>
            {t('request.accountsNotSelfActivated')}
          </p>
          {contactEmail ? (
            <p style={{ fontSize: 'var(--text-sm)' }}>
              {t('request.questions')}{' '}
              <a className="login-footer-link" href={`mailto:${contactEmail}?subject=Sentinel%20access%20request`}>
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
