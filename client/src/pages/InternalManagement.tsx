/**
 * Internal Management — Admin only: Audits, Shipments (schedule), internal & project history, etc.
 * Command Media (shared /documents library) is on the Admin page.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useLanguage } from '../context/LanguageContext';
import { getDocumentLocale } from '../i18n/locale';
import { apiJson } from '../api/client';
import { parseApiError, downloadWithAuthProgress } from '../utils/apiHelpers';
import { Navigate } from 'react-router-dom';
import { getDefaultPath } from '../config/rolePageAccess';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { MetricCard } from '../components/MetricCard';
import { AdminEmployeeAssignmentsPanel } from './admin/AdminEmployeeAssignmentsPanel';
import { AdminExpensesPanel } from './admin/AdminDay9Panels';
import { AdminLaborCostsPanel } from './admin/AdminLaborCostsPanel';
import { SortableTh } from '../components/SortableTh';
import { cmpNum, cmpStr, dateMs, toggleSort, type SortDir } from '../utils/tableSort';
import { InternalManagementOrgChart } from './InternalManagementOrgChart';
import { InternalManagementCalendarView } from './InternalManagementCalendar';
import type { InternalManagementTab as ImTab } from './internalManagementTabs';
import { ManagementAssignmentsPanel } from './ManagementAssignmentsPanel';
import {
  formatDisplayCalendarDate,
  formatDisplayCalendarRange,
  formatDisplayDateTime,
} from '../utils/formatDisplayDates';

interface ProjectHistoryBuyer {
  id: string;
  name: string | null;
  email: string;
}

interface InternalRow {
  id: string;
  name: string;
  category: string | null;
  note: string | null;
  filePath: string | null;
  createdAt: string;
  updatedAt: string;
  projectHistoryId?: string | null;
  projectHistory?: { id: string; projectCode: string; companyName: string } | null;
  buyerId?: string | null;
  employeeUserId?: string | null;
  buyer?: ProjectHistoryBuyer | null;
  employee?: ProjectHistoryBuyer | null;
}

interface SupplierOption {
  id: string;
  code: string;
  name: string;
}

interface AuditTypeOption {
  id: string;
  code: string;
  name: string | null;
}

/** Sentinel employees/contractors for audit assignment (matches GET /audits/auditors). */
interface AuditAuditorOption {
  id: string;
  name: string;
  email: string;
}

interface ScheduleRow {
  id: string;
  supplierId: string | null;
  purchaseOrder: string | null;
  partNumber: string | null;
  qty: number | null;
  scheduledDate: string | null;
  notes: string | null;
  supplier: { id: string; code: string; name: string } | null;
}

interface ProjectHistorySupplier {
  id: string;
  code: string;
  name: string;
}

interface ProjectHistoryRow {
  id: string;
  projectCode: string;
  clientName: string;
  companyName: string;
  clientEmail: string | null;
  clientMobile: string | null;
  industry: string | null;
  country: string | null;
  projectDescription: string | null;
  popStart: string | null;
  popEnd: string | null;
  revenue: string | null;
  revenueAmount: number | null;
  status: string;
  buyerId?: string | null;
  supplierId?: string | null;
  buyer?: ProjectHistoryBuyer | null;
  supplier?: ProjectHistorySupplier | null;
  createdAt: string;
  updatedAt: string;
}

interface ProfitRow {
  projectId: string;
  projectCode: string;
  companyName: string;
  revenue: string | null;
  revenueAmount: number;
  costs: number;
  profit: number;
  status: string;
  /** POP bounds for inactive past vs future row styling (from profit-summary). */
  popStart?: string | null;
  popEnd?: string | null;
  deductions?: Array<{
    code: string;
    amount: number;
    kind: 'Labor Cost' | 'Expense';
  }>;
}

function projectPopToInputDate(iso: string | null | undefined): string {
  if (!iso) return '';
  return iso.slice(0, 10);
}

function formatProjectPopCell(popStart: string | null, popEnd: string | null): string {
  return formatDisplayCalendarRange(popStart, popEnd);
}

/** UTC calendar-day boundary (ms), aligned with server `client-history` POP / Active logic. */
function utcDayMsFromPopField(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const datePart = iso.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return null;
  const [y, m, d] = datePart.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0, 0));
  if (Number.isNaN(dt.getTime())) return null;
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return Date.UTC(y, m - 1, d);
}

type ProjectHistoryVisualTone = 'active' | 'inactivePast' | 'inactiveFuture';

/** POP window vs today (UTC calendar) — shared by Project History and Profit rows. */
function popWindowTone(
  popStart: string | null | undefined,
  popEnd: string | null | undefined
): ProjectHistoryVisualTone {
  const s = utcDayMsFromPopField(popStart);
  const e = utcDayMsFromPopField(popEnd);
  const now = new Date();
  const t = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  if (s != null && e != null) {
    if (s > e) return 'inactivePast';
    if (t >= s && t <= e) return 'active';
    if (t < s) return 'inactiveFuture';
    return 'inactivePast';
  }
  return 'inactivePast';
}

function projectHistoryRowTone(r: ProjectHistoryRow): ProjectHistoryVisualTone {
  return popWindowTone(r.popStart, r.popEnd);
}

function profitRowStyle(r: ProfitRow): Record<string, string> {
  return projectHistoryRowStyle(popWindowTone(r.popStart, r.popEnd));
}

function profitRowTitle(r: ProfitRow): string | undefined {
  return projectHistoryRowTitle(popWindowTone(r.popStart, r.popEnd));
}

function projectHistoryRowStyle(tone: ProjectHistoryVisualTone): Record<string, string> {
  switch (tone) {
    case 'active':
      return { backgroundColor: 'var(--color-surface, #ffffff)' };
    case 'inactiveFuture':
      return { backgroundColor: '#e8edf2' };
    case 'inactivePast':
      return { backgroundColor: '#8d98a8' };
    default:
      return {};
  }
}

function projectHistoryRowTitle(tone: ProjectHistoryVisualTone): string | undefined {
  switch (tone) {
    case 'active':
      return undefined;
    case 'inactiveFuture':
      return 'Inactive — period of performance has not started yet';
    case 'inactivePast':
      return 'Inactive — period ended, incomplete dates, or invalid range';
    default:
      return undefined;
  }
}

