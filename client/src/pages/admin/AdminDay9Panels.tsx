/**
 * Day 9 Admin: Audit types, Buyers & suppliers; Permissions matrix is Admin → Permissions tab only.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiFetch, apiJson } from '../../api/client';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { MetricCard } from '../../components/MetricCard';
import { ExpandableTableText } from '../../components/ExpandableTableText';
import { SortableTh } from '../../components/SortableTh';
import { downloadTableXlsx, type ExportRow } from '../../utils/exportExcel';
import { formatUsd } from '../../utils/formatUsd';
import {
  type SortDir,
  cmpNum,
  cmpStr,
  dateMs,
  toggleSort,
} from '../../utils/tableSort';

interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

interface AuditTypeRow {
  id: string;
  code: string;
  name: string | null;
}

export function AdminAuditTypesPanel({ token, toast }: { token: string | null; toast: ToastApi }) {
  const [list, setList] = useState<AuditTypeRow[]>([]);
  const [newName, setNewName] = useState('');
  const [edit, setEdit] = useState<AuditTypeRow | null>(null);
  const [del, setDel] = useState<AuditTypeRow | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const r = await apiJson<{ list: AuditTypeRow[] }>('/audit-types', { token });
      setList(r.list);
    } catch {
      setList([]);
      toast.error('Failed to load audit types');
    }
  }, [token, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const add = async () => {
    if (!token) return;
    if (!newName.trim()) {
      toast.error('Name is required');
      return;
    }
    setBusy(true);
    try {
      await apiJson('/audit-types', {
        token,
        method: 'POST',
        body: JSON.stringify({
          name: newName.trim() || null,
        }),
      });
      setNewName('');
      toast.success('Audit type added');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Add failed');
    } finally {
      setBusy(false);
    }
  };

  const saveEdit = async () => {
    if (!token || !edit) return;
    setBusy(true);
    try {
      await apiJson(`/audit-types/${edit.id}`, {
        token,
        method: 'PATCH',
        body: JSON.stringify({ name: edit.name?.trim() || null }),
      });
      setEdit(null);
      toast.success('Updated');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setBusy(false);
    }
  };

  const doDelete = async () => {
    if (!token || !del) return;
    setBusy(true);
    try {
      await apiJson(`/audit-types/${del.id}`, { token, method: 'DELETE' });
      toast.success('Deleted');
      setDel(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card">
      <div className="card-body">
        <h2 style={{ marginTop: 0 }}>Audit types</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.5rem', marginBottom: '1rem' }}>
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label">Name</label>
            <input className="input" value={newName} onChange={(e) => setNewName(e.target.value)} />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button type="button" className="btn btn-primary" onClick={add} disabled={busy}>
              Add
            </button>
          </div>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th style={{ width: 200 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.length === 0 ? (
                <tr>
                  <td colSpan={2} className="table-empty">
                    No audit types.
                  </td>
                </tr>
              ) : (
                list.map((row) => (
                  <tr key={row.id}>
                    <td>
                      {edit?.id === row.id ? (
                        <input className="input" value={edit.name ?? ''} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
                      ) : (
                        row.name ?? '—'
                      )}
                    </td>
                    <td>
                      {edit?.id === row.id ? (
                        <>
                          <button type="button" className="btn btn-primary" style={{ marginRight: 8 }} onClick={saveEdit} disabled={busy}>
                            Save
                          </button>
                          <button type="button" className="btn btn-ghost" onClick={() => setEdit(null)}>
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button type="button" className="btn btn-ghost" style={{ marginRight: 8 }} onClick={() => setEdit({ ...row })}>
                            Edit
                          </button>
                          <button type="button" className="btn btn-ghost" onClick={() => setDel(row)}>
                            Delete
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      <ConfirmDialog
        open={!!del}
        title="Delete audit type?"
        message={del ? `Remove ${del.name ?? del.code}? Audits referencing it must be reassigned first.` : ''}
        confirmLabel="Delete"
        variant="danger"
        onCancel={() => setDel(null)}
        onConfirm={doDelete}
      />
    </div>
  );
}

interface ExpenseRow {
  id: string;
  code: string;
  /** Open amounts count toward Open expense; Admin sets Closed via Close action. */
  status?: string;
  type: string;
  description: string;
  project: string;
  amount: number;
  expenseDate: string;
  paymentMethod: string;
  country: string | null;
  attachmentFilePath: string | null;
  attachmentFileName: string | null;
  attachmentFileMime: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ExpenseCountryOption {
  id: string;
  name: string;
}

function expenseDateInputValue(iso: string | undefined): string {
  if (!iso) return '';
  return iso.slice(0, 10);
}

