/**
 * Super user only: connect or disconnect the application database; change Super password.
 */
import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useDatabaseConnection } from '../../context/DatabaseConnectionContext';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/ToastContext';
import { apiJson } from '../../api/client';

export function DatabaseConnectionPage() {
  const { t } = useLanguage();
  const toast = useToast();
  const { token } = useAuth();
  const { connected, loading, connect, disconnect, refresh } = useDatabaseConnection();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  const run = async (action: 'connect' | 'disconnect') => {
    setError('');
    setBusy(true);
    try {
      if (action === 'connect') await connect();
      else await disconnect();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('superDb.actionFailed', 'Action failed'));
    } finally {
      setBusy(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    if (newPassword !== confirmPassword) {
      setPasswordError(t('superDb.passwordMismatch', 'New password and confirmation do not match.'));
      return;
    }
    setPasswordBusy(true);
    try {
      const res = await apiJson<{ ok?: boolean; message?: string; error?: string }>(
        '/super/database/change-password',
        {
          method: 'POST',
          token,
          body: JSON.stringify({
            currentPassword,
            newPassword,
            confirmPassword,
          }),
        }
      );
      if (res.error) {
        setPasswordError(res.error);
        return;
      }
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast.success(res.message ?? t('superDb.passwordChanged', 'Password updated successfully.'));
    } catch (err) {
      let msg = err instanceof Error ? err.message : t('superDb.actionFailed', 'Action failed');
      try {
        const parsed = JSON.parse(msg) as { error?: string };
        if (parsed?.error) msg = parsed.error;
      } catch {
        /* keep msg */
      }
      setPasswordError(msg);
    } finally {
      setPasswordBusy(false);
    }
  };

  return (
    <div className="page">
      <header className="page-header">
        <h1 className="page-title">{t('superDb.pageTitle', 'Database connection')}</h1>
        <p className="page-description">
          {t(
            'superDb.lead',
            'Connect or disconnect the application database. When disconnected, data on all other pages is hidden until you reconnect.'
          )}
        </p>
      </header>

      <section className="card">
        <div className="card-body">
          <p style={{ marginTop: 0 }}>
            <strong>{t('superDb.statusLabel', 'Status')}:</strong>{' '}
            {loading
              ? t('superDb.statusChecking', 'Checking…')
              : connected
                ? t('superDb.statusConnected', 'Connected')
                : t('superDb.statusDisconnected', 'Disconnected')}
          </p>

          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
            {connected ? (
              <button
                type="button"
                className="btn btn-secondary"
                disabled={busy || loading}
                onClick={() => void run('disconnect')}
              >
                {busy ? t('superDb.disconnecting', 'Disconnecting…') : t('superDb.disconnect', 'Disconnect')}
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy || loading}
                onClick={() => void run('connect')}
              >
                {busy ? t('superDb.reconnecting', 'Reconnecting…') : t('superDb.reconnect', 'Reconnect')}
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="card" style={{ marginTop: '1.25rem' }}>
        <div className="card-body">
          <h2 className="page-title" style={{ fontSize: 'var(--text-lg)', marginTop: 0 }}>
            {t('superDb.passwordSectionTitle', 'Super account password')}
          </h2>
          <p className="page-description" style={{ marginTop: '0.35rem' }}>
            {t(
              'superDb.passwordSectionLead',
              'Change the sign-in password for this Super account. The account is not stored in the database; the new password is saved on the server only.'
            )}
          </p>

          <form onSubmit={(e) => void handleChangePassword(e)} style={{ maxWidth: '28rem' }}>
            <label className="form-label">
              {t('superDb.currentPassword', 'Current password')}
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input
                  className="input"
                  type={showCurrentPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowCurrentPassword((v) => !v)}
                  aria-pressed={showCurrentPassword}
                >
                  {showCurrentPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </label>

            <label className="form-label">
              {t('superDb.newPassword', 'New password')}
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input
                  className="input"
                  type={showNewPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  minLength={8}
                  required
                />
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowNewPassword((v) => !v)}
                  aria-pressed={showNewPassword}
                >
                  {showNewPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </label>

            <label className="form-label">
              {t('superDb.confirmPassword', 'Confirm new password')}
              <input
                className="input"
                type={showNewPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                minLength={8}
                required
              />
            </label>

            {passwordError ? (
              <p className="form-error" role="alert">
                {passwordError}
              </p>
            ) : null}

            <button type="submit" className="btn btn-primary" disabled={passwordBusy}>
              {passwordBusy
                ? t('superDb.changingPassword', 'Updating…')
                : t('superDb.changePassword', 'Change password')}
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