function formatProfitMoney(value: number): string {
  return value.toLocaleString(getDocumentLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function deductionNumericSuffix(code: string): number {
  const m = /^(?:COST|EXP)-(\d+)$/i.exec(code.trim());
  return m ? Number(m[1]) : 0;
}

function sortDeductionsForDisplay(
  rows: Array<{ code: string; amount: number; kind: 'Labor Cost' | 'Expense' }>
): Array<{ code: string; amount: number; kind: 'Labor Cost' | 'Expense' }> {
  return [...rows].sort((a, b) => {
    const pa = a.code.toUpperCase().startsWith('COST-') ? 0 : 1;
    const pb = b.code.toUpperCase().startsWith('COST-') ? 0 : 1;
    if (pa !== pb) return pa - pb;
    const na = deductionNumericSuffix(a.code);
    const nb = deductionNumericSuffix(b.code);
    if (na !== nb) return nb - na;
    return b.code.localeCompare(a.code);
  });
}

export function InternalManagement() {
  const { token, user } = useAuth();
  const toast = useToast();
  const { t, locale } = useLanguage();
  const [tab, setTab] = useState<ImTab>('audits');

  const [rows, setRows] = useState<InternalRow[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [auditTypes, setAuditTypes] = useState<AuditTypeOption[]>([]);
  const [auditAuditors, setAuditAuditors] = useState<AuditAuditorOption[]>([]);
  const [schedules, setSchedules] = useState<ScheduleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [note, setNote] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<Record<string, number>>({});
  const [newAudit, setNewAudit] = useState({
    supplierId: '',
    auditDate: '',
    auditTypeId: '',
    auditor: '',
    summary: '',
    scope: '',
    projectHistoryId: '',
  });
  const [submittingAudit, setSubmittingAudit] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [scheduleForm, setScheduleForm] = useState({
    supplierId: '',
    purchaseOrder: '',
    partNumber: '',
    qty: '',
    scheduledDate: '',
    notes: '',
  });
  const [scheduleSubmitting, setScheduleSubmitting] = useState(false);
  const [scheduleDeleteId, setScheduleDeleteId] = useState<string | null>(null);
  const [scheduleBusyId, setScheduleBusyId] = useState<string | null>(null);

  const [projectHistories, setProjectHistories] = useState<ProjectHistoryRow[]>([]);
  const [buyerOptions, setBuyerOptions] = useState<ProjectHistoryBuyer[]>([]);
  const [projectHistoryBuyerFilter, setProjectHistoryBuyerFilter] = useState('');
  const [projectHistorySupplierFilter, setProjectHistorySupplierFilter] = useState('');
  const [clientForm, setClientForm] = useState({
    clientName: '',
    companyName: '',
    clientEmail: '',
    clientMobile: '',
    industry: '',
    country: '',
    projectDescription: '',
    popStart: '',
    popEnd: '',
    revenue: '',
    buyerId: '',
    supplierId: '',
  });
  const [projectEditingId, setProjectEditingId] = useState<string | null>(null);
  const [projectSubmitting, setProjectSubmitting] = useState(false);
  const [projectBusyId, setProjectBusyId] = useState<string | null>(null);
  const [profitRows, setProfitRows] = useState<ProfitRow[]>([]);
  const [shipmentSort, setShipmentSort] = useState<{ key: string | null; dir: SortDir }>({ key: null, dir: 'asc' });
  const [projectTableSort, setProjectTableSort] = useState<{ key: string | null; dir: SortDir }>({ key: null, dir: 'asc' });
  const [projectAttachmentBusyId, setProjectAttachmentBusyId] = useState<string | null>(null);

  const filteredProjectHistories = useMemo(() => {
    return projectHistories.filter((r) => {
      if (projectHistoryBuyerFilter && (r.buyerId ?? '') !== projectHistoryBuyerFilter) return false;
      if (projectHistorySupplierFilter && (r.supplierId ?? '') !== projectHistorySupplierFilter) return false;
      return true;
    });
  }, [projectHistories, projectHistoryBuyerFilter, projectHistorySupplierFilter]);

  const sortedSchedules = useMemo(() => {
    if (!shipmentSort.key) return schedules;
    const { key: k, dir } = shipmentSort;
    const list = [...schedules];
    const supplierLabel = (r: ScheduleRow) => (r.supplier ? `${r.supplier.code} ${r.supplier.name}` : '');
    list.sort((a, b) => {
      switch (k) {
        case 'supplier':
          return cmpStr(supplierLabel(a), supplierLabel(b), dir);
        case 'po':
          return cmpStr(a.purchaseOrder ?? '', b.purchaseOrder ?? '', dir);
        case 'part':
          return cmpStr(a.partNumber ?? '', b.partNumber ?? '', dir);
        case 'qty': {
          const na = typeof a.qty === 'number' && Number.isFinite(a.qty) ? a.qty : -Number.MAX_VALUE;
          const nb = typeof b.qty === 'number' && Number.isFinite(b.qty) ? b.qty : -Number.MAX_VALUE;
          return cmpNum(na, nb, dir);
        }
        case 'scheduled':
          return cmpStr(
            a.scheduledDate ? String(a.scheduledDate).slice(0, 10) : '',
            b.scheduledDate ? String(b.scheduledDate).slice(0, 10) : '',
            dir
          );
        case 'notes':
          return cmpStr((a.notes ?? '').trim(), (b.notes ?? '').trim(), dir);
        default:
          return 0;
      }
    });
    return list;
  }, [schedules, shipmentSort]);

  const projectsForNewAudit = useMemo(() => {
    if (!newAudit.supplierId) return projectHistories;
    return projectHistories.filter((p) => !p.supplierId || p.supplierId === newAudit.supplierId);
  }, [projectHistories, newAudit.supplierId]);

  const sortedFilteredProjectHistories = useMemo(() => {
    if (!projectTableSort.key) return filteredProjectHistories;
    const { key: k, dir } = projectTableSort;
    const list = [...filteredProjectHistories];
    const revenueSortVal = (r: ProjectHistoryRow) => {
      if (typeof r.revenueAmount === 'number' && Number.isFinite(r.revenueAmount)) return r.revenueAmount;
      if (r.revenue) {
        const n = Number(String(r.revenue).replace(/[^0-9.-]/g, ''));
        return Number.isFinite(n) ? n : 0;
      }
      return 0;
    };
    list.sort((a, b) => {
      switch (k) {
        case 'projectCode':
          return cmpStr(a.projectCode, b.projectCode, dir);
        case 'clientName':
          return cmpStr(a.clientName, b.clientName, dir);
        case 'companyName':
          return cmpStr(a.companyName, b.companyName, dir);
        case 'buyer': {
          const la = a.buyer ? (a.buyer.name?.trim() || a.buyer.email) : '';
          const lb = b.buyer ? (b.buyer.name?.trim() || b.buyer.email) : '';
          return cmpStr(la, lb, dir);
        }
        case 'supplier': {
          const sa = a.supplier ? `${a.supplier.code} ${a.supplier.name}` : '';
          const sb = b.supplier ? `${b.supplier.code} ${b.supplier.name}` : '';
          return cmpStr(sa, sb, dir);
        }
        case 'email':
          return cmpStr(a.clientEmail ?? '', b.clientEmail ?? '', dir);
        case 'mobile':
          return cmpStr(a.clientMobile ?? '', b.clientMobile ?? '', dir);
        case 'industry':
          return cmpStr(a.industry ?? '', b.industry ?? '', dir);
        case 'country':
          return cmpStr(a.country ?? '', b.country ?? '', dir);
        case 'description':
          return cmpStr((a.projectDescription ?? '').trim(), (b.projectDescription ?? '').trim(), dir);
        case 'period': {
          const da = dateMs(a.popStart);
          const db = dateMs(b.popStart);
          if (da !== db) return cmpNum(da, db, dir);
          return cmpStr(
            formatProjectPopCell(a.popStart, a.popEnd),
            formatProjectPopCell(b.popStart, b.popEnd),
            dir
          );
        }
        case 'revenue':
          return cmpNum(revenueSortVal(a), revenueSortVal(b), dir);
        case 'status':
          return cmpStr(a.status, b.status, dir);
        default:
          return 0;
      }
    });
    return list;
  }, [filteredProjectHistories, projectTableSort]);

  const projectHistoryRevenueTotal = useMemo(() => {
    return filteredProjectHistories.reduce((sum, r) => {
      const n = r.revenueAmount;
      return sum + (typeof n === 'number' && Number.isFinite(n) ? n : 0);
    }, 0);
  }, [filteredProjectHistories]);

  const projectAttachmentCountByProjectId = useMemo(() => {
    const map: Record<string, number> = {};
    for (const row of rows) {
      if (!row.projectHistoryId) continue;
      map[row.projectHistoryId] = (map[row.projectHistoryId] ?? 0) + 1;
    }
    return map;
  }, [rows]);

  /** Inactive projects whose POP is in the past (or missing / invalid) — “closed”; excludes future POP. */
  const profitRowsClosedPast = useMemo(
    () => profitRows.filter((r) => popWindowTone(r.popStart, r.popEnd) === 'inactivePast'),
    [profitRows]
  );

  const closedProjectsProfitTotal = useMemo(
    () => profitRowsClosedPast.reduce((sum, r) => sum + r.profit, 0),
    [profitRowsClosedPast]
  );

  const closedProjectCount = profitRowsClosedPast.length;

  const profitRowsDisplaySorted = useMemo(() => {
    const list = [...profitRows];
    const rank = (r: ProfitRow) => {
      const tone = popWindowTone(r.popStart, r.popEnd);
      if (tone === 'active') return 0;
      if (tone === 'inactivePast') return 1;
      return 2;
    };
    list.sort((a, b) => {
      const ra = rank(a);
      const rb = rank(b);
      if (ra !== rb) return ra - rb;
      return a.projectCode.localeCompare(b.projectCode, undefined, { sensitivity: 'base' });
    });
    return list;
  }, [profitRows]);

  const isAdmin = user?.roleNames?.includes('Admin') ?? false;

  const loadProjectHistories = () => {
    if (!token) return;
    apiJson<ProjectHistoryRow[]>('/project-history', { token })
      .then(setProjectHistories)
      .catch(() => setProjectHistories([]));
  };

  const loadProjectHistoryBuyers = () => {
    if (!token) return;
    apiJson<ProjectHistoryBuyer[]>('/project-history/buyers', { token })
      .then(setBuyerOptions)
      .catch(() => setBuyerOptions([]));
  };

  const loadProfit = () => {
    if (!token) return;
    apiJson<ProfitRow[]>('/project-history/profit-summary', { token })
      .then(setProfitRows)
      .catch(() => setProfitRows([]));
  };

  const load = () => {
    if (!token) return;
    Promise.all([
      apiJson<InternalRow[]>('/internal-docs', { token }),
      apiJson<SupplierOption[]>('/suppliers', { token }),
      apiJson<AuditTypeOption[]>('/audits/types', { token }),
      apiJson<ScheduleRow[]>('/shipment-schedule', { token }),
    ])
      .then(([docs, supplierList, typeList, sched]) => {
        setRows(docs);
        setSuppliers(supplierList);
        setAuditTypes(typeList);
        setSchedules(sched);
      })
      .catch((e) => setError(parseApiError(e)));
  };

  useEffect(() => {
    if (!token || !isAdmin) return;
    setLoading(true);
    setError(null);
    Promise.all([
      apiJson<InternalRow[]>('/internal-docs', { token }),
      apiJson<SupplierOption[]>('/suppliers', { token }),
      apiJson<AuditTypeOption[]>('/audits/types', { token }),
      apiJson<ScheduleRow[]>('/shipment-schedule', { token }),
    ])
      .then(([docs, supplierList, typeList, sched]) => {
        setRows(docs);
        setSuppliers(supplierList);
        setAuditTypes(typeList);
        setSchedules(sched);
      })
      .catch((e) => setError(parseApiError(e)))
      .finally(() => setLoading(false));
  }, [token, isAdmin]);

  useEffect(() => {
    if (!token || !isAdmin || tab !== 'audits') return;
    loadProjectHistories();
  }, [token, isAdmin, tab]);

  useEffect(() => {
    if (!token || !isAdmin || tab !== 'audits') {
      setAuditAuditors([]);
      return;
    }
    apiJson<{ list: AuditAuditorOption[] }>('/audits/auditors', { token })
      .then((r) => setAuditAuditors(r.list ?? []))
      .catch(() => setAuditAuditors([]));
  }, [token, isAdmin, tab]);

  useEffect(() => {
    if (!token || !isAdmin || (tab !== 'projectHistory' && tab !== 'profit')) return;
    if (tab === 'projectHistory') {
      loadProjectHistories();
      loadProjectHistoryBuyers();
    }
    if (tab === 'profit') loadProfit();
  }, [token, isAdmin, tab]);

  if (user && !isAdmin) {
    return <Navigate to={getDefaultPath(user.roleNames)} replace />;
  }

  const submit = async (
    e: React.FormEvent,
    options?: {
      categoryOverride?: string | null;
      projectHistoryId?: string | null;
      buyerId?: string | null;
      employeeUserId?: string | null;
    }
  ) => {
    e.preventDefault();
    if (!token || !name.trim()) return;
    if (file && file.size > 8 * 1024 * 1024) {
      toast.error(t('toast.fileTooLarge8mb'));
      return;
    }
    setSubmitting(true);
    setUploadProgress(file ? 0 : null);
    try {
      let fileBase64: string | undefined;
      let fileName: string | undefined;
      if (file) {
        fileBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onprogress = (evt) => {
            if (!evt.lengthComputable) return;
            setUploadProgress(Math.max(0, Math.min(100, Math.round((evt.loaded / evt.total) * 100))));
          };
          reader.onload = () => {
            const s = reader.result as string;
            const i = s.indexOf(',');
            setUploadProgress(100);
            resolve(i >= 0 ? s.slice(i + 1) : s);
          };
          reader.onerror = () => reject(new Error('Could not read file'));
          reader.readAsDataURL(file);
        });
        fileName = file.name;
      }
      const payload: Record<string, unknown> = {
        name: name.trim(),
        category:
          options?.categoryOverride !== undefined ? options.categoryOverride : category.trim() || null,
        note: note.trim() || null,
        ...(fileBase64 ? { fileBase64, fileName } : {}),
      };
      if (options && 'projectHistoryId' in options) {
        payload.projectHistoryId = options.projectHistoryId;
      }
      if (options && 'buyerId' in options) {
        payload.buyerId = options.buyerId;
      }
      if (options && 'employeeUserId' in options) {
        payload.employeeUserId = options.employeeUserId;
      }
      await apiJson('/internal-docs', {
        token,
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setName('');
      setCategory('');
      setNote('');
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setUploadProgress(null);
      toast.success(t('toast.saved'));
      load();
    } catch (e) {
      toast.error(parseApiError(e));
    } finally {
      setSubmitting(false);
      setUploadProgress(null);
    }
  };

  const submitSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !scheduleForm.supplierId.trim() || !scheduleForm.scheduledDate.trim()) {
      toast.error(t('internal.toast.supplierAndDateRequired'));
      return;
    }
    let qty: number | null = null;
    if (scheduleForm.qty.trim() !== '') {
      const n = Number(scheduleForm.qty);
      if (!Number.isFinite(n) || n < 0) {
        toast.error(t('internal.toast.qtyNonNegative'));
        return;
      }
      qty = Math.floor(n);
    }
    setScheduleSubmitting(true);
    try {
      await apiJson('/shipment-schedule', {
        token,
        method: 'POST',
        body: JSON.stringify({
          supplierId: scheduleForm.supplierId,
          purchaseOrder: scheduleForm.purchaseOrder.trim() || null,
          partNumber: scheduleForm.partNumber.trim() || null,
          qty,
          scheduledDate: scheduleForm.scheduledDate.trim(),
          notes: scheduleForm.notes.trim() || null,
        }),
      });
      toast.success(t('internal.toast.scheduleRowAdded'));
      setScheduleForm({
        supplierId: '',
        purchaseOrder: '',
        partNumber: '',
        qty: '',
        scheduledDate: '',
        notes: '',
      });
      load();
    } catch (e) {
      toast.error(parseApiError(e));
    } finally {
      setScheduleSubmitting(false);
    }
  };

  const removeSchedule = async (id: string) => {
    if (!token) return;
    setScheduleDeleteId(null);
    setScheduleBusyId(id);
    try {
      await apiJson(`/shipment-schedule/${id}`, { token, method: 'DELETE' });
      toast.success(t('toast.removed'));
      load();
    } catch (e) {
      toast.error(parseApiError(e));
    } finally {
      setScheduleBusyId(null);
    }
  };

  const remove = async (id: string) => {
    if (!token) return;
    setDeleteConfirmId(null);
    setDeletingId(id);
    try {
      await apiJson(`/internal-docs/${id}`, { token, method: 'DELETE' });
      toast.success(t('toast.deleted'));
      load();
    } catch (e) {
      toast.error(parseApiError(e));
    } finally {
      setDeletingId(null);
    }
  };

  const download = async (r: InternalRow) => {
    if (!token || !r.filePath) {
      toast.error(t('toast.noFileAttached'));
      return;
    }
    try {
      setDownloading((prev) => ({ ...prev, [r.id]: 0 }));
      await downloadWithAuthProgress(`/internal-docs/${r.id}/download`, token, r.name, (p) => {
        setDownloading((prev) => ({ ...prev, [r.id]: p }));
      });
      toast.success(t('toast.downloadCompleted'));
    } catch (e) {
      toast.error(parseApiError(e));
    } finally {
      setDownloading((prev) => {
        const next = { ...prev };
        delete next[r.id];
        return next;
      });
    }
  };

  const submitAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !newAudit.supplierId || !newAudit.auditDate) return;
    setSubmittingAudit(true);
    try {
      const created = await apiJson<{ code: string }>('/audits', {
        token,
        method: 'POST',
        body: JSON.stringify({
          supplierId: newAudit.supplierId,
          auditDate: newAudit.auditDate,
          auditTypeId: newAudit.auditTypeId || null,
          auditor: newAudit.auditor || null,
          summary: newAudit.summary || null,
          scope: newAudit.scope || null,
          projectHistoryId: newAudit.projectHistoryId.trim() || null,
        }),
      });
      toast.success(t('internal.toast.auditCreated', { code: created.code }));
      setNewAudit({
        supplierId: '',
        auditDate: '',
        auditTypeId: '',
        auditor: '',
        summary: '',
        scope: '',
        projectHistoryId: '',
      });
    } catch (e) {
      toast.error(parseApiError(e));
    } finally {
      setSubmittingAudit(false);
    }
  };

  const resetProjectForm = () => {
    setProjectEditingId(null);
    setClientForm({
      clientName: '',
      companyName: '',
      clientEmail: '',
      clientMobile: '',
      industry: '',
      country: '',
      projectDescription: '',
      popStart: '',
      popEnd: '',
      revenue: '',
      buyerId: '',
      supplierId: '',
    });
  };

  const submitProjectHistory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !clientForm.clientName.trim() || !clientForm.companyName.trim()) {
      toast.error(t('internal.toast.clientAndCompanyRequired'));
      return;
    }
    setProjectSubmitting(true);
    try {
      if (projectEditingId) {
        await apiJson(`/project-history/${projectEditingId}`, {
          token,
          method: 'PATCH',
          body: JSON.stringify({
            clientName: clientForm.clientName.trim(),
            companyName: clientForm.companyName.trim(),
            clientEmail: clientForm.clientEmail.trim() || null,
            clientMobile: clientForm.clientMobile.trim() || null,
            industry: clientForm.industry.trim() || null,
            country: clientForm.country.trim() || null,
            projectDescription: clientForm.projectDescription.trim() || null,
            popStart: clientForm.popStart.trim(),
            popEnd: clientForm.popEnd.trim(),
            revenue: clientForm.revenue.trim() || null,
            buyerId: clientForm.buyerId.trim() || null,
            supplierId: clientForm.supplierId.trim() || null,
          }),
        });
        toast.success(t('internal.toast.projectHistoryUpdated'));
      } else {
        await apiJson('/project-history', {
          token,
          method: 'POST',
          body: JSON.stringify({
            clientName: clientForm.clientName.trim(),
            companyName: clientForm.companyName.trim(),
            clientEmail: clientForm.clientEmail.trim() || null,
            clientMobile: clientForm.clientMobile.trim() || null,
            industry: clientForm.industry.trim() || null,
            country: clientForm.country.trim() || null,
            projectDescription: clientForm.projectDescription.trim() || null,
            popStart: clientForm.popStart.trim(),
            popEnd: clientForm.popEnd.trim(),
            revenue: clientForm.revenue.trim() || null,
            buyerId: clientForm.buyerId.trim() || null,
            supplierId: clientForm.supplierId.trim() || null,
          }),
        });
        toast.success(t('internal.toast.projectHistoryAdded'));
      }
      resetProjectForm();
      loadProjectHistories();
      loadProfit();
    } catch (e) {
      toast.error(parseApiError(e));
    } finally {
      setProjectSubmitting(false);
    }
  };

  const startEditProject = (row: ProjectHistoryRow) => {
    setProjectEditingId(row.id);
    setClientForm({
      clientName: row.clientName,
      companyName: row.companyName,
      clientEmail: row.clientEmail ?? '',
      clientMobile: row.clientMobile ?? '',
      industry: row.industry ?? '',
      country: row.country ?? '',
      projectDescription: row.projectDescription ?? '',
      popStart: projectPopToInputDate(row.popStart),
      popEnd: projectPopToInputDate(row.popEnd),
      revenue: row.revenue ?? '',
      buyerId: row.buyerId ?? '',
      supplierId: row.supplierId ?? '',
    });
  };

  const deleteProjectHistory = async (id: string) => {
    if (!token) return;
    setProjectBusyId(id);
    try {
      await apiJson(`/project-history/${id}`, { token, method: 'DELETE' });
      toast.success(t('toast.removed'));
      if (projectEditingId === id) resetProjectForm();
      loadProjectHistories();
      loadProfit();
    } catch (e) {
      toast.error(parseApiError(e));
    } finally {
      setProjectBusyId(null);
    }
  };

  const uploadProjectAttachment = async (projectHistoryId: string, fileToUpload: File | null) => {
    if (!token || !fileToUpload) return;
    if (fileToUpload.size > 8 * 1024 * 1024) {
      toast.error(t('toast.fileTooLarge8mb'));
      return;
    }
    setProjectAttachmentBusyId(projectHistoryId);
    try {
      const fileBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const s = reader.result as string;
          const i = s.indexOf(',');
          resolve(i >= 0 ? s.slice(i + 1) : s);
        };
        reader.onerror = () => reject(new Error('Could not read file'));
        reader.readAsDataURL(fileToUpload);
      });
      await apiJson('/internal-docs', {
        token,
        method: 'POST',
        body: JSON.stringify({
          name: fileToUpload.name,
          category: 'Project Attachment',
          note: null,
          fileBase64,
          fileName: fileToUpload.name,
          projectHistoryId,
        }),
      });
      toast.success(t('internal.toast.attachmentAdded'));
      load();
    } catch (e) {
      toast.error(parseApiError(e));
    } finally {
      setProjectAttachmentBusyId(null);
    }
  };

  const renderProfitTable = (sectionRows: ProfitRow[], emptyText: string) => (
    <div className="table-wrap" style={{ overflowX: 'auto' }}>
      {sectionRows.length === 0 ? (
        <p className="table-empty">{emptyText}</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>{t('table.col.project')}</th>
              <th>{t('table.col.company')}</th>
              <th>{t('table.col.revenue')}</th>
              <th>{t('table.col.deduction')}</th>
              <th>{t('table.col.amount')}</th>
              <th>{t('table.col.profit')}</th>
            </tr>
          </thead>
          <tbody>
            {sectionRows.flatMap((r) => {
              const rowStyle = profitRowStyle(r);
              const rowTitle = profitRowTitle(r);
              const popTone = popWindowTone(r.popStart, r.popEnd);
              /** Same cohort as “Total profit (closed projects)” — only those final profit cells are emphasized. */
              const isClosedForProfitSummary = popTone === 'inactivePast';
              const deductions = sortDeductionsForDisplay(r.deductions ?? []);
              const rowsForProject =
                deductions.length > 0
                  ? deductions
                  : [{ code: '—', amount: 0, kind: 'Expense' as const }];
              const revenue = Number.isFinite(r.revenueAmount) ? r.revenueAmount : 0;
              const deductionAmounts = rowsForProject.map((d) => d.amount);
              return rowsForProject.map((d, i) => {
                const deductionsThroughThisRow = deductionAmounts.slice(0, i + 1).reduce((sum, x) => sum + x, 0);
                const runningProfit = revenue - deductionsThroughThisRow;
                const isFirst = i === 0;
                const isFinalProfitRow = i === rowsForProject.length - 1;
                const emphasizeFinalProfit = isFinalProfitRow && isClosedForProfitSummary;
                const tdStyle = (extra?: Record<string, string | number>): Record<string, string | number> => ({
                  ...rowStyle,
                  ...(extra ?? {}),
                });
                return (
                  <tr key={`${r.projectId}-${d.code}-${i}`} title={rowTitle}>
                    {isFirst ? (
                      <>
                        <td rowSpan={rowsForProject.length} style={tdStyle()}>
                          {r.projectCode}
                        </td>
                        <td rowSpan={rowsForProject.length} style={tdStyle()}>
                          {r.companyName}
                        </td>
                        <td rowSpan={rowsForProject.length} style={tdStyle()}>
                          {r.revenue ?? formatProfitMoney(revenue)}
                        </td>
                      </>
                    ) : null}
                    <td style={tdStyle()}>{d.code === '—' ? '—' : `${d.code} (${d.kind})`}</td>
                    <td style={tdStyle()}>{d.code === '—' ? '—' : formatProfitMoney(d.amount)}</td>
                    <td style={tdStyle(emphasizeFinalProfit ? { fontWeight: 700 } : undefined)}>
                      {formatProfitMoney(runningProfit)}
                    </td>
                  </tr>
                );
              });
            })}
          </tbody>
        </table>
      )}
    </div>
  );

  return (
    <div className="page">
      <header className="page-header">
        <h1 className="page-title">{t('internal.title')}</h1>
      </header>

      <div className="page-tab-rail">
        {(
          [
            ['audits', t('internal.tab.audits')],
            ['shipments', t('internal.tab.shipments')],
            ['calendar', t('internal.tab.calendar')],
            ['documents', t('internal.tab.documents')],
            ['projectHistory', t('internal.tab.projectHistory')],
            ['profit', t('internal.tab.profit')],
            ['laborCosts', t('internal.tab.laborCosts')],
            ['expenses', t('internal.tab.expenses')],
            ['employeeAssignments', t('internal.tab.employeeAssignments')],
            ['managementAssignments', t('internal.tab.managementAssignments')],
            ['orgChart', t('internal.tab.orgChart')],
          ] as const
        ).map(([tabId, label]) => (
          <button
            key={tabId}
            type="button"
            className={tab === tabId ? 'btn btn-primary' : 'btn btn-ghost'}
            onClick={() => setTab(tabId)}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <div className="alert-error">{error}</div>}

      {tab === 'orgChart' && (
        <InternalManagementOrgChart
          token={token}
          viewerDisplayName={user?.name?.trim() || user?.email || t('internal.orgChart.you')}
          employeeProfilePathPrefix="/internal-management/employee-profile"
        />
      )}

      {tab === 'calendar' && <InternalManagementCalendarView token={token} />}

      {tab === 'audits' && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div className="card-body">
            <h2 style={{ marginTop: 0 }}>{t('internal.scheduleAudit.title')}</h2>
            <form onSubmit={submitAudit}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                  gap: '0.75rem',
                  marginBottom: '0.75rem',
                }}
              >
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">{t('internal.scheduleAudit.supplier')}</label>
                  <select
                    className="input"
                    value={newAudit.supplierId}
                    onChange={(e) =>
                      setNewAudit((p) => ({
                        ...p,
                        supplierId: e.target.value,
                        projectHistoryId: '',
                      }))
                    }
                    required
                  >
                    <option value="">{t('internal.scheduleAudit.select')}</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.code}: {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">{t('internal.scheduleAudit.date')}</label>
                  <input
                    type="date"
                    className="input"
                    value={newAudit.auditDate}
                    onChange={(e) => setNewAudit((p) => ({ ...p, auditDate: e.target.value }))}
                    required
                  />
                </div>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">{t('internal.scheduleAudit.auditType')}</label>
                  <select
                    className="input"
                    value={newAudit.auditTypeId}
                    onChange={(e) => setNewAudit((p) => ({ ...p, auditTypeId: e.target.value }))}
                  >
                    <option value="">{t('internal.scheduleAudit.dash')}</option>
                    {auditTypes.map((at) => (
                      <option key={at.id} value={at.id}>
                        {at.code}
                        {at.name ? ` — ${at.name}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">{t('internal.scheduleAudit.project')}</label>
                  <select
                    className="input"
                    value={newAudit.projectHistoryId}
                    onChange={(e) => setNewAudit((p) => ({ ...p, projectHistoryId: e.target.value }))}
                  >
                    <option value="">{t('internal.scheduleAudit.none')}</option>
                    {projectsForNewAudit.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.projectCode} — {p.companyName}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">{t('internal.scheduleAudit.auditor')}</label>
                  <select
                    className="input"
                    value={newAudit.auditor}
                    onChange={(e) => setNewAudit((p) => ({ ...p, auditor: e.target.value }))}
                  >
                    <option value="">{t('internal.scheduleAudit.dash')}</option>
                    {auditAuditors.map((a) => (
                      <option key={a.id} value={a.name}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="input-group" style={{ marginBottom: '0.75rem' }}>
                <label className="input-label">{t('internal.scheduleAudit.summary')}</label>
                <input
                  className="input"
                  value={newAudit.summary}
                  onChange={(e) => setNewAudit((p) => ({ ...p, summary: e.target.value }))}
                  placeholder={t('internal.scheduleAudit.optionalPlaceholder')}
                />
              </div>
              <div className="input-group" style={{ marginBottom: '0.75rem' }}>
                <label className="input-label">{t('internal.scheduleAudit.scope')}</label>
                <input
                  className="input"
                  value={newAudit.scope}
                  onChange={(e) => setNewAudit((p) => ({ ...p, scope: e.target.value }))}
                  placeholder={t('internal.scheduleAudit.optionalPlaceholder')}
                />
              </div>
              <button type="submit" className="btn btn-primary" disabled={submittingAudit}>
                {submittingAudit ? t('internal.scheduleAudit.creating') : t('internal.scheduleAudit.create')}
              </button>
            </form>
          </div>
        </div>
      )}

      {tab === 'shipments' && (
        <>
          <div className="card" style={{ marginBottom: '1rem' }}>
            <div className="card-body">
              <h2 style={{ marginTop: 0 }}>Shipments</h2>
              {/* <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginTop: 0 }}>
                Planned shipment schedule (OTD / planning). Supplier inspection requests are reviewed on the Shipments page.
              </p> */}
              <form onSubmit={submitSchedule}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                    gap: '0.75rem',
                    marginBottom: '0.75rem',
                  }}
                >
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">Supplier *</label>
                    <select
                      className="input"
                      value={scheduleForm.supplierId}
                      onChange={(e) => setScheduleForm((p) => ({ ...p, supplierId: e.target.value }))}
                      required
                    >
                      <option value="">Select</option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.code}: {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">PO</label>
                    <input
                      className="input"
                      value={scheduleForm.purchaseOrder}
                      onChange={(e) => setScheduleForm((p) => ({ ...p, purchaseOrder: e.target.value }))}
                    />
                  </div>
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">Part #</label>
                    <input
                      className="input"
                      value={scheduleForm.partNumber}
                      onChange={(e) => setScheduleForm((p) => ({ ...p, partNumber: e.target.value }))}
                    />
                  </div>
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">Qty</label>
                    <input
                      type="number"
                      min={0}
                      className="input"
                      value={scheduleForm.qty}
                      onChange={(e) => setScheduleForm((p) => ({ ...p, qty: e.target.value }))}
                    />
                  </div>
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">Scheduled date *</label>
                    <input
                      type="date"
                      className="input"
                      value={scheduleForm.scheduledDate}
                      onChange={(e) => setScheduleForm((p) => ({ ...p, scheduledDate: e.target.value }))}
                      required
                    />
                  </div>
                </div>
                <div className="input-group" style={{ marginBottom: '0.75rem' }}>
                  <label className="input-label">Notes</label>
                  <input
                    className="input"
                    value={scheduleForm.notes}
                    onChange={(e) => setScheduleForm((p) => ({ ...p, notes: e.target.value }))}
                    placeholder="Optional"
                  />
                </div>
                <button type="submit" className="btn btn-primary" disabled={scheduleSubmitting}>
                  {scheduleSubmitting ? 'Adding…' : 'Add row'}
                </button>
              </form>
            </div>
          </div>

          <div className="card" style={{ marginBottom: '1rem' }}>
            <div className="card-body">
              <h2 style={{ marginTop: 0 }}>Shipment schedule</h2>
              <div className="table-wrap">
                {schedules.length === 0 ? (
                  <p className="table-empty">No scheduled rows.</p>
                ) : (
                  <table className="table">
                    <thead>
                      <tr>
                        <SortableTh
                          label={t('findings.col.supplier')}
                          columnKey="supplier"
                          activeKey={shipmentSort.key}
                          dir={shipmentSort.dir}
                          onSort={(col) => setShipmentSort((p) => toggleSort(p, col))}
                        />
                        <SortableTh
                          label={t('shipments.col.po')}
                          columnKey="po"
                          activeKey={shipmentSort.key}
                          dir={shipmentSort.dir}
                          onSort={(col) => setShipmentSort((p) => toggleSort(p, col))}
                        />
                        <SortableTh
                          label={t('shipments.col.partNumber')}
                          columnKey="part"
                          activeKey={shipmentSort.key}
                          dir={shipmentSort.dir}
                          onSort={(col) => setShipmentSort((p) => toggleSort(p, col))}
                        />
                        <SortableTh
                          label={t('shipments.col.quantity')}
                          columnKey="qty"
                          activeKey={shipmentSort.key}
                          dir={shipmentSort.dir}
                          onSort={(col) => setShipmentSort((p) => toggleSort(p, col))}
                        />
                        <SortableTh
                          label={t('internal.scheduleCol.scheduled')}
                          columnKey="scheduled"
                          activeKey={shipmentSort.key}
                          dir={shipmentSort.dir}
                          onSort={(col) => setShipmentSort((p) => toggleSort(p, col))}
                        />
                        <SortableTh
                          label={t('shipments.col.notes')}
                          columnKey="notes"
                          activeKey={shipmentSort.key}
                          dir={shipmentSort.dir}
                          onSort={(col) => setShipmentSort((p) => toggleSort(p, col))}
                        />
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {sortedSchedules.map((r) => (
                        <tr key={r.id}>
                          <td>
                            {r.supplier ? `${r.supplier.code}: ${r.supplier.name}` : '—'}
                          </td>
                          <td>{r.purchaseOrder ?? '—'}</td>
                          <td>{r.partNumber ?? '—'}</td>
                          <td>{r.qty ?? '—'}</td>
                          <td>{formatDisplayCalendarDate(r.scheduledDate ? String(r.scheduledDate) : null)}</td>
                          <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {r.notes?.trim() ? r.notes : '—'}
                          </td>
                          <td>
                            <button
                              type="button"
                              className="btn btn-danger"
                              disabled={scheduleBusyId === r.id}
                              onClick={() => setScheduleDeleteId(r.id)}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {tab === 'documents' && (
        <>
          <div className="card" style={{ marginBottom: '1rem' }}>
            <div className="card-body">
              <h2 style={{ marginTop: 0 }}>Upload</h2>
              <form
                onSubmit={(e) => {
                  void submit(e, { categoryOverride: 'Document' });
                }}
              >
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns:
                      'minmax(180px, 1fr) minmax(220px, 1.2fr) minmax(240px, 1.2fr) auto',
                    gap: '0.75rem',
                    alignItems: 'flex-end',
                    paddingBottom: 22,
                  }}
                >
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">Name *</label>
                    <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
                  </div>
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">Note</label>
                    <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
                  </div>
                  <div className="input-group" style={{ marginBottom: 0, position: 'relative' }}>
                    <label className="input-label">File (optional)</label>
                    <input
                      ref={fileInputRef}
                      className="input"
                      type="file"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        setFile(e.target.files?.[0] ?? null);
                        setUploadProgress(null);
                      }}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button
                        type="button"
                        className="btn file-picker-btn"
                        onClick={() => fileInputRef.current?.click()}
                        style={{ whiteSpace: 'nowrap' }}
                      >
                        Choose file
                      </button>
                      <span
                        style={{
                          fontSize: 'var(--text-xs)',
                          color: 'var(--color-text-muted)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          display: 'inline-block',
                          maxWidth: 170,
                        }}
                        title={file?.name || 'No file chosen'}
                      >
                        {file?.name || 'No file chosen'}
                      </span>
                    </div>
                    <div
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        marginTop: 4,
                        minHeight: 18,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                        fontSize: 'var(--text-xs)',
                        color: 'var(--color-text-muted)',
                      }}
                    >
                      <span>
                        {file
                          ? `Size: ${(file.size / (1024 * 1024)).toFixed(2)} MB · Ext: ${
                              file.name.includes('.') ? `.${file.name.split('.').pop()}` : '—'
                            }`
                          : ''}
                      </span>
                      {uploadProgress !== null && file ? (
                        <span style={{ minWidth: 140, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <progress value={uploadProgress} max={100} style={{ width: 90, height: 8 }} />
                          <span>{uploadProgress}%</span>
                        </span>
                      ) : (
                        <span />
                      )}
                    </div>
                  </div>
                  <button type="submit" className="btn btn-primary" disabled={submitting}>
                    {submitting ? '…' : 'Add'}
                  </button>
                </div>
              </form>
            </div>
          </div>

          <div className="card">
            <div className="card-body">
              <h2 style={{ marginTop: 0 }}>{t('documents.libraryTitle')}</h2>
              <div className="table-wrap">
                {loading ? (
                  <p className="table-empty">{t('common.loading')}</p>
                ) : rows.length === 0 ? (
                  <p className="table-empty">{t('internal.documents.empty')}</p>
                ) : (
                  <table className="table">
                    <thead>
                      <tr>
                        <th>{t('table.col.name')}</th>
                        <th>{t('table.col.note')}</th>
                        <th>{t('table.col.view')}</th>
                        <th>{t('table.col.updated')}</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.id}>
                          <td>{r.name}</td>
                          <td>{r.note ?? '—'}</td>
                          <td>
                            {r.filePath ? (
                              <button
                                type="button"
                                className="btn"
                                onClick={() => download(r)}
                                disabled={downloading[r.id] !== undefined}
                                style={downloading[r.id] !== undefined ? { minWidth: 160 } : undefined}
                              >
                                {downloading[r.id] !== undefined ? (
                                  <span style={{ minWidth: 140, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                    <progress value={downloading[r.id]} max={100} style={{ width: 90, height: 8 }} />
                                    <span>{downloading[r.id]}%</span>
                                  </span>
                                ) : (
                                  'Download'
                                )}
                              </button>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td>{formatDisplayDateTime(r.updatedAt)}</td>
                          <td>
                            <button
                              type="button"
                              className="btn btn-danger"
                              disabled={deletingId === r.id}
                              onClick={() => setDeleteConfirmId(r.id)}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {tab === 'projectHistory' && (
        <>
          <div style={{ width: '100%', maxWidth: '100%', minWidth: 0, marginBottom: '1rem', boxSizing: 'border-box' }}>
            <MetricCard
              title="Total Revenue"
              value={projectHistoryRevenueTotal.toLocaleString(locale, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            />
          </div>

          <div className="card" style={{ marginBottom: '1rem' }}>
            <div className="card-body">
              <h2 style={{ marginTop: 0 }}>{projectEditingId ? 'Edit Project' : 'Add Project'}</h2>
              <form onSubmit={submitProjectHistory}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                    gap: '0.75rem',
                    marginBottom: '0.75rem',
                  }}
                >
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">Client name *</label>
                    <input
                      className="input"
                      value={clientForm.clientName}
                      onChange={(e) => setClientForm((p) => ({ ...p, clientName: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">Company name *</label>
                    <input
                      className="input"
                      value={clientForm.companyName}
                      onChange={(e) => setClientForm((p) => ({ ...p, companyName: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">Client email</label>
                    <input
                      className="input"
                      type="email"
                      value={clientForm.clientEmail}
                      onChange={(e) => setClientForm((p) => ({ ...p, clientEmail: e.target.value }))}
                    />
                  </div>
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">Client mobile</label>
                    <input
                      className="input"
                      value={clientForm.clientMobile}
                      onChange={(e) => setClientForm((p) => ({ ...p, clientMobile: e.target.value }))}
                    />
                  </div>
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">Industry</label>
                    <input
                      className="input"
                      value={clientForm.industry}
                      onChange={(e) => setClientForm((p) => ({ ...p, industry: e.target.value }))}
                    />
                  </div>
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">Country</label>
                    <input
                      className="input"
                      value={clientForm.country}
                      onChange={(e) => setClientForm((p) => ({ ...p, country: e.target.value }))}
                    />
                  </div>
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">Buyer</label>
                    <select
                      className="input"
                      value={clientForm.buyerId}
                      onChange={(e) => setClientForm((p) => ({ ...p, buyerId: e.target.value }))}
                    >
                      <option value="">None</option>
                      {buyerOptions.map((b) => (
                        <option key={b.id} value={b.id}>
                          {(b.name?.trim() || b.email) ?? b.id}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">Supplier</label>
                    <select
                      className="input"
                      value={clientForm.supplierId}
                      onChange={(e) => setClientForm((p) => ({ ...p, supplierId: e.target.value }))}
                    >
                      <option value="">None</option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.code}: {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">Period of performance — start</label>
                    <input
                      type="date"
                      className="input"
                      value={clientForm.popStart}
                      onChange={(e) => setClientForm((p) => ({ ...p, popStart: e.target.value }))}
                    />
                  </div>
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">Period of performance — end</label>
                    <input
                      type="date"
                      className="input"
                      value={clientForm.popEnd}
                      onChange={(e) => setClientForm((p) => ({ ...p, popEnd: e.target.value }))}
                    />
                  </div>
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">Revenue</label>
                    <input
                      className="input"
                      value={clientForm.revenue}
                      onChange={(e) => setClientForm((p) => ({ ...p, revenue: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="input-group" style={{ marginBottom: '0.75rem' }}>
                  <label className="input-label">Project description</label>
                  <textarea
                    className="input"
                    rows={3}
                    value={clientForm.projectDescription}
                    onChange={(e) => setClientForm((p) => ({ ...p, projectDescription: e.target.value }))}
                  />
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button type="submit" className="btn btn-primary" disabled={projectSubmitting}>
                    {projectSubmitting ? 'Saving…' : projectEditingId ? 'Update' : 'Add'}
                  </button>
                  {projectEditingId && (
                    <button type="button" className="btn btn-ghost" onClick={resetProjectForm}>
                      Cancel edit
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>

          <div className="card">
            <div className="card-body">
              <h2 style={{ marginTop: 0 }}>Project History</h2>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                  gap: '0.75rem',
                  marginBottom: '1rem',
                  alignItems: 'end',
                }}
              >
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">Filter by buyer</label>
                  <select
                    className="input"
                    value={projectHistoryBuyerFilter}
                    onChange={(e) => setProjectHistoryBuyerFilter(e.target.value)}
                  >
                    <option value="">All buyers</option>
                    {buyerOptions.map((b) => (
                      <option key={b.id} value={b.id}>
                        {(b.name?.trim() || b.email) ?? b.id}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">Filter by supplier</label>
                  <select
                    className="input"
                    value={projectHistorySupplierFilter}
                    onChange={(e) => setProjectHistorySupplierFilter(e.target.value)}
                  >
                    <option value="">All suppliers</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.code}: {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="table-wrap" style={{ overflowX: 'auto' }}>
                {projectHistories.length === 0 ? (
                  <p className="table-empty">No project records yet.</p>
                ) : filteredProjectHistories.length === 0 ? (
                  <p className="table-empty">No projects match the selected filters.</p>
                ) : (
                  <table className="table">
                    <thead>
                      <tr>
                        <SortableTh
                          label="Project"
                          columnKey="projectCode"
                          activeKey={projectTableSort.key}
                          dir={projectTableSort.dir}
                          onSort={(col) => setProjectTableSort((p) => toggleSort(p, col))}
                        />
                        <SortableTh
                          label="Client name"
                          columnKey="clientName"
                          activeKey={projectTableSort.key}
                          dir={projectTableSort.dir}
                          onSort={(col) => setProjectTableSort((p) => toggleSort(p, col))}
                        />
                        <SortableTh
                          label="Company"
                          columnKey="companyName"
                          activeKey={projectTableSort.key}
                          dir={projectTableSort.dir}
                          onSort={(col) => setProjectTableSort((p) => toggleSort(p, col))}
                        />
                        <SortableTh
                          label="Buyer"
                          columnKey="buyer"
                          activeKey={projectTableSort.key}
                          dir={projectTableSort.dir}
                          onSort={(col) => setProjectTableSort((p) => toggleSort(p, col))}
                        />
                        <SortableTh
                          label="Supplier"
                          columnKey="supplier"
                          activeKey={projectTableSort.key}
                          dir={projectTableSort.dir}
                          onSort={(col) => setProjectTableSort((p) => toggleSort(p, col))}
                        />
                        <SortableTh
                          label="Email"
                          columnKey="email"
                          activeKey={projectTableSort.key}
                          dir={projectTableSort.dir}
                          onSort={(col) => setProjectTableSort((p) => toggleSort(p, col))}
                        />
                        <SortableTh
                          label="Mobile"
                          columnKey="mobile"
                          activeKey={projectTableSort.key}
                          dir={projectTableSort.dir}
                          onSort={(col) => setProjectTableSort((p) => toggleSort(p, col))}
                        />
                        <SortableTh
                          label="Industry"
                          columnKey="industry"
                          activeKey={projectTableSort.key}
                          dir={projectTableSort.dir}
                          onSort={(col) => setProjectTableSort((p) => toggleSort(p, col))}
                        />
                        <SortableTh
                          label="Country"
                          columnKey="country"
                          activeKey={projectTableSort.key}
                          dir={projectTableSort.dir}
                          onSort={(col) => setProjectTableSort((p) => toggleSort(p, col))}
                        />
                        <SortableTh
                          label="Description"
                          columnKey="description"
                          activeKey={projectTableSort.key}
                          dir={projectTableSort.dir}
                          onSort={(col) => setProjectTableSort((p) => toggleSort(p, col))}
                        />
                        <SortableTh
                          label="Period"
                          columnKey="period"
                          activeKey={projectTableSort.key}
                          dir={projectTableSort.dir}
                          onSort={(col) => setProjectTableSort((p) => toggleSort(p, col))}
                        />
                        <SortableTh
                          label="Revenue"
                          columnKey="revenue"
                          activeKey={projectTableSort.key}
                          dir={projectTableSort.dir}
                          onSort={(col) => setProjectTableSort((p) => toggleSort(p, col))}
                        />
                        <SortableTh
                          label="Status"
                          columnKey="status"
                          activeKey={projectTableSort.key}
                          dir={projectTableSort.dir}
                          onSort={(col) => setProjectTableSort((p) => toggleSort(p, col))}
                        />
                        <th>{t('table.col.attachments')}</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {sortedFilteredProjectHistories.map((r) => {
                        const tone = projectHistoryRowTone(r);
                        return (
                        <tr
                          key={r.id}
                          style={projectHistoryRowStyle(tone)}
                          title={projectHistoryRowTitle(tone)}
                        >
                          <td>{r.projectCode}</td>
                          <td>{r.clientName}</td>
                          <td>{r.companyName}</td>
                          <td>{r.buyer ? (r.buyer.name?.trim() || r.buyer.email) : '—'}</td>
                          <td>{r.supplier ? `${r.supplier.code}: ${r.supplier.name}` : '—'}</td>
                          <td>{r.clientEmail ?? '—'}</td>
                          <td>{r.clientMobile ?? '—'}</td>
                          <td>{r.industry ?? '—'}</td>
                          <td>{r.country ?? '—'}</td>
                          <td style={{ maxWidth: 200, whiteSpace: 'pre-wrap' }}>{r.projectDescription ?? '—'}</td>
                          <td>{formatProjectPopCell(r.popStart, r.popEnd)}</td>
                          <td>{r.revenue ?? '—'}</td>
                          <td>{r.status}</td>
                          <td>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                                {projectAttachmentCountByProjectId[r.id] ?? 0}
                              </span>
                              <label className="btn btn-ghost" style={{ cursor: 'pointer' }}>
                                {projectAttachmentBusyId === r.id ? 'Adding…' : '+ Add Attachment'}
                                <input
                                  type="file"
                                  style={{ display: 'none' }}
                                  disabled={projectAttachmentBusyId !== null}
                                  onChange={(e) => {
                                    const selectedFile = e.target.files?.[0] ?? null;
                                    e.currentTarget.value = '';
                                    void uploadProjectAttachment(r.id, selectedFile);
                                  }}
                                />
                              </label>
                            </div>
                          </td>
                          <td>
                            <button type="button" className="btn btn-ghost btn-sm" onClick={() => startEditProject(r)}>
                              Edit
                            </button>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              disabled={projectBusyId === r.id}
                              onClick={() => void deleteProjectHistory(r.id)}
                            >
                              {projectBusyId === r.id ? '…' : 'Delete'}
                            </button>
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {tab === 'managementAssignments' && <ManagementAssignmentsPanel token={token} toast={toast} />}

      {tab === 'profit' && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div className="card-body">
            <h2 style={{ marginTop: 0 }}>Profit</h2>
            {profitRows.length === 0 ? (
              <p className="table-empty">No projects yet.</p>
            ) : (
              <>
                <div
                  style={{
                    width: '100%',
                    maxWidth: '100%',
                    minWidth: 0,
                    marginBottom: '1rem',
                    boxSizing: 'border-box',
                  }}
                >
                  <MetricCard
                    title="Total profit (closed projects)"
                    value={formatProfitMoney(closedProjectsProfitTotal)}
                    subtitle={
                      closedProjectCount === 0
                        ? 'No closed projects'
                        : closedProjectCount === 1
                          ? '1 Closed Project'
                          : `${closedProjectCount} Closed Projects`
                    }
                  />
                </div>
                {renderProfitTable(profitRowsDisplaySorted, 'No projects yet.')}
              </>
            )}
          </div>
        </div>
      )}

      {tab === 'employeeAssignments' && (
        <div style={{ marginTop: '1rem' }}>
          <AdminEmployeeAssignmentsPanel
            token={token}
            toast={toast}
          />
        </div>
      )}

      {tab === 'laborCosts' && (
        <div style={{ marginTop: '1rem' }}>
          <AdminLaborCostsPanel token={token} listScope="all" />
        </div>
      )}

      {tab === 'expenses' && (
        <div style={{ marginTop: '1rem' }}>
          <AdminExpensesPanel token={token} toast={toast} excludedProjects={['Global Vendors']} showExpenseIdColumn />
        </div>
      )}

      <ConfirmDialog
        open={deleteConfirmId !== null}
        title="Delete internal document"
        message="Delete this item? This cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => {
          if (!deleteConfirmId) return;
          void remove(deleteConfirmId);
        }}
        onCancel={() => setDeleteConfirmId(null)}
      />
      <ConfirmDialog
        open={scheduleDeleteId !== null}
        title="Delete schedule row"
        message="Remove this planned shipment row?"
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => {
          if (!scheduleDeleteId) return;
          void removeSchedule(scheduleDeleteId);
        }}
        onCancel={() => setScheduleDeleteId(null)}
      />
    </div>
  );
}
