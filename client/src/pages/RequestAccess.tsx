/**
 * Public: submit an access request (stored + admin notification email when configured).
 */
import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { LoginBrandedShell } from '../components/LoginBrandedShell';
import { apiJson } from '../api/client';

const contactEmail = import.meta.env.VITE_CONTACT_EMAIL as string | undefined;

export function RequestAccess() {
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
        setDoneMessage(
          'Thank you. Your request has been submitted. An administrator will contact you if your access is approved.'
        );
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
          <h1 className="login-title">Request access</h1>
          <p className="login-subtitle">
            Tell us who you are. An administrator will review and create your account if approved.
          </p>
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
              <label htmlFor="req-email" className="input-label">
                Work email <span style={{ color: 'var(--color-danger, #b91c1c)' }}>*</span>
              </label>
              <input
                id="req-email"
                type="email"
                className="input"
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
                Full name <span style={{ color: 'var(--color-danger, #b91c1c)' }}>*</span>
              </label>
              <input
                id="req-name"
                type="text"
                className="input"
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
                Organization
              </label>
              <input
                id="req-org"
                type="text"
                className="input"
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
                Message <span style={{ fontWeight: 400, color: 'var(--color-text-muted)' }}>(optional)</span>
              </label>
              <textarea
                id="req-message"
                className="input"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Role needed, supplier name, or other context"
                disabled={submitting}
                rows={4}
                maxLength={4000}
                style={{ resize: 'vertical', minHeight: '5rem' }}
              />
            </div>
            <button type="submit" className="btn btn-primary login-submit" disabled={submitting}>
              {submitting ? 'Submitting…' : 'Submit request'}
            </button>
          </form>
        ) : null}

        <div className="login-help-body" style={{ marginTop: doneMessage ? '0.5rem' : '1rem' }}>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginBottom: '0.75rem' }}>
            Accounts are not self-activated. You will hear from your Sentinel administrator after review.
          </p>
          {contactEmail ? (
            <p style={{ fontSize: 'var(--text-sm)' }}>
              Questions?{' '}
              <a className="login-footer-link" href={`mailto:${contactEmail}?subject=Sentinel%20access%20request`}>
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
