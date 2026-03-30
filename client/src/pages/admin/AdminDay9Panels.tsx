/**
 * Day 9 Admin: Audit types, Risk weights, Buyers & suppliers; Permissions matrix is Admin → Permissions tab only.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiJson } from '../../api/client';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { MetricCard } from '../../components/MetricCard';
import { downloadTableXlsx, type ExportRow } from '../../utils/exportExcel';

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

interface RiskWeights {
  id: string;
  qualityPercent: number;
  auditPercent: number;
  deliveryPercent: number;
  carClosurePercent: number;
  documentationPercent: number;
}

interface ExpenseRow {
  id: string;
  type: string;
  description: string;
  project: string;
  amount: number;
  createdAt: string;
  updatedAt: string;
}

export function AdminExpensesPanel({ token, toast }: { token: string | null; toast: ToastApi }) {
  const [list, setList] = useState<ExpenseRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [type, setType] = useState('');
  const [description, setDescription] = useState('');
  const [project, setProject] = useState('');
  const [amount, setAmount] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{ type: string; description: string; project: string; amount: string }>({
    type: '',
    description: '',
    project: '',
    amount: '',
  });
  const totalExpenses = useMemo(() => list.reduce((sum, item) => sum + item.amount, 0), [list]);

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

  useEffect(() => {
    load();
  }, [load]);

  const add = async () => {
    if (!token) return;
    const amountNum = Number(amount);
    if (!type.trim() || !description.trim() || !project.trim() || !Number.isFinite(amountNum)) {
      toast.error('Type, description, project, and amount are required');
      return;
    }
    setBusy(true);
    try {
      await apiJson('/expenses', {
        token,
        method: 'POST',
        body: JSON.stringify({
          type: type.trim(),
          description: description.trim(),
          project: project.trim(),
          amount: amountNum,
        }),
      });
      setType('');
      setDescription('');
      setProject('');
      setAmount('');
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
    });
  };

  const saveEdit = async () => {
    if (!token || !editId) return;
    const amountNum = Number(editDraft.amount);
    if (
      !editDraft.type.trim() ||
      !editDraft.description.trim() ||
      !editDraft.project.trim() ||
      !Number.isFinite(amountNum)
    ) {
      toast.error('Type, description, project, and amount are required');
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
    if (list.length === 0) {
      toast.info('No expenses to export');
      return;
    }
    const rows: ExportRow[] = list.map((r) => ({
      Type: r.type,
      Description: r.description,
      Project: r.project,
      Amount: r.amount,
      Created: new Date(r.createdAt).toLocaleString(),
    }));
    downloadTableXlsx('expenses', 'Expenses', rows);
    toast.success('Exported expenses');
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
          <MetricCard title="Total Expenses" value={totalExpenses.toFixed(2)} />
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
            <input className="input" value={type} onChange={(e) => setType(e.target.value)} />
          </div>
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label">Description</label>
            <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label">Project</label>
            <input className="input" value={project} onChange={(e) => setProject(e.target.value)} />
          </div>
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label">Amount</label>
            <input className="input" type="number" step={0.01} value={amount} onChange={(e) => setAmount(e.target.value)} />
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
                <th>Type</th>
                <th>Description</th>
                <th>Project</th>
                <th>Amount</th>
                <th>Created</th>
                <th style={{ width: 170 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.length === 0 ? (
                <tr>
                  <td colSpan={6} className="table-empty">
                    No expenses yet.
                  </td>
                </tr>
              ) : (
                list.map((row) => (
                  <tr key={row.id}>
                    <td>
                      {editId === row.id ? (
                        <input
                          className="input"
                          value={editDraft.type}
                          onChange={(e) => setEditDraft((d) => ({ ...d, type: e.target.value }))}
                        />
                      ) : (
                        row.type
                      )}
                    </td>
                    <td>
                      {editId === row.id ? (
                        <input
                          className="input"
                          value={editDraft.description}
                          onChange={(e) => setEditDraft((d) => ({ ...d, description: e.target.value }))}
                        />
                      ) : (
                        row.description
                      )}
                    </td>
                    <td>
                      {editId === row.id ? (
                        <input
                          className="input"
                          value={editDraft.project}
                          onChange={(e) => setEditDraft((d) => ({ ...d, project: e.target.value }))}
                        />
                      ) : (
                        row.project
                      )}
                    </td>
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
                    <td>{new Date(row.createdAt).toLocaleString()}</td>
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

export function AdminRiskWeightsPanel({ token, toast }: { token: string | null; toast: ToastApi }) {
  const [w, setW] = useState<RiskWeights | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const r = await apiJson<RiskWeights>('/risk-weights', { token });
      setW(r);
    } catch {
      setW(null);
      toast.error('Failed to load risk weights');
    }
  }, [token, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    if (!token || !w) return;
    setBusy(true);
    try {
      const updated = await apiJson<RiskWeights>('/risk-weights', {
        token,
        method: 'PUT',
        body: JSON.stringify({
          qualityPercent: w.qualityPercent,
          auditPercent: w.auditPercent,
          deliveryPercent: w.deliveryPercent,
          carClosurePercent: w.carClosurePercent,
          documentationPercent: w.documentationPercent,
        }),
      });
      setW(updated);
      toast.success('Risk weights saved (must sum to 100%)');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  if (!w) {
    return (
      <div className="card">
        <div className="card-body">Loading risk weights…</div>
      </div>
    );
  }

  const sum =
    w.qualityPercent + w.auditPercent + w.deliveryPercent + w.carClosurePercent + w.documentationPercent;
  const sumOk = Math.abs(sum - 100) < 0.02;

  const field = (key: keyof RiskWeights, label: string) => {
    if (key === 'id') return null;
    return (
      <div className="input-group risk-weights-field" key={key}>
        <label className="input-label">{label} (%)</label>
        <input
          className="input"
          type="number"
          min={0}
          max={100}
          step={0.1}
          value={w[key] as number}
          onChange={(e) => setW({ ...w, [key]: Number(e.target.value) })}
        />
      </div>
    );
  };

  return (
    <div className="card">
      <div className="card-body">
        <h2 style={{ marginTop: 0 }}>Risk weights</h2>
        <div
          style={{
            marginBottom: '0.75rem',
            padding: '0.6rem 0.75rem',
            borderRadius: 8,
            background: 'var(--color-surface-muted)',
            border: '1px solid var(--color-border-subtle)',
            fontSize: 'var(--text-sm)',
            lineHeight: 1.5,
          }}
        >
          <p style={{ margin: '0 0 0.5rem', color: 'var(--color-text-muted)' }}>
            The supplier risk score is built from <strong>shipments</strong> and <strong>audits</strong> only:{' '}
            <strong>first-pass yield (FPY)</strong> (pass rate) plus a <strong>severity index</strong> from findings tied to each side. It is not a single generic “overall quality” index.
          </p>
          <p style={{ margin: '0 0 0.35rem', fontWeight: 600 }}>Definitions</p>
          <ul style={{ margin: '0 0 0.6rem 1.1rem', padding: 0 }}>
            <li>
              <strong>FPY_ship</strong>: Passed ÷ (Passed + Failed) from shipment inspections; 1 if there are no pass/fail outcomes.
            </li>
            <li>
              <strong>FPY_audit</strong>: Passed ÷ (Passed + Failed) from audits; 1 if there are no pass/fail outcomes.
            </li>
            <li>
              <strong>Sev_ship</strong> / <strong>Sev_audit</strong>: severity index from findings linked to shipments vs audits (formula below).
            </li>
          </ul>
          <pre
            style={{
              margin: 0,
              padding: '0.5rem 0.6rem',
              borderRadius: 6,
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border-subtle)',
              fontSize: 'var(--text-xs)',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {`SS = 0.5 · (1 − FPY_ship) + 0.5 · Sev_ship     ← shipment-side composite
AS = 0.5 · (1 − FPY_audit) + 0.5 · Sev_audit   ← audit-side composite
QS = 0.5 · SS + 0.5 · AS                        (SS, AS clamped to [0, 1])
Risk score (0–100, higher = worse) = QS × 100`}
          </pre>
          <p style={{ margin: '0.6rem 0 0', color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)' }}>
            <strong>Severity index</strong> (for each side): Sev = (C·1 + M·0.7 + m·0.3) ÷ (U × n), where C/M/m are counts of Critical/Major/Minor findings, U is total shipments or total audits (depending on bucket), and n is the number of findings in that bucket. If there are no findings or U is zero, Sev is 0.
          </p>
        </div>
        <div className="risk-weights-form-grid">
          {field('qualityPercent', 'Shipment composite (SS)')}
          {field('auditPercent', 'Audit composite (AS)')}
          {field('deliveryPercent', 'Shipment pass gap (1 − FPY)')}
          {field('carClosurePercent', 'Shipment severity (Sev_ship)')}
          {field('documentationPercent', 'Audit severity (Sev_audit)')}
        </div>
        <p style={{ marginTop: '0.5rem', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
          These labels align with the shipment/audit factor breakdown used for supplier risk. All five percentages must sum to 100%.
        </p>
        <p style={{ marginTop: '0.75rem', fontWeight: sumOk ? 400 : 600, color: sumOk ? 'inherit' : 'var(--color-danger)' }}>
          Current sum: {sum.toFixed(2)}%{sumOk ? ' ✓' : ' — must be 100'}
        </p>
        <button type="button" className="btn btn-primary" onClick={save} disabled={busy || !sumOk}>
          {busy ? 'Saving…' : 'Save weights'}
        </button>
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
}

const USER_ROLE_OPTIONS = ['Admin', 'Buyer', 'Supplier', 'Viewer', 'QualityEngineer', 'QualityManager', 'Auditor'] as const;

function formatUserRoleLabel(roleName: string): string {
  if (roleName === 'QualityEngineer') return 'Quality Engineer';
  if (roleName === 'QualityManager') return 'Quality Manager';
  return roleName;
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
}: {
  token: string | null;
  toast: ToastApi;
  showCreateUser?: boolean;
  showUsersTable?: boolean;
  showBuyerSupplierSections?: boolean;
  usersOnlyEmployees?: boolean;
  usersTableTitle?: string;
}) {
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
  const [newUserCurrency, setNewUserCurrency] = useState('');
  const [newUserCountry, setNewUserCountry] = useState('');
  /** Role names from server (includes custom roles); matrix UI lives only on Permissions tab. */
  const [availableRoles, setAvailableRoles] = useState<string[]>([]);
  const [newSupName, setNewSupName] = useState('');
  const [newSupCity, setNewSupCity] = useState('');
  const [newSupCountry, setNewSupCountry] = useState('');
  const [newSupStatus, setNewSupStatus] = useState<'Active' | 'Inactive'>('Active');
  const [newSupNotes, setNewSupNotes] = useState('');
  const [newSupCommodityTypeId, setNewSupCommodityTypeId] = useState('');
  const [commodityTypes, setCommodityTypes] = useState<CommodityTypeRow[]>([]);
  const [editSup, setEditSup] = useState<SupplierRow | null>(null);
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [editUserPassword, setEditUserPassword] = useState('');
  const [delSup, setDelSup] = useState<SupplierRow | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [u, s, ct] = await Promise.all([
        apiJson<UserRow[]>('/users', { token }),
        apiJson<SupplierRow[]>('/suppliers', { token }),
        apiJson<{ list: CommodityTypeRow[] }>('/commodity-types', { token }).catch(() => ({ list: [] as CommodityTypeRow[] })),
      ]);
      setUsers(u);
      setSuppliers(s);
      setCommodityTypes(ct.list);
      try {
        const p = await apiJson<PermissionMatrixResponse>('/users/permission-matrix', { token });
        setAvailableRoles(p.roles ?? []);
      } catch {
        setAvailableRoles([...USER_ROLE_OPTIONS]);
      }
    } catch {
      toast.error('Failed to load users/suppliers');
    }
  }, [token, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const buyers = users.filter((u) => u.roleNames.includes('Buyer'));
  const supplierUsers = users.filter((u) => u.roleNames.includes('Supplier'));
  const visibleUsers = usersOnlyEmployees
    ? users.filter((u) => Boolean(u.isEmployee) || Boolean(u.isContractor))
    : users;
  const availableRoleOptions = availableRoles.length > 0 ? availableRoles : [...USER_ROLE_OPTIONS];

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
          employmentStatus: newUserEmploymentStatus,
          hourlyRate: newUserHourlyRate.trim() === '' ? null : Number(newUserHourlyRate),
          currency: newUserCurrency.trim() || null,
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
      setNewUserCurrency('');
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
          commodityTypeId: newSupCommodityTypeId.trim() ? newSupCommodityTypeId.trim() : null,
        }),
      });
      setNewSupName('');
      setNewSupCity('');
      setNewSupCountry('');
      setNewSupStatus('Active');
      setNewSupNotes('');
      setNewSupCommodityTypeId('');
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
          currency: editUser.currency?.trim() || null,
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
                  {availableRoleOptions.map((r) => (
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
              <div className="input-group">
                <label className="input-label">Status</label>
                <select className="input" value={newUserEmploymentStatus} onChange={(e) => setNewUserEmploymentStatus(e.target.value as 'Active' | 'Inactive')}>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
              <div className="input-group">
                <label className="input-label">Hourly Rate</label>
                <input
                  className="input"
                  type="number"
                  min={0}
                  step="0.01"
                  value={newUserHourlyRate}
                  onChange={(e) => setNewUserHourlyRate(e.target.value)}
                />
              </div>
              <div className="input-group">
                <label className="input-label">Currency</label>
                <input className="input" value={newUserCurrency} onChange={(e) => setNewUserCurrency(e.target.value)} />
              </div>
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
                  {usersOnlyEmployees && <th>Status</th>}
                  {usersOnlyEmployees && <th>Hourly Rate</th>}
                  {usersOnlyEmployees && <th>Currency</th>}
                  {usersOnlyEmployees && <th>Country</th>}
                  <th>Password</th>
                  <th>Role</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleUsers.length === 0 ? (
                  <tr>
                    <td colSpan={usersOnlyEmployees ? 10 : 6} className="table-empty">
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
                      {usersOnlyEmployees && (
                        <td>
                          {editUser?.id === u.id ? (
                            <select
                              className="input"
                              value={editUser.employmentStatus ?? 'Active'}
                              onChange={(e) => setEditUser({ ...editUser, employmentStatus: e.target.value as 'Active' | 'Inactive' })}
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
                              onChange={(e) => setEditUser({ ...editUser, hourlyRate: e.target.value === '' ? null : Number(e.target.value) })}
                            />
                          ) : u.hourlyRate != null ? (
                            u.hourlyRate
                          ) : (
                            '—'
                          )}
                        </td>
                      )}
                      {usersOnlyEmployees && (
                        <td>
                          {editUser?.id === u.id ? (
                            <input className="input" value={editUser.currency ?? ''} onChange={(e) => setEditUser({ ...editUser, currency: e.target.value })} />
                          ) : (
                            u.currency ?? '—'
                          )}
                        </td>
                      )}
                      {usersOnlyEmployees && (
                        <td>
                          {editUser?.id === u.id ? (
                            <input className="input" value={editUser.country ?? ''} onChange={(e) => setEditUser({ ...editUser, country: e.target.value })} />
                          ) : (
                            u.country ?? '—'
                          )}
                        </td>
                      )}
                      <td style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", \"Courier New\", monospace', fontSize: 'var(--text-xs)' }}>
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
                            value={editUser.roleNames[0] ?? 'Viewer'}
                            onChange={(e) => setEditUser({ ...editUser, roleNames: [e.target.value] })}
                          >
                            {availableRoleOptions.map((r) => (
                              <option key={r} value={r}>
                                {formatUserRoleLabel(r)}
                              </option>
                            ))}
                          </select>
                        ) : (
                          u.roleNames.map(formatUserRoleLabel).join(', ')
                        )}
                      </td>
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
                          <button
                            type="button"
                            className="btn btn-ghost"
                            onClick={() => {
                              setEditUser({ ...u, roleNames: u.roleNames.length ? [...u.roleNames] : ['Viewer'] });
                              setEditUserPassword('');
                            }}
                            disabled={busy}
                          >
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
                    {b.email}
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
                    {s.code} — {s.name}
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
                            <td>{b.email}</td>
                            <td colSpan={2} className="table-empty">
                              None
                            </td>
                          </tr>,
                        ]
                      : b.assignedSupplierIds.map((sid) => {
                          const sup = suppliers.find((x) => x.id === sid);
                          return (
                            <tr key={`${b.id}-${sid}`}>
                              <td>{b.email}</td>
                              <td>{sup ? `${sup.code} — ${sup.name}` : sid}</td>
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
                      {s.code} — {s.name}
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
                        <td>{s.code} — {s.name}</td>
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
export function AdminPermissionsPanel({ token, toast }: { token: string | null; toast: ToastApi }) {
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
                  {serverData.pages.map((p) => (
                    <th key={p.key}>{p.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {serverData.roles.map((roleName) => (
                  <tr key={roleName}>
                    <td>{formatUserRoleLabel(roleName)}</td>
                    {serverData.pages.map((p) => (
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
