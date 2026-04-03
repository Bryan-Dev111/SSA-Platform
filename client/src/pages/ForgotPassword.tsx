/**
 * Public: request a password reset email (token link to /reset-password).
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { LoginBrandedShell } from '../components/LoginBrandedShell';
import { apiJson } from '../api/client';

const contactEmail = import.meta.env.VITE_CONTACT_EMAIL as string | undefined;

export function ForgotPassword() {
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
      else setDoneMessage('If an account exists for that email, you will receive reset instructions shortly.');
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
        <div className="login-header">
          <img src="/logo.png" alt="Sentinel" className="login-logo" />
          <h1 className="login-title">Forgot password</h1>
          <p className="login-subtitle">Enter your email and we will send you a link to set a new password.</p>
        </div>

        {error ? <div className="alert-error" style={{ marginBottom: '1rem' }}>{error}</div> : null}
        {doneMessage ? (
          <div
            style={{
              marginBottom: '1rem',
              padding: '0.75rem 1rem',
              borderRadius: 8,
              background: 'rgba(34, 197, 94, 0.12)',
              border: '1px solid rgba(34, 197, 94, 0.35)',
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
                Email
              </label>
              <input
                id="forgot-email"
                type="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="you@company.com"
                disabled={submitting}
              />
            </div>
            <button type="submit" className="btn btn-primary login-submit" disabled={submitting}>
              {submitting ? 'Sending…' : 'Send reset link'}
            </button>
          </form>
        ) : null}

        <div className="login-help-body" style={{ marginTop: doneMessage ? '0.5rem' : '1rem' }}>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginBottom: '0.75rem' }}>
            The link expires in one hour. If you do not see the email, check your spam folder.
          </p>
          {contactEmail ? (
            <p style={{ fontSize: 'var(--text-sm)' }}>
              Need help?{' '}
              <a className="login-footer-link" href={`mailto:${contactEmail}?subject=Sentinel%20password%20help`}>
                {contactEmail}
              </a>
            </p>
          ) : null}
        </div>

        <p className="login-help-back">
          <Link to="/login" className="login-footer-link">
            Back to sign in
          </Link>
        </p>
      </div>
    </LoginBrandedShell>
  );
}
