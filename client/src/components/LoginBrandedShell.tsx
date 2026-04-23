import type { ReactNode } from 'react';

/** Split-screen layout: branded blue panel (left), form column (right). Shared by login and related auth pages. */
export function LoginBrandedShell({ children }: { children: ReactNode }) {
  return (
    <div className="login-page">
      <div className="login-shell">
        <aside className="login-brand-panel">
          <div className="login-brand-bg-pattern" aria-hidden="true" />
          <div className="login-brand-content">
            <p className="login-brand-welcome">Welcome</p>
            <div className="login-brand-message">
              <p className="login-brand-product-name">Supplier Assurance Platform</p>
              <p className="login-brand-tagline">
                Know Your Supply Chain.
                <br />
                Ship With Confidence.
              </p>
            </div>
            <p className="login-brand-attribution">by Sentinel Global Supply</p>
          </div>
        </aside>
        <div className="login-form-column">{children}</div>
      </div>
    </div>
  );
}
