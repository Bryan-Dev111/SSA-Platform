/**
 * Login page: logo, form, auth API, redirect by role
 */
import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { LoginBrandedShell } from '../components/LoginBrandedShell';
import { apiJson } from '../api/client';

export function Login() {
  const { user, token, login, loading } = useAuth();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [legalKey, setLegalKey] = useState<'terms' | 'privacy' | null>(null);
  const [legalContent, setLegalContent] = useState<{ title: string; content: string } | null>(null);
  const [legalError, setLegalError] = useState<string | null>(null);
  const [legalLoading, setLegalLoading] = useState(false);

  if (loading) {
    return (
      <LoginBrandedShell>
        <div className="login-card">
          <div className="loading-message login-loading">
            <div className="loading-spinner" />
            Loading…
          </div>
        </div>
      </LoginBrandedShell>
    );
  }

  if (token && user) {
    return <Navigate to="/product-hub" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError('');
    setSubmitting(true);
    try {
      await login(email.trim().toLowerCase(), password);
      toast.success('Login successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setSubmitting(false);
    }
  };

  const openLegal = async (key: 'terms' | 'privacy') => {
    setLegalKey(key);
    setLegalLoading(true);
    setLegalError(null);
    try {
      const doc = await apiJson<{ title: string; content: string }>(`/legal/${key}`, {});
      setLegalContent({ title: doc.title, content: doc.content });
    } catch (err) {
      setLegalError(
        err instanceof Error
          ? err.message
          : 'Could not load legal content. Please contact your administrator.'
      );
      setLegalContent(null);
    } finally {
      setLegalLoading(false);
    }
  };

  return (
    <LoginBrandedShell>
      <div className="login-card">
        <div className="login-brand-row">
          <img src="/logo.png" alt="Sentinel" className="login-logo-mark" />
        </div>
        <div className="login-header">
          <h1 className="login-title">Sign in</h1>
          <p className="login-subtitle">Continue to Supplier Assurance Platform</p>
        </div>
        <form onSubmit={handleSubmit} className="login-form">
          <div className="input-group">
            <label htmlFor="email" className="input-label">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="input login-input-soft"
              placeholder="Enter your email"
            />
          </div>
          <div className="input-group">
            <label htmlFor="password" className="input-label">
              Password
            </label>
            <div className="login-password-wrap">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="input login-input-soft"
                placeholder="Enter your password"
              />
              <button
                type="button"
                className="login-password-toggle"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path
                      d="M3 3l18 18M10.6 10.6a2 2 0 003.7 1.1M9.9 5.1A10.4 10.4 0 0112 5c4.3 0 8 2.7 9.5 6.5-.6 1.5-1.5 2.8-2.6 3.9M6.3 6.3C4.3 7.7 2.8 9.7 2 12c1.5 3.8 5.2 6.5 9.5 6.5 1.4 0 2.7-.3 3.9-.8"
                      stroke="currentColor"
                      strokeWidth="1.75"
                      strokeLinecap="round"
                    />
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path
                      d="M12 5c-4.3 0-8 2.7-9.5 6.5 1.5 3.8 5.2 6.5 9.5 6.5s8-2.7 9.5-6.5C20 7.7 16.3 5 12 5z"
                      stroke="currentColor"
                      strokeWidth="1.75"
                    />
                    <circle cx="12" cy="11.5" r="2.5" fill="currentColor" />
                  </svg>
                )}
              </button>
            </div>
          </div>
          {error && <div className="alert-error">{error}</div>}
          <button type="submit" disabled={submitting} className="btn login-submit login-submit-brand">
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <div className="login-form-footer" aria-label="Account help">
          <Link to="/request-access" className="login-footer-link">
            Request access
          </Link>
          <span className="login-footer-divider" aria-hidden="true" />
          <Link to="/forgot-password" className="login-footer-link">
            Forgot password?
          </Link>
        </div>
        <div
          className="login-legal-text"
          style={{
            marginTop: '0.75rem',
            fontSize: 'var(--text-xs)',
            color: 'var(--color-text-muted)',
            textAlign: 'center',
          }}
        >
          By signing in, you agree to our{' '}
          <button
            type="button"
            className="link-button"
            onClick={() => void openLegal('terms')}
          >
            Terms and Conditions
          </button>{' '}
          and{' '}
          <button
            type="button"
            className="link-button"
            onClick={() => void openLegal('privacy')}
          >
            Privacy Policy
          </button>
          .
        </div>
        {legalKey && (
          <div
            className="modal-backdrop"
            role="dialog"
            aria-modal="true"
            aria-labelledby="legal-modal-title"
          >
            <div className="modal">
              <div className="modal-header">
                <h2 id="legal-modal-title" className="modal-title">
                  {legalContent?.title ??
                    (legalKey === 'terms' ? 'Terms and Conditions' : 'Privacy Policy')}
                </h2>
                <button
                  type="button"
                  className="modal-close-btn"
                  onClick={() => setLegalKey(null)}
                  aria-label="Close"
                >
                  ×
                </button>
              </div>
              <div className="modal-body" style={{ maxHeight: '60vh', overflow: 'auto' }}>
                {legalLoading && <p>Loading…</p>}
                {legalError && (
                  <p className="alert-error" style={{ marginTop: 0 }}>
                    {legalError}
                  </p>
                )}
                {!legalLoading && !legalError && legalContent && (
                  <pre
                    style={{
                      whiteSpace: 'pre-wrap',
                      fontFamily: 'inherit',
                      fontSize: 'var(--text-sm)',
                    }}
                  >
                    {legalContent.content}
                  </pre>
                )}
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn"
                  onClick={() => setLegalKey(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </LoginBrandedShell>
  );
}
