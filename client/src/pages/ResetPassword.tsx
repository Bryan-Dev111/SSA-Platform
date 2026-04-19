/**
 * Public: set a new password using token from email (?token=).
 */
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { LoginBrandedShell } from '../components/LoginBrandedShell';
import { apiJson } from '../api/client';

export function ResetPassword() {
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
      setError('Missing reset token. Open the link from your email or request a new reset.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
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
      let msg = err instanceof Error ? err.message : 'Reset failed';
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
          <h1 className="login-title">Set new password</h1>
          <p className="login-subtitle">Choose a strong password for your account.</p>
        </div>

        {success ? (
          <>
            <p style={{ marginBottom: '1rem' }}>Your password has been updated.</p>
            <Link to="/login" className="btn login-submit login-submit-teal" style={{ textAlign: 'center', textDecoration: 'none' }}>
              Sign in
            </Link>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="login-form">
            {!tokenFromUrl ? (
              <div className="alert-error" style={{ marginBottom: '1rem' }}>
                This page needs a valid link from your reset email.{' '}
                <Link to="/forgot-password" className="login-footer-link">
                  Request a new link
                </Link>
              </div>
            ) : null}
            {error ? <div className="alert-error" style={{ marginBottom: '1rem' }}>{error}</div> : null}
            <div className="input-group">
              <label htmlFor="reset-password" className="input-label">
                New password
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
                Confirm password
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
              Show passwords
            </label>
            <button
              type="submit"
              className="btn login-submit login-submit-teal"
              disabled={submitting || !tokenFromUrl}
            >
              {submitting ? 'Saving…' : 'Update password'}
            </button>
          </form>
        )}

        <p className="login-help-back">
          <Link to="/login" className="login-footer-link">
            Back to sign in
          </Link>
        </p>
      </div>
    </LoginBrandedShell>
  );
}
