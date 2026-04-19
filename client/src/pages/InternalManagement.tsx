/**
 * Internal Management — Admin only: Audits, Shipments (schedule), Contracts, internal & project history, etc.
 * Command Media (shared /documents library) is on the Admin page.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { apiJson } from '../api/client';
import { parseApiError, downloadWithAuthProgress } from '../utils/apiHelpers';
import { Navigate } from 'react-router-dom';
import { getDefaultPath } from '../config/rolePageAccess';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { MetricCard } from '../components/MetricCard';
import { AdminEmployeeAssignmentsPanel } from './admin/AdminEmployeeAssignmentsPanel';
import { AdminLaborCostsPanel } from './admin/AdminLaborCostsPanel';
import { SortableTh } from '../components/SortableTh';
import { cmpNum, cmpStr, dateMs, toggleSort, type SortDir } from '../utils/tableSort';
import { InternalManagementOrgChart } from './InternalManagementOrgChart';
import { InternalManagementCalendarView } from './InternalManagementCalendar';
import type { InternalManagementTab as ImTab } from './internalManagementTabs';

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
  shipmentMatchPurchaseOrder?: string | null;
  shipmentMatchPartNumber?: string | null;
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
}

interface ManagementAssignmentActiveProject {
  id: string;
  projectCode: string;
  companyName: string;
  clientName: string;
  popStart: string | null;
  popEnd: string | null;
  status: string;
}

interface ManagementAssignmentRow {
  supplier: ProjectHistorySupplier | null;
  activeProjects: ManagementAssignmentActiveProject[];
}

function projectPopToInputDate(iso: string | null | undefined): string {
  if (!iso) return '';
  return iso.slice(0, 10);
}

function formatProjectPopCell(popStart: string | null, popEnd: string | null): string {
  if (!popStart || !popEnd) return '—';
  return `${popStart.slice(0, 10)} – ${popEnd.slice(0, 10)}`;
}

function formatContractProjectCell(r: InternalRow): string {
  if (r.projectHistory) {
    return `${r.projectHistory.projectCode} — ${r.projectHistory.companyName}`;
  }
  return '—';
}

function formatStaffFullName(u: Pick<ProjectHistoryBuyer, 'name' | 'email'> | null | undefined): string {
  if (!u) return '—';
  const n = u.name?.trim();
  return n || u.email;
}

export function InternalManagement() {
  const { token, user } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState<ImTab>('audits');

  const [rows, setRows] = useState<InternalRow[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [auditTypes, setAuditTypes] = useState<AuditTypeOption[]>([]);
  const [schedules, setSchedules] = useState<ScheduleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [contractsProjectId, setContractsProjectId] = useState('');
  const [contractsBuyerId, setContractsBuyerId] = useState('');
  const [contractsEmployeeId, setContractsEmployeeId] = useState('');
  const [contractEmployeeOptions, setContractEmployeeOptions] = useState<ProjectHistoryBuyer[]>([]);
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
    shipmentMatchPurchaseOrder: '',
    shipmentMatchPartNumber: '',
  });
  const [projectEditingId, setProjectEditingId] = useState<string | null>(null);
  const [projectSubmitting, setProjectSubmitting] = useState(false);
  const [projectBusyId, setProjectBusyId] = useState<string | null>(null);
  const [profitRows, setProfitRows] = useState<ProfitRow[]>([]);
  const [managementAssignments, setManagementAssignments] = useState<ManagementAssignmentRow[]>([]);
  const [shipmentSort, setShipmentSort] = useState<{ key: string | null; dir: SortDir }>({ key: null, dir: 'asc' });
  const [contractSort, setContractSort] = useState<{ key: string | null; dir: SortDir }>({ key: null, dir: 'asc' });
  const [projectTableSort, setProjectTableSort] = useState<{ key: string | null; dir: SortDir }>({ key: null, dir: 'asc' });
  const [mgmtAssignSort, setMgmtAssignSort] = useState<{ key: string | null; dir: SortDir }>({ key: null, dir: 'asc' });

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

  const sortedContractRows = useMemo(() => {
    if (!contractSort.key) return rows;
    const { key: k, dir } = contractSort;
    const list = [...rows];
    list.sort((a, b) => {
      switch (k) {
        case 'project':
          return cmpStr(formatContractProjectCell(a), formatContractProjectCell(b), dir);
        case 'buyer':
          return cmpStr(formatStaffFullName(a.buyer), formatStaffFullName(b.buyer), dir);
        case 'employee':
          return cmpStr(formatStaffFullName(a.employee), formatStaffFullName(b.employee), dir);
        case 'name':
          return cmpStr(a.name, b.name, dir);
        case 'type':
          return cmpStr(a.category ?? '', b.category ?? '', dir);
        case 'note':
          return cmpStr((a.note ?? '').trim(), (b.note ?? '').trim(), dir);
        case 'updated':
          return cmpNum(dateMs(a.updatedAt), dateMs(b.updatedAt), dir);
        default:
          return 0;
      }
    });
    return list;
  }, [rows, contractSort]);

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

  const sortedManagementAssignments = useMemo(() => {
    if (!mgmtAssignSort.key) return managementAssignments;
    const { key: k, dir } = mgmtAssignSort;
    const list = [...managementAssignments];
    const supplierLabel = (row: ManagementAssignmentRow) =>
      row.supplier ? `${row.supplier.code} ${row.supplier.name}` : 'No supplier assigned';
    const projectsKey = (row: ManagementAssignmentRow) =>
      [...row.activeProjects].map((p) => p.projectCode).sort().join('\u0001');
    list.sort((a, b) => {
      if (k === 'supplier') return cmpStr(supplierLabel(a), supplierLabel(b), dir);
      if (k === 'projects') return cmpStr(projectsKey(a), projectsKey(b), dir);
      return 0;
    });
    return list;
  }, [managementAssignments, mgmtAssignSort]);

  const projectHistoryRevenueTotal = useMemo(() => {
    return filteredProjectHistories.reduce((sum, r) => {
      const n = r.revenueAmount;
      return sum + (typeof n === 'number' && Number.isFinite(n) ? n : 0);
    }, 0);
  }, [filteredProjectHistories]);

  const projectHistoryRevenueNumericCount = useMemo(
    () =>
      filteredProjectHistories.filter((r) => typeof r.revenueAmount === 'number' && Number.isFinite(r.revenueAmount))
        .length,
    [filteredProjectHistories]
  );

  const profitRowsActive = useMemo(
    () => profitRows.filter((r) => r.status !== 'Inactive'),
    [profitRows]
  );
  const profitRowsInactive = useMemo(
    () => profitRows.filter((r) => r.status === 'Inactive'),
    [profitRows]
  );
  const inactiveProjectsProfitTotal = useMemo(
    () => profitRowsInactive.reduce((sum, r) => sum + r.profit, 0),
    [profitRowsInactive]
  );

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

  const loadContractEmployees = () => {
    if (!token) return;
    apiJson<ProjectHistoryBuyer[]>('/project-history/employees-contractors', { token })
      .then(setContractEmployeeOptions)
      .catch(() => setContractEmployeeOptions([]));
  };

  const loadProfit = () => {
    if (!token) return;
    apiJson<ProfitRow[]>('/project-history/profit-summary', { token })
      .then(setProfitRows)
      .catch(() => setProfitRows([]));
  };

  const loadManagementAssignments = () => {
    if (!token) return;
    apiJson<ManagementAssignmentRow[]>('/project-history/management-assignments', { token })
      .then(setManagementAssignments)
      .catch(() => setManagementAssignments([]));
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
    if (
      !token ||
      !isAdmin ||
      (tab !== 'projectHistory' &&
        tab !== 'profit' &&
        tab !== 'managementAssignments' &&
        tab !== 'contracts')
    )
      return;
    if (tab === 'projectHistory') {
      loadProjectHistories();
      loadProjectHistoryBuyers();
    }
    if (tab === 'profit') loadProfit();
    if (tab === 'managementAssignments') loadManagementAssignments();
    if (tab === 'contracts') {
      loadProjectHistories();
      loadProjectHistoryBuyers();
      loadContractEmployees();
    }
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
      toast.error('File must be 8MB or smaller');
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
      if (options && 'projectHistoryId' in options) {
        setContractsProjectId('');
        setContractsBuyerId('');
        setContractsEmployeeId('');
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
      setUploadProgress(null);
      toast.success('Saved');
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
      toast.error('Supplier and scheduled date are required');
      return;
    }
    let qty: number | null = null;
    if (scheduleForm.qty.trim() !== '') {
      const n = Number(scheduleForm.qty);
      if (!Number.isFinite(n) || n < 0) {
        toast.error('Qty must be a non-negative number');
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
      toast.success('Schedule row added');
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
      toast.success('Removed');
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
      toast.success('Deleted');
      load();
    } catch (e) {
      toast.error(parseApiError(e));
    } finally {
      setDeletingId(null);
    }
  };

  const download = async (r: InternalRow) => {
    if (!token || !r.filePath) {
      toast.error('No file attached');
      return;
    }
    try {
      setDownloading((prev) => ({ ...prev, [r.id]: 0 }));
      await downloadWithAuthProgress(`/internal-docs/${r.id}/download`, token, r.name, (p) => {
        setDownloading((prev) => ({ ...prev, [r.id]: p }));
      });
      toast.success('Download completed');
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
      toast.success(`Audit ${created.code} created`);
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
      shipmentMatchPurchaseOrder: '',
      shipmentMatchPartNumber: '',
    });
  };

  const submitProjectHistory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !clientForm.clientName.trim() || !clientForm.companyName.trim()) {
      toast.error('Client name and company name are required');
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
            shipmentMatchPurchaseOrder: clientForm.shipmentMatchPurchaseOrder.trim() || null,
            shipmentMatchPartNumber: clientForm.shipmentMatchPartNumber.trim() || null,
          }),
        });
        toast.success('Project history updated');
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
            shipmentMatchPurchaseOrder: clientForm.shipmentMatchPurchaseOrder.trim() || null,
            shipmentMatchPartNumber: clientForm.shipmentMatchPartNumber.trim() || null,
          }),
        });
        toast.success('Project history added');
      }
      resetProjectForm();
      loadProjectHistories();
      loadProfit();
      loadManagementAssignments();
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
      shipmentMatchPurchaseOrder: row.shipmentMatchPurchaseOrder ?? '',
      shipmentMatchPartNumber: row.shipmentMatchPartNumber ?? '',
    });
  };

  const deleteProjectHistory = async (id: string) => {
    if (!token) return;
    setProjectBusyId(id);
    try {
      await apiJson(`/project-history/${id}`, { token, method: 'DELETE' });
      toast.success('Removed');
      if (projectEditingId === id) resetProjectForm();
      loadProjectHistories();
      loadProfit();
      loadManagementAssignments();
    } catch (e) {
      toast.error(parseApiError(e));
    } finally {
      setProjectBusyId(null);
    }
  };

  return (
    <div className="page">
      <header className="page-header">
        <h1 className="page-title">Internal Management</h1>
      </header>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {(
          [
            ['audits', 'Audits'],
            ['calendar', 'Calendar'],
            ['orgChart', 'Org Chart'],
            ['shipments', 'Shipments'],
            ['contracts', 'Contracts'],
            ['documents', 'Documents'],
            ['projectHistory', 'Project History'],
            ['managementAssignments', 'Management Assignments'],
            ['profit', 'Profit'],
            ['employeeAssignments', 'Employee Assignments'],
            ['laborCosts', 'Labor Costs'],
          ] as const
        ).map(([t, label]) => (
          <button
            key={t}
            type="button"
            className={tab === t ? 'btn btn-primary' : 'btn btn-ghost'}
            onClick={() => setTab(t)}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <div className="alert-error">{error}</div>}

      {tab === 'orgChart' && <InternalManagementOrgChart onGoToTab={setTab} />}

      {tab === 'calendar' && <InternalManagementCalendarView token={token} />}

      {tab === 'audits' && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div className="card-body">
            <h2 style={{ marginTop: 0 }}>Schedule new audit</h2>
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
                  <label className="input-label">Supplier *</label>
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
                    <option value="">Select</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.code}: {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">Audit date *</label>
                  <input
                    type="date"
                    className="input"
                    value={newAudit.auditDate}
                    onChange={(e) => setNewAudit((p) => ({ ...p, auditDate: e.target.value }))}
                    required
                  />
                </div>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">Audit type</label>
                  <select
                    className="input"
                    value={newAudit.auditTypeId}
                    onChange={(e) => setNewAudit((p) => ({ ...p, auditTypeId: e.target.value }))}
                  >
                    <option value="">—</option>
                    {auditTypes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.code}
                        {t.name ? ` — ${t.name}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">Project</label>
                  <select
                    className="input"
                    value={newAudit.projectHistoryId}
                    onChange={(e) => setNewAudit((p) => ({ ...p, projectHistoryId: e.target.value }))}
                  >
                    <option value="">None</option>
                    {projectsForNewAudit.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.projectCode} — {p.companyName}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">Auditor</label>
                  <input
                    className="input"
                    value={newAudit.auditor}
                    onChange={(e) => setNewAudit((p) => ({ ...p, auditor: e.target.value }))}
                  />
                </div>
              </div>
              <div className="input-group" style={{ marginBottom: '0.75rem' }}>
                <label className="input-label">Summary</label>
                <input
                  className="input"
                  value={newAudit.summary}
                  onChange={(e) => setNewAudit((p) => ({ ...p, summary: e.target.value }))}
                  placeholder="Optional"
                />
              </div>
              <div className="input-group" style={{ marginBottom: '0.75rem' }}>
                <label className="input-label">Scope</label>
                <input
                  className="input"
                  value={newAudit.scope}
                  onChange={(e) => setNewAudit((p) => ({ ...p, scope: e.target.value }))}
                  placeholder="Optional"
                />
              </div>
              <button type="submit" className="btn btn-primary" disabled={submittingAudit}>
                {submittingAudit ? 'Creating…' : 'Create audit'}
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
                          label="Supplier"
                          columnKey="supplier"
                          activeKey={shipmentSort.key}
                          dir={shipmentSort.dir}
                          onSort={(col) => setShipmentSort((p) => toggleSort(p, col))}
                        />
                        <SortableTh
                          label="PO"
                          columnKey="po"
                          activeKey={shipmentSort.key}
                          dir={shipmentSort.dir}
                          onSort={(col) => setShipmentSort((p) => toggleSort(p, col))}
                        />
                        <SortableTh
                          label="Part #"
                          columnKey="part"
                          activeKey={shipmentSort.key}
                          dir={shipmentSort.dir}
                          onSort={(col) => setShipmentSort((p) => toggleSort(p, col))}
                        />
                        <SortableTh
                          label="Qty"
                          columnKey="qty"
                          activeKey={shipmentSort.key}
                          dir={shipmentSort.dir}
                          onSort={(col) => setShipmentSort((p) => toggleSort(p, col))}
                        />
                        <SortableTh
                          label="Scheduled"
                          columnKey="scheduled"
                          activeKey={shipmentSort.key}
                          dir={shipmentSort.dir}
                          onSort={(col) => setShipmentSort((p) => toggleSort(p, col))}
                        />
                        <SortableTh
                          label="Notes"
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
                          <td>{r.scheduledDate ? String(r.scheduledDate).slice(0, 10) : '—'}</td>
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

      {tab === 'contracts' && (
        <>
          <div className="card" style={{ marginBottom: '1rem' }}>
            <div className="card-body">
              <h2 style={{ marginTop: 0 }}>Upload</h2>
              <form
                onSubmit={(e) =>
                  void submit(e, {
                    projectHistoryId: contractsProjectId.trim() ? contractsProjectId.trim() : null,
                    buyerId: contractsBuyerId.trim() ? contractsBuyerId.trim() : null,
                    employeeUserId: contractsEmployeeId.trim() ? contractsEmployeeId.trim() : null,
                  })
                }
              >
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns:
                      'minmax(200px, 1fr) minmax(180px, 1fr) minmax(180px, 1fr) minmax(180px, 1fr) minmax(160px, 1fr) minmax(220px, 1.2fr) minmax(240px, 1.2fr) auto',
                    gap: '0.75rem',
                    alignItems: 'flex-end',
                    paddingBottom: 22,
                  }}
                >
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">Project</label>
                    <select
                      className="input"
                      value={contractsProjectId}
                      onChange={(e) => setContractsProjectId(e.target.value)}
                    >
                      <option value="">None</option>
                      {[...projectHistories]
                        .sort((a, b) => a.projectCode.localeCompare(b.projectCode))
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.projectCode} — {p.companyName}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">Buyer</label>
                    <select
                      className="input"
                      value={contractsBuyerId}
                      onChange={(e) => setContractsBuyerId(e.target.value)}
                    >
                      <option value="">None</option>
                      {buyerOptions.map((b) => (
                        <option key={b.id} value={b.id}>
                          {formatStaffFullName(b)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">Employee</label>
                    <select
                      className="input"
                      value={contractsEmployeeId}
                      onChange={(e) => setContractsEmployeeId(e.target.value)}
                    >
                      <option value="">None</option>
                      {contractEmployeeOptions.map((u) => (
                        <option key={u.id} value={u.id}>
                          {formatStaffFullName(u)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">Name *</label>
                    <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
                  </div>
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">Type</label>
                    <input className="input" value={category} onChange={(e) => setCategory(e.target.value)} />
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
              <h2 style={{ marginTop: 0 }}>Library</h2>
              <div className="table-wrap">
                {loading ? (
                  <p className="table-empty">Loading…</p>
                ) : rows.length === 0 ? (
                  <p className="table-empty">No internal documents.</p>
                ) : (
                  <table className="table">
                    <thead>
                      <tr>
                        <SortableTh
                          label="Project"
                          columnKey="project"
                          activeKey={contractSort.key}
                          dir={contractSort.dir}
                          onSort={(col) => setContractSort((p) => toggleSort(p, col))}
                        />
                        <SortableTh
                          label="Buyer"
                          columnKey="buyer"
                          activeKey={contractSort.key}
                          dir={contractSort.dir}
                          onSort={(col) => setContractSort((p) => toggleSort(p, col))}
                        />
                        <SortableTh
                          label="Employee"
                          columnKey="employee"
                          activeKey={contractSort.key}
                          dir={contractSort.dir}
                          onSort={(col) => setContractSort((p) => toggleSort(p, col))}
                        />
                        <SortableTh
                          label="Name"
                          columnKey="name"
                          activeKey={contractSort.key}
                          dir={contractSort.dir}
                          onSort={(col) => setContractSort((p) => toggleSort(p, col))}
                        />
                        <SortableTh
                          label="Type"
                          columnKey="type"
                          activeKey={contractSort.key}
                          dir={contractSort.dir}
                          onSort={(col) => setContractSort((p) => toggleSort(p, col))}
                        />
                        <SortableTh
                          label="Note"
                          columnKey="note"
                          activeKey={contractSort.key}
                          dir={contractSort.dir}
                          onSort={(col) => setContractSort((p) => toggleSort(p, col))}
                        />
                        <th>View</th>
                        <SortableTh
                          label="Updated"
                          columnKey="updated"
                          activeKey={contractSort.key}
                          dir={contractSort.dir}
                          onSort={(col) => setContractSort((p) => toggleSort(p, col))}
                        />
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {sortedContractRows.map((r) => (
                        <tr key={r.id}>
                          <td>{formatContractProjectCell(r)}</td>
                          <td>{formatStaffFullName(r.buyer)}</td>
                          <td>{formatStaffFullName(r.employee)}</td>
                          <td>{r.name}</td>
                          <td>{r.category ?? '—'}</td>
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
                          <td>{new Date(r.updatedAt).toLocaleString()}</td>
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
              <h2 style={{ marginTop: 0 }}>Library</h2>
              <div className="table-wrap">
                {loading ? (
                  <p className="table-empty">Loading…</p>
                ) : rows.length === 0 ? (
                  <p className="table-empty">No internal documents.</p>
                ) : (
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Note</th>
                        <th>View</th>
                        <th>Updated</th>
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
                          <td>{new Date(r.updatedAt).toLocaleString()}</td>
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
          <div className="card" style={{ marginBottom: '1rem' }}>
            <div className="card-body">
              <h2 style={{ marginTop: 0 }}>{projectEditingId ? 'Edit project' : 'Add project'}</h2>
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
                    <label className="input-label">Shipment match — PO</label>
                    <input
                      className="input"
                      value={clientForm.shipmentMatchPurchaseOrder}
                      onChange={(e) => setClientForm((p) => ({ ...p, shipmentMatchPurchaseOrder: e.target.value }))}
                      placeholder="Match inspection requests (optional)"
                    />
                  </div>
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">Shipment match — part #</label>
                    <input
                      className="input"
                      value={clientForm.shipmentMatchPartNumber}
                      onChange={(e) => setClientForm((p) => ({ ...p, shipmentMatchPartNumber: e.target.value }))}
                      placeholder="With supplier, links shipment to this project"
                    />
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
                  <p
                    style={{
                      gridColumn: '1 / -1',
                      margin: 0,
                      fontSize: 'var(--text-xs)',
                      color: 'var(--color-text-muted)',
                    }}
                  >
                    Status is computed automatically: Active when today (UTC) falls between start and end;
                    otherwise Inactive. Leave both dates empty if there is no POP yet.
                  </p>
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

          <div style={{ width: '100%', maxWidth: '100%', minWidth: 0, marginBottom: '1rem', boxSizing: 'border-box' }}>
            <MetricCard
              title="Total revenue"
              value={projectHistoryRevenueTotal.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
              subtitle={
                projectHistories.length === 0
                  ? 'No projects yet'
                  : (() => {
                      const filteredCount = filteredProjectHistories.length;
                      const base = `${projectHistoryRevenueNumericCount} of ${filteredCount} visible project${
                        filteredCount === 1 ? '' : 's'
                      } with numeric revenue`;
                      if (projectHistoryBuyerFilter || projectHistorySupplierFilter) {
                        return `${base} (${projectHistories.length} total in list)`;
                      }
                      return base;
                    })()
              }
            />
          </div>

          <div className="card">
            <div className="card-body">
              <h2 style={{ marginTop: 0 }}>Project history</h2>
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
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {sortedFilteredProjectHistories.map((r) => (
                        <tr key={r.id}>
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
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {tab === 'managementAssignments' && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div className="card-body">
            <h2 style={{ marginTop: 0 }}>Management Assignments</h2>
            <p
              style={{
                marginTop: 0,
                marginBottom: '0.75rem',
                fontSize: 'var(--text-sm)',
                color: 'var(--color-text-muted)',
              }}
            >
              Every row is one supplier. Each list entry is an active project (Period of Performance includes today, UTC).
              Assign a supplier on each record in Project History.
            </p>
            <div className="table-wrap" style={{ overflowX: 'auto' }}>
              {managementAssignments.length === 0 ? (
                <p className="table-empty">No suppliers with active projects.</p>
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <SortableTh
                        label="Supplier"
                        columnKey="supplier"
                        activeKey={mgmtAssignSort.key}
                        dir={mgmtAssignSort.dir}
                        onSort={(col) => setMgmtAssignSort((p) => toggleSort(p, col))}
                        style={{ minWidth: 200 }}
                      />
                      <SortableTh
                        label="Active projects"
                        columnKey="projects"
                        activeKey={mgmtAssignSort.key}
                        dir={mgmtAssignSort.dir}
                        onSort={(col) => setMgmtAssignSort((p) => toggleSort(p, col))}
                      />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedManagementAssignments.map((row) => (
                      <tr key={row.supplier?.id ?? '__unassigned__'}>
                        <td>{row.supplier ? `${row.supplier.code}: ${row.supplier.name}` : 'No supplier assigned'}</td>
                        <td>
                          <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
                            {row.activeProjects.map((p) => (
                              <li key={p.id} style={{ marginBottom: '0.35rem' }}>
                                {p.projectCode} — {p.companyName} · {p.clientName} · POP {formatProjectPopCell(p.popStart, p.popEnd)}
                              </li>
                            ))}
                          </ul>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === 'profit' && (
        <>
          <div className="card" style={{ marginBottom: '1rem' }}>
            <div className="card-body">
              <h2 style={{ marginTop: 0 }}>Profit by project (Active)</h2>
              <p style={{ marginTop: 0, marginBottom: '0.75rem', fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
                Active projects only so totals are not mixed with completed or inactive work. Costs include labor tied to each project with status{' '}
                <strong>Paid</strong> only (pending or rejected labor lines are not deducted).
              </p>
              <div className="table-wrap" style={{ overflowX: 'auto' }}>
                {profitRows.length === 0 ? (
                  <p className="table-empty">No projects yet.</p>
                ) : profitRowsActive.length === 0 ? (
                  <p className="table-empty">No active projects. See inactive projects below.</p>
                ) : (
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Project</th>
                        <th>Company</th>
                        <th>Revenue</th>
                        <th>Costs</th>
                        <th>Profit</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {profitRowsActive.map((r) => (
                        <tr key={r.projectId}>
                          <td>{r.projectCode}</td>
                          <td>{r.companyName}</td>
                          <td>{r.revenue ?? r.revenueAmount.toFixed(2)}</td>
                          <td>{r.costs.toFixed(2)}</td>
                          <td>{r.profit.toFixed(2)}</td>
                          <td>{r.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: '1rem' }}>
            <div className="card-body">
              <h2 style={{ marginTop: 0 }}>Inactive projects</h2>
              <p style={{ marginTop: 0, marginBottom: '0.75rem', fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
                Same cost rule as above: only <strong>Paid</strong> labor costs reduce profit.
              </p>

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
                  title="Total profit (inactive projects)"
                  value={inactiveProjectsProfitTotal.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                  subtitle={
                    profitRowsInactive.length === 0
                      ? 'No inactive projects'
                      : `${profitRowsInactive.length} inactive project${profitRowsInactive.length === 1 ? '' : 's'}`
                  }
                />
              </div>
              <div className="table-wrap" style={{ overflowX: 'auto' }}>
                {profitRowsInactive.length === 0 ? (
                  <p className="table-empty">No inactive projects.</p>
                ) : (
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Project</th>
                        <th>Company</th>
                        <th>Revenue</th>
                        <th>Costs</th>
                        <th>Profit</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {profitRowsInactive.map((r) => (
                        <tr key={r.projectId}>
                          <td>{r.projectCode}</td>
                          <td>{r.companyName}</td>
                          <td>{r.revenue ?? r.revenueAmount.toFixed(2)}</td>
                          <td>{r.costs.toFixed(2)}</td>
                          <td>{r.profit.toFixed(2)}</td>
                          <td>{r.status}</td>
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

      {tab === 'employeeAssignments' && (
        <div style={{ marginTop: '1rem' }}>
          <AdminEmployeeAssignmentsPanel token={token} toast={toast} />
        </div>
      )}

      {tab === 'laborCosts' && (
        <div style={{ marginTop: '1rem' }}>
          <AdminLaborCostsPanel token={token} listScope="all" />
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
