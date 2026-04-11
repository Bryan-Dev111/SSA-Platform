/**
 * Global Vendors — Expenses page.
 * Reuses the shared expenses UI from main Admin (same columns and add form), scoped to Global Vendors project.
 */
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { AdminExpensesPanel } from '../admin/AdminDay9Panels';

const GLOBAL_VENDORS_PROJECT = 'Global Vendors';

/** Same table and form as Admin → Expenses; list and export are limited to this project. */
export function GlobalSupplyExpensesSection() {
  const { token } = useAuth();
  const toast = useToast();
  return (
    <AdminExpensesPanel
      token={token}
      toast={toast}
      projectFilter={GLOBAL_VENDORS_PROJECT}
      fixedTypeProject={{ type: GLOBAL_VENDORS_PROJECT, project: GLOBAL_VENDORS_PROJECT }}
    />
  );
}

export function ExpensesPage() {
  return (
    <div className="page">
      <header className="page-header">
        <h1 className="page-title">Expenses</h1>
      </header>
      <GlobalSupplyExpensesSection />
    </div>
  );
}
