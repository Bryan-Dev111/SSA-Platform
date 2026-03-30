/**
 * Public: password reset guidance (passwords are admin-managed; no self-service reset API yet).
 */
import { Link } from 'react-router-dom';
import { LoginBrandedShell } from '../components/LoginBrandedShell';

const contactEmail = import.meta.env.VITE_CONTACT_EMAIL as string | undefined;

export function ForgotPassword() {
  return (
    <LoginBrandedShell>
      <div className="login-card">
        <div className="login-header">
          <img src="/logo.png" alt="Sentinel" className="login-logo" />
          <h1 className="login-title">Forgot password</h1>
          <p className="login-subtitle">Reset your credentials through your administrator.</p>
        </div>
        <div className="login-help-body">
          <p>
            Passwords are set and reset by a Sentinel administrator. If you forgot your password, ask your admin to update
            your account or send you a new password.
          </p>
          {contactEmail ? (
            <p>
              For help, contact{' '}
              <a className="login-footer-link" href={`mailto:${contactEmail}?subject=Sentinel%20password%20help`}>
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
