/**
 * Global Supply — Internal Management hub:
 * Purchase Orders, Documents, Calendar, and Expenses in one page.
 */
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { apiJson } from '../../api/client';
import { MetricCard } from '../../components/MetricCard';
import { PurchaseOrdersPage } from './PurchaseOrdersPage';
import { GlobalSupplyDocumentsPanel } from './GlobalSupplyDocumentsPanel';
import { InternalManagementCalendarView } from '../InternalManagementCalendar';
import { GlobalSupplyExpensesSection } from './ExpensesPage';

type GlobalInternalTab = 'purchaseOrders' | 'documents' | 'calendar' | 'expenses';

type PurchaseOrderStatusRow = {
  status: string | null;
};

export function GlobalSupplyInternalManagementPage() {
  const { token } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState<GlobalInternalTab>('purchaseOrders');
  const [openPoCount, setOpenPoCount] = useState<number | null>(null);

  useEffect(() => {
    if (!token) return;
    apiJson<PurchaseOrderStatusRow[]>('/purchase-orders', { token })
      .then((rows) => {
        const openCount = rows.filter((r) => (r.status ?? 'Open').trim().toLowerCase() !== 'closed').length;
        setOpenPoCount(openCount);
      })
      .catch(() => setOpenPoCount(null));
  }, [token]);

  const pageDescription = useMemo(() => {
    if (tab === 'purchaseOrders') return 'Manage purchase orders and track open PO counts.';
    if (tab === 'documents') return 'Upload and maintain internal document library.';
    if (tab === 'calendar') return 'Review audits and shipments in calendar view.';
    return 'Track and manage Global Supply expenses.';
  }, [tab]);

  return (
    <div className="page">
      <header className="page-header">
        <h1 className="page-title">Internal Management</h1>
        <p className="page-description" style={{ marginTop: '0.35rem' }}>
          {pageDescription}
        </p>
      </header>

      <div className="page-tab-rail" style={{ marginBottom: '1rem' }}>
        {(
          [
            ['purchaseOrders', 'Purchase Orders'],
            ['documents', 'Documents'],
            ['calendar', 'Calendar'],
            ['expenses', 'Expenses'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={tab === id ? 'btn btn-primary' : 'btn btn-ghost'}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'purchaseOrders' && (
        <>
          <div style={{ marginBottom: '1rem', width: '100%', maxWidth: '100%', minWidth: 0 }}>
            <MetricCard
              title="Open PO's"
              value={openPoCount == null ? '—' : openPoCount}
              subtitle="Purchase orders not closed"
            />
          </div>
          <PurchaseOrdersPage />
        </>
      )}

      {tab === 'documents' && <GlobalSupplyDocumentsPanel token={token} toast={toast} />}

      {tab === 'calendar' && <InternalManagementCalendarView token={token} />}

      {tab === 'expenses' && <GlobalSupplyExpensesSection />}
    </div>
  );
}
