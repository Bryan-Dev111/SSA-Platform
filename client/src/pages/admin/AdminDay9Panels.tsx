/**
 * Day 9 Admin: Audit types, Risk weights, Buyers & suppliers; Permissions matrix is Admin → Permissions tab only.
 */
import { useCallback, useEffect, useState } from 'react';
import { apiJson } from '../../api/client';
import { ConfirmDialog } from '../../components/ConfirmDialog';

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
  const [newCode, setNewCode] = useState('');
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
    setBusy(true);
    try {
      await apiJson('/audit-types', {
        token,
        method: 'POST',
        body: JSON.stringify({
          code: newCode.trim() || undefined,
          name: newName.trim() || null,
        }),
      });
      setNewCode('');
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
        body: JSON.stringify({ code: edit.code.trim(), name: edit.name?.trim() || null }),
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
        <h2 style={{ marginTop: 0 }}>Audit types (TYP-xx)</h2>
        <p style={{ color: 'var(--color-text-muted)' }}>Used when scheduling audits. Leave code blank to auto-generate.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.5rem', marginBottom: '1rem' }}>
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label">Code (optional)</label>
            <input className="input" value={newCode} onChange={(e) => setNewCode(e.target.value)} placeholder="Auto" />
          </div>
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
                <th>Code</th>
                <th>Name</th>
                <th style={{ width: 200 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.length === 0 ? (
                <tr>
                  <td colSpan={3} className="table-empty">
                    No audit types.
                  </td>
                </tr>
              ) : (
                list.map((row) => (
                  <tr key={row.id}>
                    <td>
                      {edit?.id === row.id ? (
                        <input className="input" value={edit.code} onChange={(e) => setEdit({ ...edit, code: e.target.value })} />
                      ) : (
                        row.code
                      )}
                    </td>
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
        message={del ? `Remove ${del.code}? Audits referencing it must be reassigned first.` : ''}
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
      <div className="input-group" key={key}>
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
        <h2 style={{ marginTop: 0 }}>Risk category weights</h2>
        <p style={{ color: 'var(--color-text-muted)' }}>Used for risk calculation (Day 11). All five must sum to exactly 100%.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.75rem' }}>
          {field('qualityPercent', 'Quality')}
          {field('auditPercent', 'Audit')}
          {field('deliveryPercent', 'Delivery')}
          {field('carClosurePercent', 'CAR closure')}
          {field('documentationPercent', 'Documentation')}
        </div>
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
  roleNames: string[];
  passwordPlain: string | null;
  assignedSupplierIds: string[];
  qeAssignedSupplierIds?: string[];
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
}

const USER_ROLE_OPTIONS = ['Admin', 'Buyer', 'Supplier', 'Viewer', 'QualityEngineer', 'Auditor'] as const;

function formatUserRoleLabel(roleName: string): string {
  return roleName === 'QualityEngineer' ? 'Quality Engineer' : roleName;
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
  const [qeId, setQeId] = useState('');
  const [qeSupplierId, setQeSupplierId] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserFirstName, setNewUserFirstName] = useState('');
  const [newUserLastName, setNewUserLastName] = useState('');
  const [newUserRole, setNewUserRole] = useState<string>('Viewer');
  const [newUserIsEmployee, setNewUserIsEmployee] = useState<'Yes' | 'No' | 'Contractor'>('No');
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
  const qualityEngineers = users.filter((u) => u.roleNames.includes('QualityEngineer'));
  const visibleUsers = usersOnlyEmployees ? users.filter((u) => u.isEmployee === true) : users;
  const availableRoleOptions = availableRoles.length > 0 ? availableRoles : [...USER_ROLE_OPTIONS];

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

  const assignQe = async () => {
    if (!token || !qeId || !qeSupplierId) return;
    setBusy(true);
    try {
      await apiJson('/qe-suppliers', {
        token,
        method: 'POST',
        body: JSON.stringify({ qualityEngineerId: qeId, supplierId: qeSupplierId }),
      });
      toast.success('QE assignment created');
      setQeSupplierId('');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Assign failed');
    } finally {
      setBusy(false);
    }
  };

  const unassignQe = async (qualityEngineerId: string, supplierIdToRemove: string) => {
    if (!token) return;
    setBusy(true);
    try {
      await apiJson(`/qe-suppliers/${qualityEngineerId}/${supplierIdToRemove}`, { token, method: 'DELETE' });
      toast.info('QE unassigned');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
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
          roleNames,
        }),
      });
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserFirstName('');
      setNewUserLastName('');
      setNewUserRole('Viewer');
      setNewUserIsEmployee('No');
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

  const doDeleteSupplier = async () => {
    if (!token || !delSup) return;
    setBusy(true);
    try {
      await apiJson(`/suppliers/${delSup.id}`, { token, method: 'DELETE' });
      toast.success('Supplier deleted');
      setDelSup(null);
      await load();
    } catch (e) {
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
                      {r === 'QualityEngineer' ? 'Quality Engineer' : r}
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
            </div>
            <button type="button" className="btn btn-primary" style={{ marginTop: '0.75rem' }} onClick={createUser} disabled={busy}>
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
              Create supplier (auto code)
            </button>
          </div>
        </div>
      )}

      {showUsersTable && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div className="card-body">
            <h2 style={{ marginTop: 0 }}>{usersTableTitle}</h2>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginTop: 0, marginBottom: '0.75rem' }}>
              All accounts. Admin can view the stored original password (encrypted at rest). Existing users without an
              encrypted password will show `—` until their password is recreated.
            </p>
            <div className="table-wrap">
              <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Employee</th>
                  <th>Password</th>
                  <th>Role</th>
                </tr>
              </thead>
              <tbody>
                {visibleUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="table-empty">
                      No users yet.
                    </td>
                  </tr>
                ) : (
                  visibleUsers.map((u) => (
                    <tr key={u.id}>
                      <td>{u.name?.trim() ? u.name : '—'}</td>
                      <td>{u.email}</td>
                      <td>
                        {u.isContractor
                          ? 'Contractor'
                          : u.isEmployee
                            ? 'Yes'
                            : 'No'}
                      </td>
                      <td style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", \"Courier New\", monospace', fontSize: 'var(--text-xs)' }}>
                        {u.passwordPlain ?? '—'}
                      </td>
                      <td>{u.roleNames.map(formatUserRoleLabel).join(', ')}</td>
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
            <h2 style={{ marginTop: 0 }}>Assign supplier → Quality Engineer</h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'flex-end' }}>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="input-label">Quality Engineer</label>
                <select className="input" value={qeId} onChange={(e) => setQeId(e.target.value)} style={{ minWidth: 240 }}>
                  <option value="">Select QE</option>
                  {qualityEngineers.map((qe) => (
                    <option key={qe.id} value={qe.id}>
                      {qe.name?.trim() ? `${qe.name} (${qe.email})` : qe.email}
                    </option>
                  ))}
                </select>
              </div>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="input-label">Supplier</label>
                <select className="input" value={qeSupplierId} onChange={(e) => setQeSupplierId(e.target.value)} style={{ minWidth: 200 }}>
                  <option value="">Select supplier</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code} — {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <button type="button" className="btn btn-primary" onClick={assignQe} disabled={busy || !qeId || !qeSupplierId}>
                Assign
              </button>
            </div>
          </div>
        </div>
      )}

      {showBuyerSupplierSections && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div className="card-body">
            <h2 style={{ marginTop: 0 }}>QE assignments</h2>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Quality Engineer</th>
                    <th>Assigned suppliers</th>
                    <th style={{ width: 100 }}>Unassign</th>
                  </tr>
                </thead>
                <tbody>
                  {qualityEngineers.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="table-empty">
                        No Quality Engineers. Create a user with Quality Engineer role.
                      </td>
                    </tr>
                  ) : (
                    qualityEngineers.flatMap((qe) =>
                      (qe.qeAssignedSupplierIds ?? []).length === 0
                        ? [
                            <tr key={qe.id}>
                              <td>{qe.name?.trim() ? `${qe.name} (${qe.email})` : qe.email}</td>
                              <td colSpan={2} className="table-empty">
                                None
                              </td>
                            </tr>,
                          ]
                        : (qe.qeAssignedSupplierIds ?? []).map((sid) => {
                            const sup = suppliers.find((x) => x.id === sid);
                            return (
                              <tr key={`${qe.id}-${sid}`}>
                                <td>{qe.name?.trim() ? `${qe.name} (${qe.email})` : qe.email}</td>
                                <td>{sup ? `${sup.code} — ${sup.name}` : sid}</td>
                                <td>
                                  <button type="button" className="btn btn-ghost" onClick={() => unassignQe(qe.id, sid)} disabled={busy}>
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
        <div className="card">
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
export function AdminPermissionsPanel({ token }: { token: string | null }) {
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
        <p style={{ color: 'var(--color-text-muted)' }}>
          Manage role access by page/module. Changes apply to sidebar visibility, route guards, and API page protection.
        </p>
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
                    <td>{roleName === 'QualityEngineer' ? 'Quality Engineer' : roleName}</td>
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

        <h3 style={{ marginTop: '1.5rem' }}>Admin-only delete (server-enforced)</h3>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
          Only <strong>Admin</strong> may call these deletes. UI shows Delete on Findings, Audits, and CARs only for Admin;
          Supplier delete is on Admin → Buyers & suppliers. Risk snapshot / Opportunity deletes are API-ready for future Risk
          UI.
        </p>
        {serverData?.adminOnlyDeletes && (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Entity</th>
                  <th>Method</th>
                  <th>Path</th>
                </tr>
              </thead>
              <tbody>
                {serverData.adminOnlyDeletes.map((row) => (
                  <tr key={`${row.entity}-${row.path}`}>
                    <td>{row.entity}</td>
                    <td>
                      <code>{row.method}</code>
                    </td>
                    <td>
                      <code>{row.path}</code>
                    </td>
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
