/**
 * Global Supply — Internal Management hub:
 * Purchase Orders, Documents, Calendar, Expenses, plus Org Chart (sourcing directors + staff), Work Logs,
 * Employee Assignments, and Management Assignments.
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
import { InternalManagementOrgChart } from '../InternalManagementOrgChart';
import { AdminEmployeeAssignmentsPanel } from '../admin/AdminEmployeeAssignmentsPanel';
import { ManagementAssignmentsPanel } from '../ManagementAssignmentsPanel';
import { GlobalSupplyProfitTab } from './GlobalSupplyProfitTab';

type GlobalInternalTab =
  | 'purchaseOrders'
  | 'expenses'
  | 'profit'
  | 'documents'
  | 'calendar'
  | 'orgChart'
  | 'employeeAssignments'
  | 'managementAssignments';

type PurchaseOrderStatusRow = {
  status: string | null;
  quantityKg: number | null;
  pricePerKg: number | null;
  totalAmount: number | null;
};

type ExpenseStatusRow = {
  status?: string | null;
  amount: number;
  project: string;
};

export function GlobalSupplyInternalManagementPage() {
  const { token, user } = useAuth();
  const toast = useToast();
  const isAdmin = !!user?.roleNames?.includes('Admin');
  const roleNames = user?.roleNames ?? [];
  const canStaffHub = roleNames.includes('Admin') || roleNames.includes('QualityManager');

  const [tab, setTab] = useState<GlobalInternalTab>('purchaseOrders');
  const [openPoCount, setOpenPoCount] = useState<number | null>(null);
  const [openPoValue, setOpenPoValue] = useState<number | null>(null);
  const [openExpenseZeroAmountCount, setOpenExpenseZeroAmountCount] = useState(0);

  useEffect(() => {
    if (
      (tab === 'orgChart' || tab === 'employeeAssignments' || tab === 'managementAssignments') &&
      !canStaffHub
    ) {
      setTab('purchaseOrders');
    }
  }, [tab, canStaffHub]);

  useEffect(() => {
    if (!token || tab !== 'purchaseOrders') return;
    apiJson<PurchaseOrderStatusRow[]>('/purchase-orders', { token })
      .then((rows) => {
        const openRows = rows.filter((r) => (r.status ?? 'Open').trim().toLowerCase() !== 'closed');
        const openCount = openRows.length;
        const openValue = openRows.reduce((sum, row) => {
          const computedTotal =
            row.totalAmount ??
            (row.quantityKg != null && row.pricePerKg != null ? row.quantityKg * row.pricePerKg : 0);
          return sum + computedTotal;
        }, 0);
        setOpenPoCount(openCount);
        setOpenPoValue(openValue);
      })
      .catch(() => {
        setOpenPoCount(null);
        setOpenPoValue(null);
      });
  }, [token, tab]);

  useEffect(() => {
    if (!token) return;
    apiJson<{ list: ExpenseStatusRow[] }>('/expenses', { token })
      .then((res) => {
        const count = res.list.filter((row) => {
          if (row.project !== 'Global Vendors') return false;
          const status = (row.status ?? 'Open').trim().toLowerCase();
          return status !== 'closed' && (!Number.isFinite(row.amount) || row.amount <= 0);
        }).length;
        setOpenExpenseZeroAmountCount(count);
      })
      .catch(() => setOpenExpenseZeroAmountCount(0));
  }, [token, tab]);

  const pageDescription = useMemo(() => {
    if (tab === 'purchaseOrders') return '';
    if (tab === 'documents') return '';
    if (tab === 'calendar') return '';
    if (tab === 'expenses') return '';
    if (tab === 'profit') return '';
    if (tab === 'orgChart')
      return '';
    if (tab === 'employeeAssignments')
      return '';
    if (tab === 'managementAssignments')
      return '';
    return '';
  }, [tab]);

  const tabButtons = useMemo(() => {
    const rows: { id: GlobalInternalTab; label: string }[] = [
      { id: 'purchaseOrders', label: 'Purchase Orders' },
      { id: 'expenses', label: 'Expenses' },
      { id: 'profit', label: 'Profit' },
      { id: 'documents', label: 'Documents' },
      { id: 'calendar', label: 'Calendar' },
    ];
    if (canStaffHub) {
      rows.push(
        { id: 'orgChart', label: 'Org Chart' },
        { id: 'employeeAssignments', label: 'Employee Assignments' },
        { id: 'managementAssignments', label: 'Management Assignments' }
      );
    }
    return rows;
  }, [canStaffHub]);

  return (
    <div className="page">
      <header className="page-header">
        <h1 className="page-title">Internal Management</h1>
        <p className="page-description" style={{ marginTop: '0.35rem' }}>
          {pageDescription}
        </p>
      </header>

      <div className="page-tab-rail" style={{ marginBottom: '1rem' }}>
        {tabButtons.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            className={tab === id ? 'btn btn-primary' : 'btn btn-ghost'}
            onClick={() => setTab(id)}
          >
            {label}
            {id === 'expenses' && openExpenseZeroAmountCount > 0 ? (
              <span
                aria-label={`${openExpenseZeroAmountCount} Expenses have zero amount`}
                title={`${openExpenseZeroAmountCount} Expenses have zero amount`}
                style={{
                  marginLeft: 8,
                  display: 'inline-flex',
                  width: 0,
                  height: 0,
                  borderLeft: '8px solid transparent',
                  borderRight: '8px solid transparent',
                  borderBottom: '14px solid #dc2626',
                  position: 'relative',
                  top: -1,
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    left: -2,
                    top: 2,
                    color: '#ffffff',
                    fontSize: 10,
                    fontWeight: 700,
                    lineHeight: 1,
                  }}
                >
                  !
                </span>
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {tab === 'purchaseOrders' && (
        <>
          <div
            className="dashboard-metric-grid"
            style={{
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              marginBottom: '1rem',
              width: '100%',
              maxWidth: '100%',
              minWidth: 0,
            }}
          >
            <MetricCard
              title="Open POs"
              value={openPoCount == null ? '—' : openPoCount}
            />
            <MetricCard
              title="Open PO Value"
              value={
                openPoValue == null
                  ? '—'
                  : new Intl.NumberFormat(undefined, {
                      style: 'currency',
                      currency: 'USD',
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    }).format(openPoValue)
              }
            />
          </div>
          <PurchaseOrdersPage canCreatePurchaseOrder={isAdmin} />
        </>
      )}

      {tab === 'documents' && (
        <GlobalSupplyDocumentsPanel token={token} toast={toast} canDelete={isAdmin} />
      )}

      {tab === 'calendar' && <InternalManagementCalendarView token={token} variant="globalSupply" />}

      {tab === 'expenses' && <GlobalSupplyExpensesSection />}

      {tab === 'profit' && <GlobalSupplyProfitTab token={token} />}

      {tab === 'orgChart' && canStaffHub && (
        <InternalManagementOrgChart
          token={token}
          viewerDisplayName={user?.name?.trim() || user?.email || 'You'}
          variant="globalSupply"
          employeeProfilePathPrefix="/global-vendors/employee-profile"
        />
      )}

      {tab === 'employeeAssignments' && canStaffHub && (
        <div style={{ marginTop: '1rem' }}>
          <AdminEmployeeAssignmentsPanel
            token={token}
            toast={toast}
            globalSupplyEmployeeRosterMode
            canEditStaffRoster={isAdmin}
          />
        </div>
      )}

      {tab === 'managementAssignments' && canStaffHub && (
        <ManagementAssignmentsPanel token={token} toast={toast} showSourcingDirectorStaff />
      )}
    </div>
  );
}
