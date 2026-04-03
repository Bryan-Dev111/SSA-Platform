import type { ReactNode } from 'react';

/** Shared layout for login and related public auth help pages. */
export function LoginBrandedShell({ children }: { children: ReactNode }) {
  return (
    <div className="login-page">
      <div className="login-shell">
        <aside className="login-brand-panel" aria-hidden="true">
          <div className="login-brand-content">
            <p className="login-brand-kicker">Supplier Assurance Platform</p>
            <p className="login-brand-tagline">Prevent Risk. Ensure Quality. Deliver On Time.</p>
            <h2 className="login-brand-title">Welcome back</h2>
          </div>
        </aside>
        {children}
      </div>
    </div>
  );
}