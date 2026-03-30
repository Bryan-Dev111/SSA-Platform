/**
 * Public: how to request an account (no self-service signup in product).
 */
import { Link } from 'react-router-dom';
import { LoginBrandedShell } from '../components/LoginBrandedShell';

const contactEmail = import.meta.env.VITE_CONTACT_EMAIL as string | undefined;

export function RequestAccess() {
  return (
    <LoginBrandedShell>
      <div className="login-card">
        <div className="login-header">
          <img src="/logo.png" alt="Sentinel" className="login-logo" />
          <h1 className="login-title">Request access</h1>
          <p className="login-subtitle">Accounts are created by an administrator.</p>
        </div>
        <div className="login-help-body">
          <p>
            If you need a Sentinel account, contact your organization&apos;s Sentinel administrator or IT team. They can
            create a user and assign the right role.
          </p>
          {contactEmail ? (
            <p>
              You can also email{' '}
              <a className="login-footer-link" href={`mailto:${contactEmail}?subject=Sentinel%20access%20request`}>
                {contactEmail}
              </a>
              .
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
