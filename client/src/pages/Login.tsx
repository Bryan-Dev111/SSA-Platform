/**
 * Login page: logo, form, auth API, redirect by role
 */
import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { LoginBrandedShell } from '../components/LoginBrandedShell';

export function Login() {
  const { user, token, login, loading } = useAuth();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  if (loading) {
    return (
      <LoginBrandedShell>
        <div className="login-card">
          <div className="loading-message" style={{ textAlign: 'center' }}>
            <div className="loading-spinner" style={{ marginBottom: 12 }} />
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

  return (
    <LoginBrandedShell>
      <div className="login-card">
        <div className="login-header">
          <img src="/logo.png" alt="Sentinel" className="login-logo" />
          <h1 className="login-title">Welcome</h1>
          <p className="login-subtitle">Sign in to continue to your workspace.</p>
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
              className="input"
              placeholder="you@company.com"
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
                className="input"
                placeholder="••••••••"
              />
              <button
                type="button"
                className="login-password-toggle"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>
          {error && <div className="alert-error">{error}</div>}
          <button type="submit" disabled={submitting} className="btn btn-primary login-submit">
            {submitting ? 'Signing in...' : 'Sign in'}
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
      </div>
    </LoginBrandedShell>
  );
}
