/**
 * Login page: logo, form, auth API, redirect by role
 */
import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { canAccessPath, getDefaultPath } from '../config/rolePageAccess';

export function Login() {
  const { user, token, login, loading } = useAuth();
  const toast = useToast();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/dashboard';

  const redirectToWhenLoggedIn = (() => {
    if (!user) return '/dashboard';
    if (user.roleNames.includes('Supplier') && canAccessPath('/supplier-profile', user.roleNames)) {
      return '/supplier-profile';
    }
    return canAccessPath(from, user.roleNames) ? from : getDefaultPath(user.roleNames);
  })();

  if (loading) {
    return (
      <div className="login-page">
        <div className="loading-message">
          <div className="loading-spinner" style={{ marginBottom: 12 }} />
          Loading…
        </div>
      </div>
    );
  }

  if (token && user) {
    return <Navigate to={redirectToWhenLoggedIn} replace />;
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
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <img src="/logo.png" alt="Sentinel" className="login-logo" />
          <h1 className="login-title">Welcome</h1>
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
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="input"
              placeholder="••••••••"
            />
          </div>
          {error && <div className="alert-error">{error}</div>}
          <button type="submit" disabled={submitting} className="btn btn-primary login-submit">
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