function todayDateInputValue(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

type ExpenseSortKey =
  | 'code'
  | 'type'
  | 'description'
  | 'project'
  | 'amount'
  | 'expenseDate'
  | 'paymentMethod'
  | 'country';

export function AdminExpensesPanel({
  token,
  toast,
  projectFilter = null,
  fixedTypeProject = null,
  fixedProject = null,
  countryOptionsEndpoint = null,
  hideProject = false,
  openExpenseTracking = false,
  canCloseExpense = false,
}: {
  token: string | null;
  toast: ToastApi;
  /** When set, table and export only include rows with this `project` value (e.g. Global Supply). */
  projectFilter?: string | null;
  /** When set, add form locks Type and Project to these values. */
  fixedTypeProject?: { type: string; project: string } | null;
  /** When set, add form locks Project only, but Type remains editable. */
  fixedProject?: string | null;
  /** Optional endpoint that provides country options as { list: { id, name }[] }. */
  countryOptionsEndpoint?: string | null;
  /** Hide project field/column in contexts where project is fixed and should not be shown. */
  hideProject?: boolean;
  /** Global Supply: show Open expense total, Expense ID column, and Close (Admin-only). */
  openExpenseTracking?: boolean;
  /** Whether the current user may close expenses (typically Admin). */
  canCloseExpense?: boolean;
}) {
  const [list, setList] = useState<ExpenseRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [type, setType] = useState(() => fixedTypeProject?.type ?? '');
  const [description, setDescription] = useState('');
  const [project, setProject] = useState(() => fixedProject ?? fixedTypeProject?.project ?? '');
  const [amount, setAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState(todayDateInputValue);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [country, setCountry] = useState('');
  const [countryOptions, setCountryOptions] = useState<ExpenseCountryOption[]>([]);
  const [addAttachmentFile, setAddAttachmentFile] = useState<File | null>(null);
  const [attachmentBusyId, setAttachmentBusyId] = useState<string | null>(null);
  const [closeBusyId, setCloseBusyId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{
    type: string;
    description: string;
    project: string;
    amount: string;
    expenseDate: string;
    paymentMethod: string;
    country: string;
  }>({
    type: '',
    description: '',
    project: '',
    amount: '',
    expenseDate: '',
    paymentMethod: '',
    country: '',
  });
  const displayedList = useMemo(
    () => (projectFilter ? list.filter((r) => r.project === projectFilter) : list),
    [list, projectFilter]
  );
  const [sort, setSort] = useState<{ key: ExpenseSortKey | null; dir: SortDir }>({
    key: null,
    dir: 'asc',
  });

  const sortedDisplayedList = useMemo(() => {
    const rows = [...displayedList];
    const k = sort.key;
    if (!k) return rows;
    const dir = sort.dir;
    rows.sort((a, b) => {
      let c = 0;
      switch (k) {
        case 'code':
          c = cmpStr(a.code ?? '', b.code ?? '', dir);
          break;
        case 'type':
          c = cmpStr(a.type, b.type, dir);
          break;
        case 'description':
          c = cmpStr(a.description, b.description, dir);
          break;
        case 'project':
          c = cmpStr(a.project, b.project, dir);
          break;
        case 'amount':
          c = cmpNum(a.amount, b.amount, dir);
          break;
        case 'expenseDate':
          c = cmpNum(dateMs(a.expenseDate), dateMs(b.expenseDate), dir);
          break;
        case 'paymentMethod':
          c = cmpStr(a.paymentMethod ?? '', b.paymentMethod ?? '', dir);
          break;
        case 'country':
          c = cmpStr(a.country ?? '', b.country ?? '', dir);
          break;
        default:
          break;
      }
      if (c !== 0) return c;
      return cmpStr(a.id, b.id, 'asc');
    });
    return rows;
  }, [displayedList, sort]);

  const totalExpenses = useMemo(() => displayedList.reduce((sum, item) => sum + item.amount, 0), [displayedList]);
  const openExpenseTotal = useMemo(
    () =>
      openExpenseTracking
        ? displayedList
            .filter((r) => (r.status ?? 'Open') === 'Open')
            .reduce((sum, item) => sum + item.amount, 0)
        : 0,
    [displayedList, openExpenseTracking]
  );

  const expenseTableColSpan = (hideProject ? 8 : 9) + (openExpenseTracking ? 2 : 0);

  useEffect(() => {
    if (fixedTypeProject) {
      setType(fixedTypeProject.type);
      setProject(fixedTypeProject.project);
    }
  }, [fixedTypeProject?.type, fixedTypeProject?.project]);

  useEffect(() => {
    if (fixedProject) {
      setProject(fixedProject);
    }
  }, [fixedProject]);

  useEffect(() => {
    if (!token || !countryOptionsEndpoint) {
      setCountryOptions([]);
      return;
    }
    apiJson<{ list: ExpenseCountryOption[] }>(countryOptionsEndpoint, { token })
      .then((r) => setCountryOptions(r.list))
      .catch(() => setCountryOptions([]));
  }, [countryOptionsEndpoint, token]);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const r = await apiJson<{ list: ExpenseRow[] }>('/expenses', { token });
      setList(r.list);
    } catch {
      setList([]);
      toast.error('Failed to load expenses');
    }
  }, [token, toast]);

  const countryNameOptions = useMemo(() => {
    const names = new Set<string>();
    countryOptions.forEach((option) => {
      const name = option.name.trim();
      if (name) names.add(name);
    });
    list.forEach((row) => {
      const name = (row.country ?? '').trim();
      if (name) names.add(name);
    });
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [countryOptions, list]);

  useEffect(() => {
    load();
  }, [load]);

  const downloadAttachment = async (id: string) => {
    if (!token) return;
    try {
      const r = await apiJson<{ url: string }>(`/expenses/${id}/attachment-url`, { token });
      window.open(r.url, '_blank', 'noopener,noreferrer');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not download');
    }
  };

  const uploadRowAttachment = async (id: string, file: File) => {
    if (!token) return;
    setAttachmentBusyId(id);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await apiFetch(`/expenses/${id}/attachment`, {
        token,
        method: 'POST',
        body: form,
      });
      if (!res.ok) {
        const text = await res.text();
        let msg = 'Upload failed';
        try {
          const j = JSON.parse(text) as { error?: string };
          if (j.error) msg = j.error;
        } catch {
          if (text) msg = text;
        }
        throw new Error(msg);
      }
      toast.success('Attachment uploaded');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setAttachmentBusyId(null);
    }
  };

  const removeAttachment = async (id: string) => {
    if (!token) return;
    setAttachmentBusyId(id);
    try {
      await apiJson(`/expenses/${id}/attachment`, { token, method: 'DELETE' });
      toast.success('Attachment removed');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not remove attachment');
    } finally {
      setAttachmentBusyId(null);
    }
  };

  const closeExpense = async (id: string) => {
    if (!token || !canCloseExpense) return;
    setCloseBusyId(id);
    try {
      await apiJson(`/expenses/${id}`, {
        token,
        method: 'PATCH',
        body: JSON.stringify({ status: 'Closed' }),
      });
      toast.success('Expense closed');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not close expense');
    } finally {
      setCloseBusyId(null);
    }
  };

  const add = async () => {
    if (!token) return;
    const amountNum = Number(amount);
    const typeVal = (fixedTypeProject ? fixedTypeProject.type : type).trim();
    const projectVal = (fixedProject ?? (fixedTypeProject ? fixedTypeProject.project : project)).trim();
    if (!typeVal || !description.trim() || !projectVal || !Number.isFinite(amountNum) || !expenseDate.trim()) {
      toast.error('Type, description, project, expense date, and amount are required');
      return;
    }
    setBusy(true);
    try {
      const created = await apiJson<ExpenseRow>('/expenses', {
        token,
        method: 'POST',
        body: JSON.stringify({
          type: typeVal,
          description: description.trim(),
          project: projectVal,
          amount: amountNum,
          expenseDate,
          paymentMethod: paymentMethod.trim(),
          country: country.trim() || null,
        }),
      });
      if (addAttachmentFile) {
        const form = new FormData();
        form.append('file', addAttachmentFile);
        const res = await apiFetch(`/expenses/${created.id}/attachment`, {
          token,
          method: 'POST',
          body: form,
        });
        if (!res.ok) {
          const text = await res.text();
          let msg = 'Expense saved but attachment upload failed';
          try {
            const j = JSON.parse(text) as { error?: string };
            if (j.error) msg = j.error;
          } catch {
            if (text) msg = text;
          }
          toast.error(msg);
          await load();
          if (fixedTypeProject) {
            setType(fixedTypeProject.type);
            setProject(fixedTypeProject.project);
          } else if (fixedProject) {
            setType('');
            setProject(fixedProject);
          } else {
            setType('');
            setProject('');
          }
          setDescription('');
          setAmount('');
          setExpenseDate(todayDateInputValue());
          setPaymentMethod('');
          setCountry('');
          setAddAttachmentFile(null);
          return;
        }
      }
      if (fixedTypeProject) {
        setType(fixedTypeProject.type);
        setProject(fixedTypeProject.project);
      } else if (fixedProject) {
        setType('');
        setProject(fixedProject);
      } else {
        setType('');
        setProject('');
      }
      setDescription('');
      setAmount('');
      setExpenseDate(todayDateInputValue());
      setPaymentMethod('');
      setCountry('');
      setAddAttachmentFile(null);
      toast.success('Expense added');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to add expense');
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (row: ExpenseRow) => {
    setEditId(row.id);
    setEditDraft({
      type: row.type,
      description: row.description,
      project: row.project,
      amount: String(row.amount),
      expenseDate: expenseDateInputValue(row.expenseDate),
      paymentMethod: row.paymentMethod ?? '',
      country: row.country ?? '',
    });
  };

  const saveEdit = async () => {
    if (!token || !editId) return;
    const amountNum = Number(editDraft.amount);
    if (
      !editDraft.type.trim() ||
      !editDraft.description.trim() ||
      !editDraft.project.trim() ||
      !Number.isFinite(amountNum) ||
      !editDraft.expenseDate.trim()
    ) {
      toast.error('Type, description, project, expense date, and amount are required');
      return;
    }
    setBusy(true);
    try {
      await apiJson(`/expenses/${editId}`, {
        token,
        method: 'PATCH',
        body: JSON.stringify({
          type: editDraft.type.trim(),
          description: editDraft.description.trim(),
          project: editDraft.project.trim(),
          amount: amountNum,
          expenseDate: editDraft.expenseDate,
          paymentMethod: editDraft.paymentMethod.trim(),
          country: editDraft.country.trim() || null,
        }),
      });
      setEditId(null);
      toast.success('Expense updated');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update expense');
    } finally {
      setBusy(false);
    }
  };

  const exportExcel = () => {
    if (sortedDisplayedList.length === 0) {
      toast.info('No expenses to export');
      return;
    }
    const rows: ExportRow[] = sortedDisplayedList.map((r) => ({
      ...(openExpenseTracking
        ? {
            'Expense ID': r.code ?? '',
            Status: r.status ?? 'Open',
          }
        : {}),
      Type: r.type,
      Description: r.description,
      Project: r.project,
      Amount: r.amount,
      'Expense date': r.expenseDate ? new Date(r.expenseDate).toLocaleDateString() : '',
      'Payment method': r.paymentMethod ?? '',
      Country: r.country ?? '',
      Attachment: r.attachmentFileName ?? '',
      Recorded: new Date(r.createdAt).toLocaleString(),
    }));
    downloadTableXlsx('expenses', 'Expenses', rows);
    toast.success('Exported expenses');
  };

  const onSortColumn = (columnKey: string) => {
    setSort((prev) => toggleSort(prev, columnKey as ExpenseSortKey));
  };

  return (
    <div className="card">
      <div className="card-body">
        <h2 style={{ marginTop: 0 }}>Expenses</h2>
        <div
          className="dashboard-metric-grid"
          style={{
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            marginBottom: '0.75rem',
          }}
        >
          <MetricCard
            title="Total Expenses"
            value={openExpenseTracking ? formatUsd(totalExpenses) : totalExpenses.toFixed(2)}
          />
          {openExpenseTracking ? <MetricCard title="Open Expense" value={formatUsd(openExpenseTotal)} /> : null}
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: '0.6rem',
            marginBottom: '1rem',
          }}
        >
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label">Type</label>
            <input
              className="input"
              value={type}
              onChange={(e) => setType(e.target.value)}
              disabled={!!fixedTypeProject}
            />
          </div>
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label">Description</label>
            <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          {!hideProject && (
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label">Project</label>
              <input
                className="input"
                value={project}
                onChange={(e) => setProject(e.target.value)}
                disabled={!!fixedTypeProject || !!fixedProject}
              />
            </div>
          )}
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label">Amount</label>
            <input className="input" type="number" step={0.01} value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label">Expense date</label>
            <input
              className="input"
              type="date"
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
            />
          </div>
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label">Payment method</label>
            <input
              className="input"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              placeholder="e.g. Card, Wire transfer"
            />
          </div>
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label">Country</label>
            <input
              className="input"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              list={countryOptionsEndpoint ? 'expense-country-options' : undefined}
              placeholder={countryOptionsEndpoint ? 'Select or type country' : undefined}
            />
            {countryOptionsEndpoint ? (
              <datalist id="expense-country-options">
                {countryNameOptions.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            ) : null}
          </div>
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label">Attachment</label>
            <input
              className="input"
              type="file"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                setAddAttachmentFile(f);
              }}
            />
            {addAttachmentFile ? (
              <span
                style={{
                  display: 'block',
                  marginTop: 4,
                  fontSize: 'var(--text-xs)',
                  color: 'var(--color-text-muted)',
                }}
              >
                {addAttachmentFile.name}
              </span>
            ) : null}
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
            <button type="button" className="btn btn-primary" onClick={add} disabled={busy}>
              Add
            </button>
            <button type="button" className="btn btn-ghost" onClick={exportExcel}>
              Export Excel
            </button>
          </div>
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                {openExpenseTracking && (
                  <SortableTh
                    label="Expense ID"
                    columnKey="code"
                    activeKey={sort.key}
                    dir={sort.dir}
                    onSort={onSortColumn}
                  />
                )}
                <SortableTh
                  label="Type"
                  columnKey="type"
                  activeKey={sort.key}
                  dir={sort.dir}
                  onSort={onSortColumn}
                />
                <SortableTh
                  label="Description"
                  columnKey="description"
                  activeKey={sort.key}
                  dir={sort.dir}
                  onSort={onSortColumn}
                />
                {!hideProject && (
                  <SortableTh
                    label="Project"
                    columnKey="project"
                    activeKey={sort.key}
                    dir={sort.dir}
                    onSort={onSortColumn}
                  />
                )}
                <SortableTh
                  label="Amount"
                  columnKey="amount"
                  activeKey={sort.key}
                  dir={sort.dir}
                  onSort={onSortColumn}
                />
                <SortableTh
                  label="Expense date"
                  columnKey="expenseDate"
                  activeKey={sort.key}
                  dir={sort.dir}
                  onSort={onSortColumn}
                />
                <SortableTh
                  label="Payment method"
                  columnKey="paymentMethod"
                  activeKey={sort.key}
                  dir={sort.dir}
                  onSort={onSortColumn}
                />
                <SortableTh
                  label="Country"
                  columnKey="country"
                  activeKey={sort.key}
                  dir={sort.dir}
                  onSort={onSortColumn}
                />
                <th style={{ minWidth: 200 }}>Attachment</th>
                {openExpenseTracking && <th style={{ width: 120 }}>Close</th>}
                <th style={{ width: 170 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedDisplayedList.length === 0 ? (
                <tr>
                  <td colSpan={expenseTableColSpan} className="table-empty">
                    {projectFilter ? 'No expenses for this project yet.' : 'No expenses yet.'}
                  </td>
                </tr>
              ) : (
                sortedDisplayedList.map((row) => (
                  <tr key={row.id}>
                    {openExpenseTracking && (
                      <td style={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{row.code ?? '—'}</td>
                    )}
                    <td>
                      {editId === row.id ? (
                        <input
                          className="input"
                          value={editDraft.type}
                          onChange={(e) => setEditDraft((d) => ({ ...d, type: e.target.value }))}
                          disabled={!!fixedTypeProject}
                        />
                      ) : (
                        row.type
                      )}
                    </td>
                    <td style={{ maxWidth: 260, verticalAlign: 'top' }}>
                      {editId === row.id ? (
                        <input
                          className="input"
                          value={editDraft.description}
                          onChange={(e) => setEditDraft((d) => ({ ...d, description: e.target.value }))}
                        />
                      ) : (
                        <ExpandableTableText
                          value={row.description}
                          modalTitle={
                            row.code?.trim()
                              ? `Description — ${row.code}`
                              : 'Expense description'
                          }
                        />
                      )}
                    </td>
                    {!hideProject && (
                      <td>
                        {editId === row.id ? (
                          <input
                            className="input"
                            value={editDraft.project}
                            onChange={(e) => setEditDraft((d) => ({ ...d, project: e.target.value }))}
                            disabled={!!fixedTypeProject || !!fixedProject}
                          />
                        ) : (
                          row.project
                        )}
                      </td>
                    )}
                    <td>
                      {editId === row.id ? (
                        <input
                          className="input"
                          type="number"
                          step={0.01}
                          value={editDraft.amount}
                          onChange={(e) => setEditDraft((d) => ({ ...d, amount: e.target.value }))}
                        />
                      ) : (
                        row.amount.toFixed(2)
                      )}
                    </td>
                    <td>
                      {editId === row.id ? (
                        <input
                          className="input"
                          type="date"
                          value={editDraft.expenseDate}
                          onChange={(e) => setEditDraft((d) => ({ ...d, expenseDate: e.target.value }))}
                        />
                      ) : row.expenseDate ? (
                        new Date(row.expenseDate).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      {editId === row.id ? (
                        <input
                          className="input"
                          value={editDraft.paymentMethod}
                          onChange={(e) => setEditDraft((d) => ({ ...d, paymentMethod: e.target.value }))}
                          placeholder="Payment method"
                        />
                      ) : (
                        row.paymentMethod || '—'
                      )}
                    </td>
                    <td>
                      {editId === row.id ? (
                        <input
                          className="input"
                          value={editDraft.country}
                          onChange={(e) => setEditDraft((d) => ({ ...d, country: e.target.value }))}
                          list={countryOptionsEndpoint ? 'expense-country-options' : undefined}
                          placeholder={countryOptionsEndpoint ? 'Select or type country' : undefined}
                        />
                      ) : (
                        row.country || '—'
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
                        {row.attachmentFileName && row.attachmentFilePath ? (
                          <>
                            <button
                              type="button"
                              className="btn btn-xs btn-ghost"
                              style={{ paddingLeft: 0, textAlign: 'left' }}
                              onClick={() => void downloadAttachment(row.id)}
                              disabled={attachmentBusyId === row.id}
                            >
                              {row.attachmentFileName}
                            </button>
                            <button
                              type="button"
                              className="btn btn-xs btn-ghost"
                              onClick={() => void removeAttachment(row.id)}
                              disabled={attachmentBusyId === row.id || editId === row.id}
                            >
                              Remove file
                            </button>
                          </>
                        ) : (
                          <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>—</span>
                        )}
                        <label className="btn btn-xs">
                          {row.attachmentFileName ? 'Replace file' : 'Upload file'}
                          <input
                            type="file"
                            style={{ display: 'none' }}
                            disabled={attachmentBusyId === row.id || editId === row.id}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) void uploadRowAttachment(row.id, file);
                              e.target.value = '';
                            }}
                          />
                        </label>
                      </div>
                    </td>
                    {openExpenseTracking && (
                      <td>
                        {(row.status ?? 'Open') === 'Closed' ? (
                          <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>Closed</span>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-xs btn-primary"
                            disabled={
                              !canCloseExpense || closeBusyId === row.id || editId === row.id || busy || attachmentBusyId === row.id
                            }
                            title={!canCloseExpense ? 'Only administrators can close expenses' : undefined}
                            onClick={() => void closeExpense(row.id)}
                          >
                            {closeBusyId === row.id ? '…' : 'Close'}
                          </button>
                        )}
                      </td>
                    )}
                    <td>
                      {editId === row.id ? (
                        <>
                          <button type="button" className="btn btn-primary" style={{ marginRight: 8 }} onClick={saveEdit} disabled={busy}>
                            Save
                          </button>
                          <button type="button" className="btn btn-ghost" onClick={() => setEditId(null)}>
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button type="button" className="btn btn-ghost" onClick={() => startEdit(row)}>
                          Edit
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

interface UserRow {
  id: string;
  email: string;
  name: string | null;
  isEmployee?: boolean;
  isContractor?: boolean;
  employmentStatus?: 'Active' | 'Inactive';
  hourlyRate?: number | null;
  currency?: string | null;
  country?: string | null;
  roleNames: string[];
  passwordPlain: string | null;
  assignedSupplierIds: string[];
  qeAssignedSupplierIds?: string[];
  supplier?: { id: string; code: string; name: string };
}

interface CommodityTypeRow {
  id: string;
  name: string;
}

interface SupplierRow {
  id: string;
  code: string;
  name: string;
  city: string | null;
  country: string | null;
  status: 'Active' | 'Inactive';
  notes: string | null;
  commodityTypeId: string | null;
  commodityType: { id: string; name: string } | null;
  userId?: string | null;
  user?: { id: string; email: string; name: string | null } | null;
  latitude?: number | null;
  longitude?: number | null;
}

const USER_ROLE_OPTIONS = ['Admin', 'Buyer', 'Supplier', 'Viewer', 'QualityEngineer', 'QualityManager', 'Auditor'] as const;

/** Preferred order for Global Supply Admin → Users role dropdown (must exist in DB). */
const GLOBAL_SUPPLY_ROLE_PREFERRED_ORDER = ['Admin', 'Buyer', 'CommodityBuyer', 'Farmer'] as const;
const GLOBAL_SUPPLY_PREFERRED_ROLE_SET = new Set<string>(GLOBAL_SUPPLY_ROLE_PREFERRED_ORDER);

/** Never offer these in Global Supply role picks (Auditor / Inspector are SSA workflows). */
const GLOBAL_SUPPLY_ROLE_EXCLUSIONS = new Set(['Auditor', 'Inspector']);

/** SSA-only accounts are omitted from the Global Supply Users table (Supplier / QE / QM / Auditor / Inspector). */
const SENTINEL_SUPPLIER_ASSURANCE_ACCOUNT_ROLES = new Set([
  'Supplier',
  'QualityEngineer',
  'QualityManager',
  'Auditor',
  'Inspector',
]);

function isSentinelSupplierAssuranceOnlyAccount(roleNames: string[]): boolean {
  if (roleNames.length === 0) return false;
  return roleNames.every((r) => SENTINEL_SUPPLIER_ASSURANCE_ACCOUNT_ROLES.has(r));
}

/** Roles that belong to main SSA workflows — excluded from GS dropdown so GS admins assign GS roles only. */
const ROLES_EXCLUDED_FROM_GLOBAL_SUPPLY_DROPDOWN = new Set([
  ...GLOBAL_SUPPLY_ROLE_EXCLUSIONS,
  'Supplier',
  'QualityEngineer',
  'QualityManager',
]);

/** Role rows omitted from Global Supply Admin → Permissions matrix (main SSA roles). */
const PERMISSION_MATRIX_GLOBAL_SUPPLY_HIDE_ROLES = new Set([
  'QualityEngineer',
  'QualityManager',
  'Supplier',
  'Viewer',
]);

/** Role rows omitted from main Admin → Permissions matrix (Global Supply product roles). */
const PERMISSION_MATRIX_SENTINEL_HIDE_ROLES = new Set(['Farmer', 'CommodityBuyer']);

function formatUserRoleLabel(roleName: string): string {
  if (roleName === 'QualityEngineer') return 'Quality Engineer';
  if (roleName === 'QualityManager') return 'Quality Manager';
  if (roleName === 'CommodityBuyer') return 'Commodity buyer';
  if (roleName === 'Farmer') return 'Farmer';
  return roleName;
}

/** Buyer dropdown / tables: show profile name and login email (username). */
function formatBuyerDisplayLabel(b: Pick<UserRow, 'name' | 'email'>): string {
  const displayName = b.name?.trim();
  if (displayName) return `${displayName} — ${b.email}`;
  return b.email;
}

interface PermissionPageDef {
  key: string;
  label: string;
  path: string;
}

interface PermissionMatrixResponse {
  apiPageRoles: Record<string, string[]>;
  pages: PermissionPageDef[];
  roles: string[];
  matrix: Record<string, Record<string, boolean>>;
  adminOnlyDeletes: Array<{ entity: string; method: string; path: string }>;
}

export function AdminBuyersSuppliersPanel({
  token,
  toast,
  showCreateUser = true,
  showUsersTable = true,
  showBuyerSupplierSections = true,
  usersOnlyEmployees = false,
  usersTableTitle = 'Users',
  globalSupplyUsersMode = false,
}: {
  token: string | null;
  toast: ToastApi;
  showCreateUser?: boolean;
  showUsersTable?: boolean;
  showBuyerSupplierSections?: boolean;
  usersOnlyEmployees?: boolean;
  usersTableTitle?: string;
  /** Lighter Users tab for Global Supply admin: slim create form; no SSA-only users; no Permissions column. */
  globalSupplyUsersMode?: boolean;
}) {
  const { user: authUser } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
  const [buyerId, setBuyerId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [supplierLinkSupplierId, setSupplierLinkSupplierId] = useState('');
  const [supplierLinkUserId, setSupplierLinkUserId] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserFirstName, setNewUserFirstName] = useState('');
  const [newUserLastName, setNewUserLastName] = useState('');
  const [newUserRole, setNewUserRole] = useState<string>('Viewer');
  const [newUserIsEmployee, setNewUserIsEmployee] = useState<'Yes' | 'No' | 'Contractor'>('No');
  const [newUserEmploymentStatus, setNewUserEmploymentStatus] = useState<'Active' | 'Inactive'>('Active');
  const [newUserHourlyRate, setNewUserHourlyRate] = useState('');
  const [newUserCountry, setNewUserCountry] = useState('');
  /** Role names from server (includes custom roles); matrix UI lives only on Permissions tab. */
  const [availableRoles, setAvailableRoles] = useState<string[]>([]);
  const [newSupName, setNewSupName] = useState('');
  const [newSupCity, setNewSupCity] = useState('');
  const [newSupCountry, setNewSupCountry] = useState('');
  const [newSupStatus, setNewSupStatus] = useState<'Active' | 'Inactive'>('Active');
  const [newSupNotes, setNewSupNotes] = useState('');
  const [newSupCommodityTypeId, setNewSupCommodityTypeId] = useState('');
  const [newSupLatitude, setNewSupLatitude] = useState('');
  const [newSupLongitude, setNewSupLongitude] = useState('');
  const [commodityTypes, setCommodityTypes] = useState<CommodityTypeRow[]>([]);
  const [editSup, setEditSup] = useState<SupplierRow | null>(null);
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [editUserPassword, setEditUserPassword] = useState('');
  const [delSup, setDelSup] = useState<SupplierRow | null>(null);
  const [delUser, setDelUser] = useState<UserRow | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [u, pm] = await Promise.all([
        apiJson<UserRow[]>('/users', { token }),
        apiJson<PermissionMatrixResponse>('/users/permission-matrix', { token }).catch(() => null),
      ]);
      setUsers(u);
      if (pm) {
        setAvailableRoles(pm.roles ?? []);
      } else {
        setAvailableRoles([...USER_ROLE_OPTIONS]);
      }
      if (showBuyerSupplierSections) {
        const [s, ct] = await Promise.all([
          apiJson<SupplierRow[]>('/suppliers', { token }),
          apiJson<{ list: CommodityTypeRow[] }>('/commodity-types', { token }).catch(() => ({ list: [] as CommodityTypeRow[] })),
        ]);
        setSuppliers(s);
        setCommodityTypes(ct.list);
      } else {
        setSuppliers([]);
        setCommodityTypes([]);
      }
    } catch {
      toast.error('Failed to load users/suppliers');
    }
  }, [token, toast, showBuyerSupplierSections]);

  useEffect(() => {
    load();
  }, [load]);

  const buyers = users.filter((u) => u.roleNames.includes('Buyer'));
  const supplierUsers = users.filter((u) => u.roleNames.includes('Supplier'));
  const availableRoleOptions = availableRoles.length > 0 ? availableRoles : [...USER_ROLE_OPTIONS];

  const serverRoleSet = useMemo(
    () => new Set(availableRoles.length > 0 ? availableRoles : [...USER_ROLE_OPTIONS]),
    [availableRoles]
  );

  const visibleUsers = useMemo(() => {
    let list = usersOnlyEmployees
      ? users.filter((u) => Boolean(u.isEmployee) || Boolean(u.isContractor))
      : users;
    if (globalSupplyUsersMode) {
      list = list.filter((u) => !isSentinelSupplierAssuranceOnlyAccount(u.roleNames));
    }
    return list;
  }, [users, usersOnlyEmployees, globalSupplyUsersMode]);

  /** Create-user / edit role dropdown: Global Supply roles from server, ordered; no Auditor/Inspector or main SSA workflow roles. */
  const globalSupplyCreateRoleOptions = useMemo(() => {
    if (!globalSupplyUsersMode) return availableRoleOptions;
    const preferred = GLOBAL_SUPPLY_ROLE_PREFERRED_ORDER.filter(
      (r) => serverRoleSet.has(r) && !ROLES_EXCLUDED_FROM_GLOBAL_SUPPLY_DROPDOWN.has(r)
    );
    const rest = availableRoles.filter(
      (r) => !ROLES_EXCLUDED_FROM_GLOBAL_SUPPLY_DROPDOWN.has(r) && !GLOBAL_SUPPLY_PREFERRED_ROLE_SET.has(r)
    );
    rest.sort((a, b) => a.localeCompare(b));
    const combined = [...preferred, ...rest];
    return combined.length > 0 ? combined : ['Buyer'];
  }, [globalSupplyUsersMode, availableRoleOptions, availableRoles, serverRoleSet]);

  /** Table role edit: GS options plus the user’s current role(s) if missing (keeps select valid). */
  const roleOptionsForUserTable = useMemo(() => {
    if (!globalSupplyUsersMode) return availableRoleOptions;
    const selectable = new Set(globalSupplyCreateRoleOptions);
    const extras =
      editUser?.roleNames.filter(
        (r) => !selectable.has(r) && !ROLES_EXCLUDED_FROM_GLOBAL_SUPPLY_DROPDOWN.has(r)
      ) ?? [];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const r of [...globalSupplyCreateRoleOptions, ...extras]) {
      if (seen.has(r)) continue;
      seen.add(r);
      out.push(r);
    }
    return out.length > 0 ? out : [...globalSupplyCreateRoleOptions];
  }, [globalSupplyUsersMode, availableRoleOptions, globalSupplyCreateRoleOptions, editUser?.roleNames, editUser?.id]);

  useEffect(() => {
    if (!globalSupplyUsersMode) return;
    setNewUserRole((prev) => (globalSupplyCreateRoleOptions.includes(prev) ? prev : globalSupplyCreateRoleOptions[0] ?? 'Buyer'));
  }, [globalSupplyUsersMode, globalSupplyCreateRoleOptions]);

  const employeeContractorStats = useMemo(() => {
    if (!usersOnlyEmployees) return null;
    const pool = users.filter((u) => Boolean(u.isEmployee) || Boolean(u.isContractor));
    const isActive = (u: UserRow) => (u.employmentStatus ?? 'Active') === 'Active';
    const employees = pool.filter((u) => u.isEmployee === true);
    const contractors = pool.filter((u) => u.isContractor === true);
    const activeEmployees = employees.filter(isActive).length;
    const activeContractors = contractors.filter(isActive).length;
    return {
      totalEmployees: employees.length,
      totalContractors: contractors.length,
      activeEmployees,
      activeContractors,
    };
  }, [users, usersOnlyEmployees]);

  const userTableColSpan = useMemo(() => {
    if (globalSupplyUsersMode) return 7;
    if (usersOnlyEmployees) return 9;
    return 6;
  }, [globalSupplyUsersMode, usersOnlyEmployees]);

  const assign = async () => {
    if (!token || !buyerId || !supplierId) return;
    setBusy(true);
    try {
      await apiJson('/buyer-suppliers', {
        token,
        method: 'POST',
        body: JSON.stringify({ buyerId, supplierId }),
      });
      toast.success('Assignment created');
      setSupplierId('');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Assign failed');
    } finally {
      setBusy(false);
    }
  };

  const unassign = async (bId: string, sId: string) => {
    if (!token) return;
    setBusy(true);
    try {
      await apiJson(`/buyer-suppliers/${bId}/${sId}`, { token, method: 'DELETE' });
      toast.info('Unassigned');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  const linkSupplierUser = async () => {
    if (!token || !supplierLinkSupplierId || !supplierLinkUserId) return;
    setBusy(true);
    try {
      await apiJson(`/suppliers/${supplierLinkSupplierId}/link-user`, {
        token,
        method: 'POST',
        body: JSON.stringify({ userId: supplierLinkUserId }),
      });
      toast.success('Supplier user linked');
      setSupplierLinkSupplierId('');
      setSupplierLinkUserId('');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Link failed');
    } finally {
      setBusy(false);
    }
  };

  const unlinkSupplierUser = async (supplierIdToUnlink: string) => {
    if (!token) return;
    setBusy(true);
    try {
      await apiJson(`/suppliers/${supplierIdToUnlink}/link-user`, {
        token,
        method: 'DELETE',
      });
      toast.info('Supplier user unlinked');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Unlink failed');
    } finally {
      setBusy(false);
    }
  };

  const createUser = async () => {
    if (!token || !newUserEmail.trim() || !newUserPassword) return;
    const roleNames = [newUserRole];
    setBusy(true);
    try {
      await apiJson('/users', {
        token,
        method: 'POST',
        body: JSON.stringify({
          firstName: newUserFirstName.trim(),
          lastName: newUserLastName.trim(),
          email: newUserEmail.trim(),
          password: newUserPassword,
          isEmployee: newUserIsEmployee === 'Yes',
          isContractor: newUserIsEmployee === 'Contractor',
          ...(globalSupplyUsersMode
            ? {
                employmentStatus: 'Active',
                hourlyRate: null,
                currency: null,
              }
            : {
                employmentStatus: newUserEmploymentStatus,
                hourlyRate: newUserHourlyRate.trim() === '' ? null : Number(newUserHourlyRate),
                currency: newUserHourlyRate.trim() === '' ? null : 'USD',
              }),
          country: newUserCountry.trim() || null,
          roleNames,
        }),
      });
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserFirstName('');
      setNewUserLastName('');
      setNewUserRole('Viewer');
      setNewUserIsEmployee('No');
      setNewUserEmploymentStatus('Active');
      setNewUserHourlyRate('');
      setNewUserCountry('');
      toast.success('User created');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Create user failed');
    } finally {
      setBusy(false);
    }
  };

  const createSupplier = async () => {
    if (!token || !newSupName.trim()) return;
    setBusy(true);
    try {
      await apiJson('/suppliers', {
        token,
        method: 'POST',
        body: JSON.stringify({
          name: newSupName.trim(),
          city: newSupCity.trim() || null,
          country: newSupCountry.trim() || null,
          status: newSupStatus,
          notes: newSupNotes.trim() || null,
          latitude: newSupLatitude.trim() === '' ? null : Number(newSupLatitude),
          longitude: newSupLongitude.trim() === '' ? null : Number(newSupLongitude),
          commodityTypeId: newSupCommodityTypeId.trim() ? newSupCommodityTypeId.trim() : null,
        }),
      });
      setNewSupName('');
      setNewSupCity('');
      setNewSupCountry('');
      setNewSupStatus('Active');
      setNewSupNotes('');
      setNewSupCommodityTypeId('');
      setNewSupLatitude('');
      setNewSupLongitude('');
      toast.success('Supplier created');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Create failed');
    } finally {
      setBusy(false);
    }
  };

  const saveSupplierEdit = async () => {
    if (!token || !editSup) return;
    setBusy(true);
    try {
      await apiJson(`/suppliers/${editSup.id}`, {
        token,
        method: 'PATCH',
        body: JSON.stringify({
          name: editSup.name.trim(),
          city: editSup.city?.trim() || null,
          country: editSup.country?.trim() || null,
          latitude:
            editSup.latitude === null || editSup.latitude === undefined
              ? null
              : Number(editSup.latitude),
          longitude:
            editSup.longitude === null || editSup.longitude === undefined
              ? null
              : Number(editSup.longitude),
          status: editSup.status,
          notes: editSup.notes?.trim() || null,
          commodityTypeId: editSup.commodityTypeId,
        }),
      });
      setEditSup(null);
      toast.success('Supplier updated');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setBusy(false);
    }
  };

  const saveUserEdit = async () => {
    if (!token || !editUser) return;
    setBusy(true);
    try {
      await apiJson(`/users/${editUser.id}`, {
        token,
        method: 'PATCH',
        body: JSON.stringify({
          name: editUser.name?.trim() || null,
          email: editUser.email.trim(),
          isEmployee: Boolean(editUser.isEmployee),
          isContractor: Boolean(editUser.isContractor),
          employmentStatus: editUser.employmentStatus ?? 'Active',
          hourlyRate:
            editUser.hourlyRate === null || editUser.hourlyRate === undefined
              ? null
              : Number(editUser.hourlyRate),
          currency: globalSupplyUsersMode
            ? editUser.currency?.trim() || null
            : editUser.hourlyRate != null && Number.isFinite(Number(editUser.hourlyRate))
              ? 'USD'
              : null,
          country: editUser.country?.trim() || null,
          roleNames: editUser.roleNames,
          ...(editUserPassword.trim() ? { password: editUserPassword } : {}),
        }),
      });
      setEditUser(null);
      setEditUserPassword('');
      toast.success('User updated');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setBusy(false);
    }
  };

  const doDeleteSupplier = async () => {
    if (!token || !delSup) return;
    const target = delSup;
    setBusy(true);
    setDelSup(null);
    try {
      await apiJson(`/suppliers/${target.id}`, { token, method: 'DELETE' });
      toast.success('Supplier deleted');
      await load();
    } catch (e) {
      setDelSup(target);
      toast.error(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setBusy(false);
    }
  };

  const doDeleteUser = async () => {
    if (!token || !delUser) return;
    const target = delUser;
    setBusy(true);
    setDelUser(null);
    try {
      await apiJson(`/users/${target.id}`, { token, method: 'DELETE' });
      toast.success('User deleted');
      if (editUser?.id === target.id) {
        setEditUser(null);
        setEditUserPassword('');
      }
      await load();
    } catch (e) {
      setDelUser(target);
      let msg = 'Delete failed';
      if (e instanceof Error) {
        try {
          const j = JSON.parse(e.message) as { error?: string };
          if (j.error) msg = j.error;
          else msg = e.message;
        } catch {
          msg = e.message || msg;
        }
      }
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      {showCreateUser && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div className="card-body">
            <h2 style={{ marginTop: 0 }}>Create user</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.5rem' }}>
              <div className="input-group">
                <label className="input-label">First Name</label>
                <input className="input" value={newUserFirstName} onChange={(e) => setNewUserFirstName(e.target.value)} />
              </div>
              <div className="input-group">
                <label className="input-label">Last Name</label>
                <input className="input" value={newUserLastName} onChange={(e) => setNewUserLastName(e.target.value)} />
              </div>
              <div className="input-group">
                <label className="input-label">Email *</label>
                <input className="input" type="email" value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} />
              </div>
              <div className="input-group">
                <label className="input-label">Password *</label>
                <input className="input" type="password" value={newUserPassword} onChange={(e) => setNewUserPassword(e.target.value)} />
              </div>
              <div className="input-group">
                <label className="input-label">Role</label>
                <select className="input" value={newUserRole} onChange={(e) => setNewUserRole(e.target.value)}>
                  {(globalSupplyUsersMode ? globalSupplyCreateRoleOptions : availableRoleOptions).map((r) => (
                    <option key={r} value={r}>
                      {formatUserRoleLabel(r)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="input-group">
                <label className="input-label">Employee</label>
                <select
                  className="input"
                  value={newUserIsEmployee}
                  onChange={(e) => setNewUserIsEmployee(e.target.value as 'Yes' | 'No' | 'Contractor')}
                >
                  <option value="No">No</option>
                  <option value="Yes">Yes</option>
                  <option value="Contractor">Contractor</option>
                </select>
              </div>
              {!globalSupplyUsersMode && (
                <>
                  <div className="input-group">
                    <label className="input-label">Status</label>
                    <select
                      className="input"
                      value={newUserEmploymentStatus}
                      onChange={(e) => setNewUserEmploymentStatus(e.target.value as 'Active' | 'Inactive')}
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                  <div className="input-group">
                    <label className="input-label">Hourly rate (USD)</label>
                    <input
                      className="input"
                      type="number"
                      min={0}
                      step="0.01"
                      value={newUserHourlyRate}
                      onChange={(e) => setNewUserHourlyRate(e.target.value)}
                      placeholder="e.g. 45.00"
                    />
                  </div>
                </>
              )}
              <div className="input-group">
                <label className="input-label">Country</label>
                <input className="input" value={newUserCountry} onChange={(e) => setNewUserCountry(e.target.value)} />
              </div>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              style={{ marginTop: '0.75rem' }}
              onClick={createUser}
              disabled={busy}
            >
              Create user
            </button>
          </div>
        </div>
      )}

      {showBuyerSupplierSections && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div className="card-body">
            <h2 style={{ marginTop: 0 }}>Create supplier</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.5rem' }}>
            <div className="input-group">
              <label className="input-label">Name *</label>
              <input className="input" value={newSupName} onChange={(e) => setNewSupName(e.target.value)} />
            </div>
            <div className="input-group">
              <label className="input-label">City</label>
              <input className="input" value={newSupCity} onChange={(e) => setNewSupCity(e.target.value)} />
            </div>
            <div className="input-group">
              <label className="input-label">Country</label>
              <input className="input" value={newSupCountry} onChange={(e) => setNewSupCountry(e.target.value)} />
            </div>
            <div className="input-group">
              <label className="input-label">Latitude</label>
              <input
                className="input"
                type="number"
                step="0.000001"
                min={-90}
                max={90}
                value={newSupLatitude}
                onChange={(e) => setNewSupLatitude(e.target.value)}
              />
            </div>
            <div className="input-group">
              <label className="input-label">Longitude</label>
              <input
                className="input"
                type="number"
                step="0.000001"
                min={-180}
                max={180}
                value={newSupLongitude}
                onChange={(e) => setNewSupLongitude(e.target.value)}
              />
            </div>
            <div className="input-group">
              <label className="input-label">Status</label>
              <select className="input" value={newSupStatus} onChange={(e) => setNewSupStatus(e.target.value as 'Active' | 'Inactive')}>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
            <div className="input-group">
              <label className="input-label">Commodity</label>
              <select
                className="input"
                value={newSupCommodityTypeId}
                onChange={(e) => setNewSupCommodityTypeId(e.target.value)}
                style={{ minWidth: 180 }}
              >
                <option value="">— None —</option>
                {commodityTypes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="input-group">
              <label className="input-label">Notes</label>
              <input className="input" value={newSupNotes} onChange={(e) => setNewSupNotes(e.target.value)} />
            </div>
          </div>
            <button type="button" className="btn btn-primary" style={{ marginTop: '0.75rem' }} onClick={createSupplier} disabled={busy}>
              Create supplier
            </button>
          </div>
        </div>
      )}

      {showBuyerSupplierSections && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div className="card-body">
            <h2 style={{ marginTop: 0 }}>Suppliers (edit / delete)</h2>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>City</th>
                  <th>Country</th>
                  <th>Latitude</th>
                  <th>Longitude</th>
                  <th>Commodity</th>
                  <th>Status</th>
                  <th>Notes</th>
                  <th style={{ width: 220 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map((s) => (
                  <tr key={s.id}>
                    <td>{s.code}</td>
                    <td>
                      {editSup?.id === s.id ? (
                        <input className="input" value={editSup.name} onChange={(e) => setEditSup({ ...editSup, name: e.target.value })} />
                      ) : (
                        s.name
                      )}
                    </td>
                    <td>
                      {editSup?.id === s.id ? (
                        <input className="input" value={editSup.city ?? ''} onChange={(e) => setEditSup({ ...editSup, city: e.target.value })} />
                      ) : (
                        s.city ?? '—'
                      )}
                    </td>
                    <td>
                      {editSup?.id === s.id ? (
                        <input
                          className="input"
                          value={editSup.country ?? ''}
                          onChange={(e) => setEditSup({ ...editSup, country: e.target.value })}
                        />
                      ) : (
                        s.country ?? '—'
                      )}
                    </td>
                    <td>
                      {editSup?.id === s.id ? (
                        <input
                          className="input"
                          type="number"
                          step="0.000001"
                          min={-90}
                          max={90}
                          value={editSup.latitude ?? ''}
                          onChange={(e) =>
                            setEditSup({
                              ...editSup,
                              latitude: e.target.value === '' ? null : Number(e.target.value),
                            })
                          }
                        />
                      ) : typeof s.latitude === 'number' ? (
                        s.latitude
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      {editSup?.id === s.id ? (
                        <input
                          className="input"
                          type="number"
                          step="0.000001"
                          min={-180}
                          max={180}
                          value={editSup.longitude ?? ''}
                          onChange={(e) =>
                            setEditSup({
                              ...editSup,
                              longitude: e.target.value === '' ? null : Number(e.target.value),
                            })
                          }
                        />
                      ) : typeof s.longitude === 'number' ? (
                        s.longitude
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      {editSup?.id === s.id ? (
                        <select
                          className="input"
                          style={{ minWidth: 140 }}
                          value={editSup.commodityTypeId ?? ''}
                          onChange={(e) => {
                            const v = e.target.value;
                            const ct = v ? commodityTypes.find((x) => x.id === v) ?? null : null;
                            setEditSup({
                              ...editSup,
                              commodityTypeId: v === '' ? null : v,
                              commodityType: ct ? { id: ct.id, name: ct.name } : null,
                            });
                          }}
                        >
                          <option value="">— None —</option>
                          {commodityTypes.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        s.commodityType?.name ?? '—'
                      )}
                    </td>
                    <td>
                      {editSup?.id === s.id ? (
                        <select
                          className="input"
                          value={editSup.status}
                          onChange={(e) => setEditSup({ ...editSup, status: e.target.value as 'Active' | 'Inactive' })}
                        >
                          <option value="Active">Active</option>
                          <option value="Inactive">Inactive</option>
                        </select>
                      ) : (
                        s.status
                      )}
                    </td>
                    <td>
                      {editSup?.id === s.id ? (
                        <input
                          className="input"
                          value={editSup.notes ?? ''}
                          onChange={(e) => setEditSup({ ...editSup, notes: e.target.value })}
                        />
                      ) : (
                        s.notes?.trim() ? s.notes : '—'
                      )}
                    </td>
                    <td>
                      {editSup?.id === s.id ? (
                        <>
                          <button type="button" className="btn btn-primary" style={{ marginRight: 8 }} onClick={saveSupplierEdit} disabled={busy}>
                            Save
                          </button>
                          <button type="button" className="btn btn-ghost" onClick={() => setEditSup(null)}>
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button type="button" className="btn btn-ghost" style={{ marginRight: 8 }} onClick={() => setEditSup({ ...s })}>
                            Edit
                          </button>
                          <button type="button" className="btn btn-ghost" onClick={() => setDelSup(s)}>
                            Delete
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        </div>
      )}

      {showUsersTable && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div className="card-body">
            <h2 style={{ marginTop: 0 }}>{usersTableTitle}</h2>
            {usersOnlyEmployees && employeeContractorStats ? (
              <div
                className="dashboard-metric-grid"
                style={{
                  gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                  marginTop: '0.75rem',
                }}
              >
                <MetricCard
                  title="Total Employees"
                  value={employeeContractorStats.totalEmployees}
                  subtitle={`Total Active: ${employeeContractorStats.activeEmployees}`}
                />
                <MetricCard
                  title="Total Contractors"
                  value={employeeContractorStats.totalContractors}
                  subtitle={`Total Active: ${employeeContractorStats.activeContractors}`}
                />
              </div>
            ) : null}
            <div className="table-wrap">
              <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Employee</th>
                  {globalSupplyUsersMode ? (
                    <>
                      <th>Country</th>
                      <th>Role</th>
                      <th>Password</th>
                    </>
                  ) : (
                    <>
                      {usersOnlyEmployees && <th>Status</th>}
                      {usersOnlyEmployees && <th>Hourly rate (USD)</th>}
                      {usersOnlyEmployees && <th>Country</th>}
                      <th>Password</th>
                      <th>Role</th>
                    </>
                  )}
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleUsers.length === 0 ? (
                  <tr>
                    <td colSpan={userTableColSpan} className="table-empty">
                      No users yet.
                    </td>
                  </tr>
                ) : (
                  visibleUsers.map((u) => (
                    <tr key={u.id}>
                      <td>
                        {editUser?.id === u.id ? (
                          <input className="input" value={editUser.name ?? ''} onChange={(e) => setEditUser({ ...editUser, name: e.target.value })} />
                        ) : (
                          u.name?.trim() ? u.name : '—'
                        )}
                      </td>
                      <td>
                        {editUser?.id === u.id ? (
                          <input className="input" type="email" value={editUser.email} onChange={(e) => setEditUser({ ...editUser, email: e.target.value })} />
                        ) : (
                          u.email
                        )}
                      </td>
                      <td>
                        {editUser?.id === u.id ? (
                          <select
                            className="input"
                            value={editUser.isContractor ? 'Contractor' : editUser.isEmployee ? 'Yes' : 'No'}
                            onChange={(e) => {
                              const v = e.target.value as 'Yes' | 'No' | 'Contractor';
                              setEditUser({
                                ...editUser,
                                isEmployee: v === 'Yes',
                                isContractor: v === 'Contractor',
                              });
                            }}
                          >
                            <option value="No">No</option>
                            <option value="Yes">Yes</option>
                            <option value="Contractor">Contractor</option>
                          </select>
                        ) : u.isContractor ? (
                          'Contractor'
                        ) : u.isEmployee ? (
                          'Yes'
                        ) : (
                          'No'
                        )}
                      </td>
                      {globalSupplyUsersMode ? (
                        <>
                          <td>
                            {editUser?.id === u.id ? (
                              <input
                                className="input"
                                value={editUser.country ?? ''}
                                onChange={(e) => setEditUser({ ...editUser, country: e.target.value })}
                              />
                            ) : (
                              u.country ?? '—'
                            )}
                          </td>
                          <td>
                            {editUser?.id === u.id ? (
                              <select
                                className="input"
                                value={
                                  editUser.roleNames[0] ??
                                  (globalSupplyUsersMode ? globalSupplyCreateRoleOptions[0] ?? 'Buyer' : 'Viewer')
                                }
                                onChange={(e) => setEditUser({ ...editUser, roleNames: [e.target.value] })}
                              >
                                {roleOptionsForUserTable.map((r) => (
                                  <option key={r} value={r}>
                                    {formatUserRoleLabel(r)}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              u.roleNames.map(formatUserRoleLabel).join(', ')
                            )}
                          </td>
                          <td
                            style={{
                              fontFamily:
                                'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                              fontSize: 'var(--text-xs)',
                            }}
                          >
                            {editUser?.id === u.id ? (
                              <input
                                className="input"
                                type="password"
                                placeholder="Leave blank to keep current"
                                value={editUserPassword}
                                onChange={(e) => setEditUserPassword(e.target.value)}
                              />
                            ) : (
                              u.passwordPlain ?? '—'
                            )}
                          </td>
                        </>
                      ) : (
                        <>
                          {usersOnlyEmployees && (
                            <td>
                              {editUser?.id === u.id ? (
                                <select
                                  className="input"
                                  value={editUser.employmentStatus ?? 'Active'}
                                  onChange={(e) =>
                                    setEditUser({ ...editUser, employmentStatus: e.target.value as 'Active' | 'Inactive' })
                                  }
                                >
                                  <option value="Active">Active</option>
                                  <option value="Inactive">Inactive</option>
                                </select>
                              ) : (
                                u.employmentStatus ?? 'Active'
                              )}
                            </td>
                          )}
                          {usersOnlyEmployees && (
                            <td>
                              {editUser?.id === u.id ? (
                                <input
                                  className="input"
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  value={editUser.hourlyRate ?? ''}
                                  onChange={(e) =>
                                    setEditUser({ ...editUser, hourlyRate: e.target.value === '' ? null : Number(e.target.value) })
                                  }
                                  title="Amount in US dollars per hour"
                                />
                              ) : (
                                formatUsd(u.hourlyRate)
                              )}
                            </td>
                          )}
                          {usersOnlyEmployees && (
                            <td>
                              {editUser?.id === u.id ? (
                                <input
                                  className="input"
                                  value={editUser.country ?? ''}
                                  onChange={(e) => setEditUser({ ...editUser, country: e.target.value })}
                                />
                              ) : (
                                u.country ?? '—'
                              )}
                            </td>
                          )}
                          <td
                            style={{
                              fontFamily:
                                'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                              fontSize: 'var(--text-xs)',
                            }}
                          >
                            {editUser?.id === u.id ? (
                              <input
                                className="input"
                                type="password"
                                placeholder="Leave blank to keep current"
                                value={editUserPassword}
                                onChange={(e) => setEditUserPassword(e.target.value)}
                              />
                            ) : (
                              u.passwordPlain ?? '—'
                            )}
                          </td>
                          <td>
                            {editUser?.id === u.id ? (
                              <select
                                className="input"
                                value={
                                  editUser.roleNames[0] ??
                                  (globalSupplyUsersMode ? globalSupplyCreateRoleOptions[0] ?? 'Buyer' : 'Viewer')
                                }
                                onChange={(e) => setEditUser({ ...editUser, roleNames: [e.target.value] })}
                              >
                                {roleOptionsForUserTable.map((r) => (
                                  <option key={r} value={r}>
                                    {formatUserRoleLabel(r)}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              u.roleNames.map(formatUserRoleLabel).join(', ')
                            )}
                          </td>
                        </>
                      )}
                      <td>
                        {editUser?.id === u.id ? (
                          <>
                            <button type="button" className="btn btn-primary" style={{ marginRight: 8 }} onClick={saveUserEdit} disabled={busy}>
                              Save
                            </button>
                            <button
                              type="button"
                              className="btn btn-ghost"
                              onClick={() => {
                                setEditUser(null);
                                setEditUserPassword('');
                              }}
                              disabled={busy}
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              className="btn btn-ghost"
                              style={{ marginRight: 8 }}
                              onClick={() => {
                                setEditUser({
                                  ...u,
                                  roleNames: u.roleNames.length
                                    ? [...u.roleNames]
                                    : [globalSupplyUsersMode ? globalSupplyCreateRoleOptions[0] ?? 'Buyer' : 'Viewer'],
                                });
                                setEditUserPassword('');
                              }}
                              disabled={busy}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="btn btn-danger"
                              onClick={() => setDelUser(u)}
                              disabled={busy || authUser?.id === u.id}
                              title={authUser?.id === u.id ? 'You cannot delete your own account' : 'Delete user permanently'}
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {showBuyerSupplierSections && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div className="card-body">
            <h2 style={{ marginTop: 0 }}>Assign supplier → buyer</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'flex-end' }}>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label">Buyer</label>
              <select className="input" value={buyerId} onChange={(e) => setBuyerId(e.target.value)} style={{ minWidth: 200 }}>
                <option value="">Select buyer</option>
                {buyers.map((b) => (
                  <option key={b.id} value={b.id}>
                    {formatBuyerDisplayLabel(b)}
                  </option>
                ))}
              </select>
            </div>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label">Supplier</label>
              <select className="input" value={supplierId} onChange={(e) => setSupplierId(e.target.value)} style={{ minWidth: 200 }}>
                <option value="">Select supplier</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code}: {s.name}
                  </option>
                ))}
              </select>
            </div>
            <button type="button" className="btn btn-primary" onClick={assign} disabled={busy || !buyerId || !supplierId}>
              Assign
            </button>
          </div>
          </div>
        </div>
      )}

      {showBuyerSupplierSections && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div className="card-body">
            <h2 style={{ marginTop: 0 }}>Buyer assignments</h2>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Buyer</th>
                  <th>Assigned suppliers</th>
                  <th style={{ width: 100 }}>Unassign</th>
                </tr>
              </thead>
              <tbody>
                {buyers.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="table-empty">
                      No buyers. Create a user with Buyer role.
                    </td>
                  </tr>
                ) : (
                  buyers.flatMap((b) =>
                    b.assignedSupplierIds.length === 0
                      ? [
                          <tr key={b.id}>
                            <td>
                              <div>{b.name?.trim() || '—'}</div>
                              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>{b.email}</div>
                            </td>
                            <td colSpan={2} className="table-empty">
                              None
                            </td>
                          </tr>,
                        ]
                      : b.assignedSupplierIds.map((sid) => {
                          const sup = suppliers.find((x) => x.id === sid);
                          return (
                            <tr key={`${b.id}-${sid}`}>
                              <td>
                                <div>{b.name?.trim() || '—'}</div>
                                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>{b.email}</div>
                              </td>
                              <td>{sup ? `${sup.code}: ${sup.name}` : sid}</td>
                              <td>
                                <button type="button" className="btn btn-ghost" onClick={() => unassign(b.id, sid)} disabled={busy}>
                                  Remove
                                </button>
                              </td>
                            </tr>
                          );
                        })
                  )
                )}
              </tbody>
            </table>
          </div>
          </div>
        </div>
      )}

      {showBuyerSupplierSections && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div className="card-body">
            <h2 style={{ marginTop: 0 }}>Link supplier user account</h2>
            <p style={{ marginTop: 0, color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
              Linking replaces any existing supplier-user link automatically. Disconnect only removes the link; it does not delete users or suppliers.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'flex-end', marginBottom: '0.75rem' }}>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="input-label">Supplier company</label>
                <select
                  className="input"
                  value={supplierLinkSupplierId}
                  onChange={(e) => setSupplierLinkSupplierId(e.target.value)}
                  style={{ minWidth: 240 }}
                >
                  <option value="">Select supplier</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code}: {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="input-label">Supplier user account</label>
                <select
                  className="input"
                  value={supplierLinkUserId}
                  onChange={(e) => setSupplierLinkUserId(e.target.value)}
                  style={{ minWidth: 300 }}
                >
                  <option value="">Select supplier user</option>
                  {supplierUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name?.trim() ? `${u.name} (${u.email})` : u.email}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                className="btn btn-primary"
                onClick={linkSupplierUser}
                disabled={busy || !supplierLinkSupplierId || !supplierLinkUserId}
              >
                Link
              </button>
            </div>

            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Supplier</th>
                    <th>Linked supplier user</th>
                    <th style={{ width: 100 }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {suppliers.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="table-empty">
                        No suppliers.
                      </td>
                    </tr>
                  ) : (
                    suppliers.map((s) => (
                      <tr key={`link-${s.id}`}>
                        <td>{s.code}: {s.name}</td>
                        <td>{s.user ? (s.user.name?.trim() ? `${s.user.name} (${s.user.email})` : s.user.email) : '—'}</td>
                        <td>
                          {s.user ? (
                            <button type="button" className="btn btn-ghost" onClick={() => unlinkSupplierUser(s.id)} disabled={busy}>
                              Disconnect
                            </button>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!delUser}
        title="Delete user?"
        message={
          delUser
            ? `Permanently delete ${delUser.email}${delUser.name?.trim() ? ` (${delUser.name.trim()})` : ''}? This cannot be undone.`
            : ''
        }
        confirmLabel="Delete user"
        variant="danger"
        onCancel={() => setDelUser(null)}
        onConfirm={doDeleteUser}
      />

      <ConfirmDialog
        open={!!delSup}
        title="Delete supplier?"
        message={delSup ? `Permanently delete ${delSup.code}? Cascades related data.` : ''}
        confirmLabel="Delete"
        variant="danger"
        onCancel={() => setDelSup(null)}
        onConfirm={doDeleteSupplier}
      />
    </div>
  );
}

/**
 * Day 9.4: Client routes (menu/guards) + live server matrix from GET /users/permission-matrix.
 */
export function AdminPermissionsPanel({
  token,
  toast,
  scope = 'all',
}: {
  token: string | null;
  toast: ToastApi;
  scope?: 'all' | 'sentinel' | 'globalVendors';
}) {
  const [serverData, setServerData] = useState<PermissionMatrixResponse | null>(null);
  const [newRoleName, setNewRoleName] = useState('');
  const [busy, setBusy] = useState(false);
  const [matrixError, setMatrixError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const d = await apiJson<PermissionMatrixResponse>('/users/permission-matrix', { token });
      setServerData(d);
      setMatrixError(null);
    } catch (e) {
      setServerData(null);
      setMatrixError(e instanceof Error ? e.message : 'Failed to load server permission matrix');
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const togglePermission = (roleName: string, pageKey: string, checked: boolean) => {
    setServerData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        matrix: {
          ...prev.matrix,
          [roleName]: {
            ...(prev.matrix[roleName] ?? {}),
            [pageKey]: checked,
          },
        },
      };
    });
  };

  const addRole = async () => {
    if (!token || !newRoleName.trim()) return;
    setBusy(true);
    try {
      await apiJson('/users/roles', {
        token,
        method: 'POST',
        body: JSON.stringify({ name: newRoleName.trim() }),
      });
      setNewRoleName('');
      await load();
    } catch (e) {
      setMatrixError(e instanceof Error ? e.message : 'Failed to add role');
    } finally {
      setBusy(false);
    }
  };

  const savePermissions = async () => {
    if (!token || !serverData) return;
    setBusy(true);
    try {
      await apiJson('/users/permission-matrix', {
        token,
        method: 'PUT',
        body: JSON.stringify({ matrix: serverData.matrix }),
      });
      await load();
      toast.success('Permissions saved');
    } catch (e) {
      setMatrixError(e instanceof Error ? e.message : 'Failed to save permissions');
    } finally {
      setBusy(false);
    }
  };

  const filteredPages = useMemo(() => {
    if (!serverData) return [];
    if (scope === 'globalVendors') {
      return serverData.pages.filter((p) => p.path.startsWith('/global-vendors'));
    }
    if (scope === 'sentinel') {
      return serverData.pages.filter((p) => !p.path.startsWith('/global-vendors'));
    }
    return serverData.pages;
  }, [serverData, scope]);

  const filteredRoles = useMemo(() => {
    if (!serverData) return [];
    if (scope === 'globalVendors') {
      return serverData.roles.filter((r) => !PERMISSION_MATRIX_GLOBAL_SUPPLY_HIDE_ROLES.has(r));
    }
    if (scope === 'sentinel') {
      return serverData.roles.filter((r) => !PERMISSION_MATRIX_SENTINEL_HIDE_ROLES.has(r));
    }
    return serverData.roles;
  }, [serverData, scope]);

  return (
    <div className="card">
      <div className="card-body">
        <h2 style={{ marginTop: 0 }}>Permissions</h2>
        {matrixError && (
          <div className="alert-error" role="alert" style={{ marginBottom: '0.75rem' }}>
            {matrixError}
          </div>
        )}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label">New Role</label>
            <input className="input" value={newRoleName} onChange={(e) => setNewRoleName(e.target.value)} placeholder="Role name" />
          </div>
          <button type="button" className="btn btn-ghost" onClick={addRole} disabled={busy || !newRoleName.trim()}>
            Add
          </button>
          <button type="button" className="btn btn-primary" onClick={savePermissions} disabled={busy || !serverData}>
            Save Permissions
          </button>
        </div>
        {!serverData && !matrixError && token && <p>Loading permissions…</p>}
        {serverData && (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Role</th>
                  {filteredPages.map((p) => (
                    <th key={p.key}>{p.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRoles.map((roleName) => (
                  <tr key={roleName}>
                    <td>{formatUserRoleLabel(roleName)}</td>
                    {filteredPages.map((p) => (
                      <td key={`${roleName}-${p.key}`}>
                        <input
                          type="checkbox"
                          checked={Boolean(serverData.matrix[roleName]?.[p.key])}
                          onChange={(e) => togglePermission(roleName, p.key, e.target.checked)}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      </div>
    </div>
  );
}
