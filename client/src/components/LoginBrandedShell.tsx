import type { ReactNode } from 'react';

/** Split-screen layout: form (left), branded panel with visuals (right). Shared by login and related auth pages. */
export function LoginBrandedShell({ children }: { children: ReactNode }) {
  return (
    <div className="login-page">
      <div className="login-shell">
        <div className="login-form-column">{children}</div>
        <aside className="login-brand-panel" aria-hidden="true">
          <div className="login-brand-bg-pattern" />
          <div className="login-brand-visuals">
            <div className="login-mock-card login-mock-card--analytics">
              <div className="login-mock-card-title">Quality trends</div>
              <div className="login-mock-chart" aria-hidden="true">
                <svg viewBox="0 0 200 72" className="login-mock-chart-svg" preserveAspectRatio="none">
                  <path
                    d="M0 52 Q40 48 60 38 T120 28 T200 12"
                    fill="none"
                    stroke="rgba(255,255,255,0.45)"
                    strokeWidth="2.5"
                  />
                  <path
                    d="M0 58 Q50 42 90 36 T200 22"
                    fill="none"
                    stroke="rgba(125,211,252,0.85)"
                    strokeWidth="2.5"
                  />
                  <path
                    d="M0 62 Q35 55 80 44 T200 32"
                    fill="none"
                    stroke="rgba(255,255,255,0.75)"
                    strokeWidth="2"
                  />
                </svg>
              </div>
              <div className="login-mock-pills">
                <span className="login-mock-pill login-mock-pill--active">Monthly</span>
                <span className="login-mock-pill">Quarterly</span>
              </div>
            </div>
            <div className="login-mock-card login-mock-card--donut">
              <div className="login-mock-donut" aria-hidden="true">
                <svg viewBox="0 0 56 56" className="login-mock-donut-svg">
                  <circle cx="28" cy="28" r="22" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="8" />
                  <circle
                    cx="28"
                    cy="28"
                    r="22"
                    fill="none"
                    stroke="rgba(125,211,252,0.95)"
                    strokeWidth="8"
                    strokeDasharray="88 138"
                    strokeLinecap="round"
                    transform="rotate(-90 28 28)"
                  />
                </svg>
              </div>
              <div className="login-mock-donut-label">On track</div>
            </div>
          </div>
          <div className="login-brand-copy-block">
            <h2 className="login-brand-title">One workspace for assurance</h2>
            <p className="login-brand-copy">
              Sentinel Supplier Assurance helps your team manage audits, shipments, risk, and supplier performance —
              clearly and on time.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
