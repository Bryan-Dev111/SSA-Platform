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
import { WorkLogs } from '../WorkLogs';
import { AdminEmployeeAssignmentsPanel } from '../admin/AdminEmployeeAssignmentsPanel';
import { ManagementAssignmentsPanel } from '../ManagementAssignmentsPanel';
import { GlobalSupplyProfitTab } from './GlobalSupplyProfitTab';
import { canAccessPath } from '../../config/rolePageAccess';
import type { InternalManagementTab } from '../internalManagementTabs';

type GlobalInternalTab =
  | 'purchaseOrders'
  | 'documents'
  | 'calendar'
  | 'expenses'
  | 'profit'
  | 'orgChart'
  | 'workLogs'
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
  const canWorkLogsTab = canAccessPath('/work-logs', roleNames);

  const [tab, setTab] = useState<GlobalInternalTab>('purchaseOrders');
  const [openPoCount, setOpenPoCount] = useState<number | null>(null);
  const [openPoValue, setOpenPoValue] = useState<number | null>(null);
  const [hasOpenExpenseMissingAmount, setHasOpenExpenseMissingAmount] = useState(false);

  useEffect(() => {
    if (tab === 'workLogs' && !canWorkLogsTab) setTab('purchaseOrders');
    if (
      (tab === 'orgChart' || tab === 'employeeAssignments' || tab === 'managementAssignments') &&
      !canStaffHub
    ) {
      setTab('purchaseOrders');
    }
  }, [tab, canWorkLogsTab, canStaffHub]);

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
        const hasMissing = res.list.some((row) => {
          if (row.project !== 'Global Vendors') return false;
          const status = (row.status ?? 'Open').trim().toLowerCase();
          return status !== 'closed' && (!Number.isFinite(row.amount) || row.amount <= 0);
        });
        setHasOpenExpenseMissingAmount(hasMissing);
      })
      .catch(() => setHasOpenExpenseMissingAmount(false));
  }, [token]);

  const pageDescription = useMemo(() => {
    if (tab === 'purchaseOrders') return '';
    if (tab === 'documents') return '';
    if (tab === 'calendar') return '';
    if (tab === 'expenses') return '';
    if (tab === 'profit') return '';
    if (tab === 'orgChart')
      return '';
    if (tab === 'workLogs') return '';
    if (tab === 'employeeAssignments')
      return '';
    if (tab === 'managementAssignments')
      return '';
    return '';
  }, [tab]);

  const tabButtons = useMemo(() => {
    const rows: { id: GlobalInternalTab; label: string }[] = [
      { id: 'purchaseOrders', label: 'Purchase Orders' },
      { id: 'documents', label: 'Documents' },
      { id: 'calendar', label: 'Calendar' },
      { id: 'expenses', label: 'Expenses' },
      { id: 'profit', label: 'Profit' },
    ];
    if (canWorkLogsTab) {
      rows.push({ id: 'workLogs', label: 'Work Logs' });
    }
    if (canStaffHub) {
      rows.push(
        { id: 'orgChart', label: 'Org Chart' },
        { id: 'employeeAssignments', label: 'Employee Assignments' },
        { id: 'managementAssignments', label: 'Management Assignments' }
      );
    }
    return rows;
  }, [canStaffHub, canWorkLogsTab]);

  const onOrgChartGoToTab = (t: InternalManagementTab) => {
    if (t === 'managementAssignments' && canStaffHub) setTab('managementAssignments');
  };

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
            {id === 'expenses' && hasOpenExpenseMissingAmount ? (
              <span
                aria-label="Open expenses missing amount"
                title="Open expense line has no amount entered"
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
              title="Open PO's"
              value={openPoCount == null ? '—' : openPoCount}
              subtitle="Purchase orders not closed"
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
              subtitle="Total value of open purchase orders"
            />
          </div>
          <PurchaseOrdersPage />
        </>
      )}

      {tab === 'documents' && (
        <GlobalSupplyDocumentsPanel token={token} toast={toast} canDelete={isAdmin} />
      )}

      {tab === 'calendar' && <InternalManagementCalendarView token={token} />}

      {tab === 'expenses' && <GlobalSupplyExpensesSection />}

      {tab === 'profit' && <GlobalSupplyProfitTab token={token} />}

      {tab === 'orgChart' && canStaffHub && (
        <InternalManagementOrgChart
          token={token}
          viewerDisplayName={user?.name?.trim() || user?.email || 'You'}
          onGoToTab={onOrgChartGoToTab}
          variant="globalSupply"
        />
      )}

      {tab === 'workLogs' && canWorkLogsTab && <WorkLogs variant="embedded" />}

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
