/**
 * Public: set a new password using token from email (?token=).
 */
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { LoginBrandedShell } from '../components/LoginBrandedShell';
import { useLanguage } from '../context/LanguageContext';
import { apiJson } from '../api/client';

export function ResetPassword() {
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();
  const tokenFromUrl = searchParams.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!tokenFromUrl.trim()) {
      setError(t('reset.missingToken'));
      return;
    }
    if (password.length < 8) {
      setError(t('reset.minLength'));
      return;
    }
    if (password !== confirm) {
      setError(t('reset.passwordMismatch'));
      return;
    }
    setSubmitting(true);
    try {
      await apiJson<{ ok?: boolean; message?: string }>('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token: tokenFromUrl.trim(), password }),
      });
      setSuccess(true);
    } catch (err) {
      let msg = err instanceof Error ? err.message : t('reset.resetFailed');
      try {
        const parsed = JSON.parse(msg) as { error?: string };
        if (parsed?.error) msg = parsed.error;
      } catch {
        /* keep */
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
          <span className="login-wordmark">Sentinel</span>
        </div>
        <div className="login-header">
          <h1 className="login-title">{t('reset.title')}</h1>
          <p className="login-subtitle">{t('reset.subtitle')}</p>
        </div>

        {success ? (
          <>
            <p style={{ marginBottom: '1rem' }}>{t('reset.updated')}</p>
            <Link to="/login" className="btn login-submit login-submit-brand" style={{ textAlign: 'center', textDecoration: 'none' }}>
              {t('auth.signIn')}
            </Link>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="login-form">
            {!tokenFromUrl ? (
              <div className="alert-error" style={{ marginBottom: '1rem' }}>
                This page needs a valid link from your reset email.{' '}
                <Link to="/forgot-password" className="login-footer-link">
                  {t('reset.requestNewLink')}
                </Link>
              </div>
            ) : null}
            {error ? <div className="alert-error" style={{ marginBottom: '1rem' }}>{error}</div> : null}
            <div className="input-group">
              <label htmlFor="reset-password" className="input-label">
                {t('reset.newPassword')}
              </label>
              <input
                id="reset-password"
                type={showPassword ? 'text' : 'password'}
                className="input login-input-soft"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                disabled={submitting || !tokenFromUrl}
              />
            </div>
            <div className="input-group">
              <label htmlFor="reset-confirm" className="input-label">
                {t('reset.confirmPassword')}
              </label>
              <input
                id="reset-confirm"
                type={showPassword ? 'text' : 'password'}
                className="input login-input-soft"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                disabled={submitting || !tokenFromUrl}
              />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.75rem', fontSize: 'var(--text-sm)' }}>
              <input type="checkbox" checked={showPassword} onChange={(e) => setShowPassword(e.target.checked)} />
              {t('reset.showPasswords')}
            </label>
            <button
              type="submit"
              className="btn login-submit login-submit-brand"
              disabled={submitting || !tokenFromUrl}
            >
              {submitting ? t('reset.saving') : t('reset.updatePassword')}
            </button>
          </form>
        )}

        <p className="login-help-back">
          <Link to="/login" className="login-footer-link">
            {t('request.backToSignIn')}
          </Link>
        </p>
      </div>
    </LoginBrandedShell>
  );
}
