/**
 * Admin — Employee Assignments
 * A) Auditor → Supplier
 * B) Quality Engineer → Buyer (QE derives suppliers from Buyer → Suppliers)
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiJson } from '../../api/client';
import { parseApiError } from '../../utils/apiHelpers';

interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

interface SupplierRow {
  id: string;
  code: string;
  name: string;
}

interface UserRow {
  id: string;
  email: string;
  name: string | null;
  roleNames: string[];
  isEmployee?: boolean;
  isContractor?: boolean;
  country?: string | null;
  /** Operational countries (roster); falls back to legacy `country` when empty on server. */
  assignedCountryNames?: string[];
  hourlyRate?: number | null;
  currency?: string | null;
  employmentResponsibilities?: string | null;
  employmentNotes?: string | null;
  // Buyer → Suppliers
  assignedSupplierIds?: string[];
  // Auditor → Suppliers
  auditorAssignedSupplierIds?: string[];
  employeeAssignedSupplierIds?: string[];
  // QE → Buyers
  qeAssignedBuyerIds?: string[];
  // Quality Manager → Quality Engineers
  qmAssignedQeIds?: string[];
}

function formatRoleLabel(role: string): string {
  if (role === 'QualityEngineer') return 'Quality Engineer';
  if (role === 'QualityManager') return 'Quality Manager';
  if (role === 'CommodityBuyer') return 'Commodity Buyer';
  if (role === 'SourcingDirector') return 'Sourcing Director';
  return role;
}

function formatRolesCell(roleNames: string[]): string {
  if (!roleNames.length) return '—';
  return roleNames.map(formatRoleLabel).join(', ');
}

function formatRateCell(hourlyRate: number | null | undefined, currency: string | null | undefined): string {
  if (hourlyRate == null || !Number.isFinite(hourlyRate)) return '—';
  const cur = (currency ?? 'USD').trim() || 'USD';
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: cur.length === 3 ? cur : 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(hourlyRate);
  } catch {
    return `${hourlyRate.toFixed(2)} ${cur}`;
  }
}

type RosterDraft = {
  assignedCountryNames: string[];
  employmentResponsibilities: string;
  hourlyRate: string;
  currency: string;
  employmentNotes: string;
};

const emptyDraft = (): RosterDraft => ({
  assignedCountryNames: [],
  employmentResponsibilities: '',
  hourlyRate: '',
  currency: 'USD',
  employmentNotes: '',
});

function formatCountriesCell(u: UserRow): string {
  const list = u.assignedCountryNames?.filter(Boolean) ?? [];
  if (list.length) return list.join(', ');
  return u.country?.trim() || '—';
}

export function AdminEmployeeAssignmentsPanel({
  token,
  toast,
  globalSupplyEmployeeRosterMode = false,
  canEditStaffRoster = false,
  employeeProfilePathPrefix = '/global-vendors/employee-profile',
}: {
  token: string | null;
  toast: ToastApi;
  /** Global Supply Internal Management: roster-only view (loads from /management-directory so QM can read). */
  globalSupplyEmployeeRosterMode?: boolean;
  /** Only Admin may edit Country, Responsibilities, Rate, Notes (server enforces Admin on PATCH). */
  canEditStaffRoster?: boolean;
  /** Base path without trailing slash; name links go to `${prefix}/${userId}`. */
  employeeProfilePathPrefix?: string;
}) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
  const [loading, setLoading] = useState(!globalSupplyEmployeeRosterMode);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [rosterUsers, setRosterUsers] = useState<UserRow[]>([]);
  const [rosterLoading, setRosterLoading] = useState(globalSupplyEmployeeRosterMode);
  const [rosterError, setRosterError] = useState<string | null>(null);
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
  const [rosterDraft, setRosterDraft] = useState<RosterDraft>(() => emptyDraft());
  const [rosterSaveBusy, setRosterSaveBusy] = useState(false);
  const [countryOptions, setCountryOptions] = useState<{ id: string; name: string }[]>([]);

  const [employeeId, setEmployeeId] = useState('');
  const [employeeSupplierId, setEmployeeSupplierId] = useState('');

  const [qeId, setQeId] = useState('');
  const [qeBuyerId, setQeBuyerId] = useState('');
  const [qmId, setQmId] = useState('');
  const [qmQeId, setQmQeId] = useState('');

  const loadDefaultPanel = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [u, s] = await Promise.all([apiJson<UserRow[]>('/users', { token }), apiJson<SupplierRow[]>('/suppliers', { token })]);
      setUsers(u);
      setSuppliers(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load assignments');
      setUsers([]);
      setSuppliers([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  const loadRoster = useCallback(async () => {
    if (!token) {
      setRosterUsers([]);
      setRosterLoading(false);
      return;
    }
    setRosterLoading(true);
    setRosterError(null);
    try {
      const rows = await apiJson<UserRow[]>('/management-directory', { token });
      setRosterUsers(rows);
    } catch (e) {
      setRosterUsers([]);
      setRosterError(e instanceof Error ? e.message : 'Failed to load roster');
    } finally {
      setRosterLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (globalSupplyEmployeeRosterMode) {
      void loadRoster();
    } else {
      void loadDefaultPanel();
    }
  }, [globalSupplyEmployeeRosterMode, loadDefaultPanel, loadRoster]);

  useEffect(() => {
    if (!token) return;
    void apiJson<{ list: { id: string; name: string }[] }>('/global-supply-options/countries', { token })
      .then((r) => setCountryOptions(Array.isArray(r.list) ? r.list : []))
      .catch(() => setCountryOptions([]));
  }, [token]);

  const employeeContractors = useMemo(() => {
    const pool = globalSupplyEmployeeRosterMode ? rosterUsers : users;
    return pool
      .filter((u) => Boolean(u.isEmployee) || Boolean(u.isContractor))
      .sort((a, b) => {
        const na = (a.name?.trim() || a.email).toLocaleLowerCase();
        const nb = (b.name?.trim() || b.email).toLocaleLowerCase();
        return na.localeCompare(nb, undefined, { sensitivity: 'base' });
      });
  }, [globalSupplyEmployeeRosterMode, rosterUsers, users]);
  const buyers = useMemo(() => users.filter((u) => u.roleNames.includes('Buyer')), [users]);
  const qes = useMemo(() => users.filter((u) => u.roleNames.includes('QualityEngineer')), [users]);
  const qualityManagers = useMemo(() => users.filter((u) => u.roleNames.includes('QualityManager')), [users]);

  const buyerSupplierIdsByBuyerId = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const b of buyers) {
      map[b.id] = b.assignedSupplierIds ?? [];
    }
    return map;
  }, [buyers]);

  const supplierById = useMemo(() => {
    const map: Record<string, SupplierRow> = {};
    for (const s of suppliers) map[s.id] = s;
    return map;
  }, [suppliers]);

  const assignEmployeeSupplier = async () => {
    if (!token || !employeeId || !employeeSupplierId) return;
    setBusy(true);
    try {
      await apiJson('/employee-suppliers', {
        token,
        method: 'POST',
        body: JSON.stringify({ employeeId, supplierId: employeeSupplierId }),
      });
      toast.success('Employee/contractor assignment created');
      setEmployeeSupplierId('');
      await loadDefaultPanel();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Assignment failed');
    } finally {
      setBusy(false);
    }
  };

  const removeEmployeeSupplier = async (aId: string, sId: string) => {
    if (!token) return;
    setBusy(true);
    try {
      await apiJson(`/employee-suppliers/${aId}/${sId}`, { token, method: 'DELETE' });
      toast.info('Employee/contractor assignment removed');
      await loadDefaultPanel();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Remove failed');
    } finally {
      setBusy(false);
    }
  };

  const assignQeBuyer = async () => {
    if (!token || !qeId || !qeBuyerId) return;
    setBusy(true);
    try {
      await apiJson('/qe-buyers', {
        token,
        method: 'POST',
        body: JSON.stringify({ qualityEngineerId: qeId, buyerId: qeBuyerId }),
      });
      toast.success('QE → Buyer assignment created');
      setQeBuyerId('');
      await loadDefaultPanel();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Assignment failed');
    } finally {
      setBusy(false);
    }
  };

  const removeQeBuyer = async (qId: string, bId: string) => {
    if (!token) return;
    setBusy(true);
    try {
      await apiJson(`/qe-buyers/${qId}/${bId}`, { token, method: 'DELETE' });
      toast.info('QE → Buyer assignment removed');
      await loadDefaultPanel();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Remove failed');
    } finally {
      setBusy(false);
    }
  };

  const assignQmQe = async () => {
    if (!token || !qmId || !qmQeId) return;
    setBusy(true);
    try {
      await apiJson('/qm-qes', {
        token,
        method: 'POST',
        body: JSON.stringify({ qualityManagerId: qmId, qualityEngineerId: qmQeId }),
      });
      toast.success('Quality Manager → Quality Engineer assignment created');
      setQmQeId('');
      await loadDefaultPanel();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Assignment failed');
    } finally {
      setBusy(false);
    }
  };

  const removeQmQe = async (managerId: string, engineerId: string) => {
    if (!token) return;
    setBusy(true);
    try {
      await apiJson(`/qm-qes/${managerId}/${engineerId}`, { token, method: 'DELETE' });
      toast.info('Quality Manager → Quality Engineer assignment removed');
      await loadDefaultPanel();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Remove failed');
    } finally {
      setBusy(false);
    }
  };

  const beginEditStaffRow = (u: UserRow) => {
    setEditingStaffId(u.id);
    const existing =
      u.assignedCountryNames && u.assignedCountryNames.length > 0
        ? [...u.assignedCountryNames]
        : u.country?.trim()
          ? [u.country.trim()]
          : [];
    setRosterDraft({
      assignedCountryNames: existing,
      employmentResponsibilities: u.employmentResponsibilities ?? '',
      hourlyRate: u.hourlyRate != null && Number.isFinite(u.hourlyRate) ? String(u.hourlyRate) : '',
      currency: (u.currency ?? 'USD').trim() || 'USD',
      employmentNotes: u.employmentNotes ?? '',
    });
  };

  const cancelEditStaffRow = () => {
    setEditingStaffId(null);
    setRosterDraft(emptyDraft());
  };

  const saveStaffRosterRow = async (userId: string) => {
    if (!token || !canEditStaffRoster) return;
    setRosterSaveBusy(true);
    try {
      const hourlyParsed =
        rosterDraft.hourlyRate.trim() === '' ? null : Number(rosterDraft.hourlyRate.replace(/,/g, ''));
      if (hourlyParsed !== null && (!Number.isFinite(hourlyParsed) || hourlyParsed < 0)) {
        toast.error('Rate must be a non-negative number or empty');
        return;
      }
      await apiJson(`/users/${userId}`, {
        token,
        method: 'PATCH',
        body: JSON.stringify({
          assignedCountryNames: rosterDraft.assignedCountryNames,
          employmentResponsibilities: rosterDraft.employmentResponsibilities.trim() || null,
          employmentNotes: rosterDraft.employmentNotes.trim() || null,
          hourlyRate: hourlyParsed,
          currency: hourlyParsed !== null ? rosterDraft.currency.trim() || 'USD' : null,
        }),
      });
      toast.success('Roster updated');
      setEditingStaffId(null);
      setRosterDraft(emptyDraft());
      await loadRoster();
    } catch (e) {
      toast.error(parseApiError(e));
    } finally {
      setRosterSaveBusy(false);
    }
  };

  if (globalSupplyEmployeeRosterMode) {
    if (rosterLoading) {
      return (
        <div className="card">
          <div className="card-body">
            <h2 style={{ marginTop: 0 }}>Employee Assignments</h2>
            <div className="loading-message" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div className="loading-spinner" />
              <p style={{ margin: 0 }}>Loading roster…</p>
            </div>
          </div>
        </div>
      );
    }
    if (rosterError) {
      return (
        <div className="card">
          <div className="card-body">
            <h2 style={{ marginTop: 0 }}>Employee Assignments</h2>
            <div className="alert-error">{rosterError}</div>
          </div>
        </div>
      );
    }

    return (
      <div className="card">
        <div className="card-body">
          <h2 style={{ marginTop: 0 }}>Employees & contractors</h2>
          <div className="table-wrap" style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th style={{ minWidth: 200 }}>Name</th>
                  <th style={{ minWidth: 120 }}>Country</th>
                  <th style={{ minWidth: 160 }}>Role</th>
                  <th style={{ minWidth: 220 }}>Responsibilities</th>
                  <th style={{ minWidth: 120 }}>Rate</th>
                  <th style={{ minWidth: 200 }}>Notes</th>
                  {canEditStaffRoster ? <th style={{ width: 140 }}>Actions</th> : null}
                </tr>
              </thead>
              <tbody>
                {employeeContractors.length === 0 ? (
                  <tr>
                    <td colSpan={canEditStaffRoster ? 7 : 6} className="table-empty">
                      No employees or contractors. Mark users as Employee or Contractor in Admin → Users.
                    </td>
                  </tr>
                ) : (
                  employeeContractors.map((u) => {
                    const isEditing = editingStaffId === u.id;
                    return (
                      <tr key={u.id}>
                        <td>
                          <div style={{ fontWeight: 600 }}>
                            <Link to={`${employeeProfilePathPrefix}/${u.id}`}>{u.name?.trim() || u.email}</Link>
                          </div>
                          {u.name?.trim() ? (
                            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>{u.email}</div>
                          ) : null}
                          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: 4 }}>
                            {u.isContractor ? 'Contractor' : 'Employee'}
                          </div>
                        </td>
                        <td style={{ minWidth: 200, maxWidth: 320 }}>
                          {isEditing && canEditStaffRoster ? (
                            <div>
                              <label className="input-label" style={{ marginBottom: 6 }}>
                                Countries
                              </label>
                              <select
                                multiple
                                className="input"
                                size={Math.min(12, Math.max(4, countryOptions.length || 4))}
                                value={rosterDraft.assignedCountryNames}
                                onChange={(e) => {
                                  const selected = Array.from(e.target.selectedOptions, (o) => o.value);
                                  setRosterDraft((d) => ({ ...d, assignedCountryNames: selected }));
                                }}
                                aria-label="Countries"
                                style={{ width: '100%' }}
                              >
                                {countryOptions.map((c) => (
                                  <option key={c.id} value={c.name}>
                                    {c.name}
                                  </option>
                                ))}
                              </select>
                              <p
                                style={{
                                  margin: '6px 0 0',
                                  fontSize: 'var(--text-xs)',
                                  color: 'var(--color-text-muted)',
                                }}
                              >
                                Hold Ctrl (Windows) or Cmd (Mac) and click to select multiple countries.
                              </p>
                            </div>
                          ) : (
                            formatCountriesCell(u)
                          )}
                        </td>
                        <td>{formatRolesCell(u.roleNames)}</td>
                        <td>
                          {isEditing && canEditStaffRoster ? (
                            <textarea
                              className="input"
                              rows={3}
                              value={rosterDraft.employmentResponsibilities}
                              onChange={(e) =>
                                setRosterDraft((d) => ({ ...d, employmentResponsibilities: e.target.value }))
                              }
                              aria-label="Responsibilities"
                              style={{ minWidth: 200, resize: 'vertical' }}
                            />
                          ) : (
                            <span style={{ whiteSpace: 'pre-wrap' }}>{u.employmentResponsibilities?.trim() || '—'}</span>
                          )}
                        </td>
                        <td>
                          {isEditing && canEditStaffRoster ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                              <input
                                className="input"
                                type="number"
                                min={0}
                                step="0.01"
                                value={rosterDraft.hourlyRate}
                                onChange={(e) => setRosterDraft((d) => ({ ...d, hourlyRate: e.target.value }))}
                                placeholder="Hourly rate"
                                aria-label="Hourly rate"
                              />
                              <input
                                className="input"
                                value={rosterDraft.currency}
                                onChange={(e) => setRosterDraft((d) => ({ ...d, currency: e.target.value }))}
                                placeholder="USD"
                                maxLength={8}
                                aria-label="Currency"
                              />
                            </div>
                          ) : (
                            formatRateCell(u.hourlyRate, u.currency)
                          )}
                        </td>
                        <td>
                          {isEditing && canEditStaffRoster ? (
                            <textarea
                              className="input"
                              rows={3}
                              value={rosterDraft.employmentNotes}
                              onChange={(e) => setRosterDraft((d) => ({ ...d, employmentNotes: e.target.value }))}
                              aria-label="Notes"
                              style={{ minWidth: 200, resize: 'vertical' }}
                            />
                          ) : (
                            <span style={{ whiteSpace: 'pre-wrap' }}>{u.employmentNotes?.trim() || '—'}</span>
                          )}
                        </td>
                        {canEditStaffRoster ? (
                          <td>
                            {isEditing ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                <button
                                  type="button"
                                  className="btn btn-primary"
                                  disabled={rosterSaveBusy}
                                  onClick={() => void saveStaffRosterRow(u.id)}
                                >
                                  Save
                                </button>
                                <button type="button" className="btn btn-ghost" disabled={rosterSaveBusy} onClick={cancelEditStaffRow}>
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button type="button" className="btn btn-ghost" onClick={() => beginEditStaffRow(u)}>
                                Edit
                              </button>
                            )}
                          </td>
                        ) : null}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="page">
        <header className="page-header">
          <h1 className="page-title">Employee Assignments</h1>
        </header>
        <div className="loading-message">
          <div className="loading-spinner" />
          <p style={{ marginTop: 12 }}>Loading…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page">
        <header className="page-header">
          <h1 className="page-title">Employee Assignments</h1>
        </header>
        <div className="alert-error">{error}</div>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1 className="page-title">Employee Assignments</h1>
      </header>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="card-body">
          <h2 style={{ marginTop: 0 }}>Employee/Contractor → Supplier</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'flex-end' }}>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label">Employee / Contractor</label>
              <select className="input" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} style={{ minWidth: 260 }}>
                <option value="">Select Employee/Contractor</option>
                {employeeContractors.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name?.trim() ? `${a.name} (${a.email})` : a.email}
                  </option>
                ))}
              </select>
            </div>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label">Supplier</label>
              <select className="input" value={employeeSupplierId} onChange={(e) => setEmployeeSupplierId(e.target.value)} style={{ minWidth: 260 }}>
                <option value="">Select Supplier</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code}: {s.name}
                  </option>
                ))}
              </select>
            </div>
            <button type="button" className="btn btn-primary" onClick={() => void assignEmployeeSupplier()} disabled={busy || !employeeId || !employeeSupplierId}>
              Assign
            </button>
          </div>

          <div className="table-wrap" style={{ marginTop: '1rem' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Employee / contractor</th>
                  <th>Type</th>
                  <th>Country</th>
                  <th>Assigned Suppliers</th>
                  <th style={{ width: 100 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {employeeContractors.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="table-empty">
                      No employees/contractors found.
                    </td>
                  </tr>
                ) : (
                  employeeContractors.flatMap((a) => {
                    const supplierIds = a.employeeAssignedSupplierIds ?? [];
                    if (supplierIds.length === 0) {
                      return (
                        <tr key={a.id}>
                          <td>
                            <Link to={`${employeeProfilePathPrefix}/${a.id}`}>{a.name?.trim() ? a.name : a.email}</Link>
                          </td>
                          <td>{a.isContractor ? 'Contractor' : 'Employee'}</td>
                          <td>{formatCountriesCell(a)}</td>
                          <td colSpan={2} className="table-empty">
                            None
                          </td>
                        </tr>
                      );
                    }
                    return supplierIds.map((sid, idx) => {
                      const sup = supplierById[sid];
                      return (
                        <tr key={`${a.id}-${sid}`}>
                          {idx === 0 ? (
                            <>
                              <td rowSpan={supplierIds.length}>
                                <Link to={`${employeeProfilePathPrefix}/${a.id}`}>{a.name?.trim() ? a.name : a.email}</Link>
                              </td>
                              <td rowSpan={supplierIds.length}>{a.isContractor ? 'Contractor' : 'Employee'}</td>
                              <td rowSpan={supplierIds.length}>{formatCountriesCell(a)}</td>
                            </>
                          ) : null}
                          <td>{sup ? `${sup.code}: ${sup.name}` : sid}</td>
                          <td>
                            <button type="button" className="btn btn-ghost" onClick={() => void removeEmployeeSupplier(a.id, sid)} disabled={busy}>
                              Remove
                            </button>
                          </td>
                        </tr>
                      );
                    });
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <h2 style={{ marginTop: 0 }}>Quality Engineer → Buyer</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'flex-end' }}>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label">QE</label>
              <select className="input" value={qeId} onChange={(e) => setQeId(e.target.value)} style={{ minWidth: 260 }}>
                <option value="">Select QE</option>
                {qes.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.name?.trim() ? `${q.name} (${q.email})` : q.email}
                  </option>
                ))}
              </select>
            </div>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label">Buyer</label>
              <select className="input" value={qeBuyerId} onChange={(e) => setQeBuyerId(e.target.value)} style={{ minWidth: 260 }}>
                <option value="">Select Buyer</option>
                {buyers.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name?.trim() ? `${b.name} (${b.email})` : b.email}
                  </option>
                ))}
              </select>
            </div>
            <button type="button" className="btn btn-primary" onClick={() => void assignQeBuyer()} disabled={busy || !qeId || !qeBuyerId}>
              Assign
            </button>
          </div>

          <div className="table-wrap" style={{ marginTop: '1rem' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>QE</th>
                  <th>Buyer</th>
                  <th>Auto-linked Suppliers</th>
                  <th style={{ width: 100 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {qes.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="table-empty">
                      No Quality Engineers. Create a user with Quality Engineer role.
                    </td>
                  </tr>
                ) : (
                  qes.flatMap((q) => {
                    const buyerIds = q.qeAssignedBuyerIds ?? [];
                    if (buyerIds.length === 0) {
                      return (
                        <tr key={q.id}>
                          <td>{q.name?.trim() ? q.name : q.email}</td>
                          <td colSpan={3} className="table-empty">
                            None
                          </td>
                        </tr>
                      );
                    }
                    return buyerIds.map((bid) => {
                      const buyer = buyers.find((b) => b.id === bid);
                      const supplierIds = buyerSupplierIdsByBuyerId[bid] ?? [];
                      const suppliersText =
                        supplierIds.length === 0
                          ? '—'
                          : supplierIds
                              .map((sid) => {
                                const sup = supplierById[sid];
                                return sup ? `${sup.code}: ${sup.name}` : sid;
                              })
                              .join(', ');

                      return (
                        <tr key={`${q.id}-${bid}`}>
                          <td>{q.name?.trim() ? q.name : q.email}</td>
                          <td>{buyer?.name?.trim() ? buyer.name : buyer?.email ?? bid}</td>
                          <td style={{ maxWidth: 420 }} title={suppliersText}>
                            {suppliersText}
                          </td>
                          <td>
                            <button type="button" className="btn btn-ghost" onClick={() => void removeQeBuyer(q.id, bid)} disabled={busy}>
                              Remove
                            </button>
                          </td>
                        </tr>
                      );
                    });
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: '1rem' }}>
        <div className="card-body">
          <h2 style={{ marginTop: 0 }}>Quality Manager → Quality Engineer</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'flex-end' }}>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label">Quality Manager</label>
              <select className="input" value={qmId} onChange={(e) => setQmId(e.target.value)} style={{ minWidth: 260 }}>
                <option value="">Select Quality Manager</option>
                {qualityManagers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name?.trim() ? `${m.name} (${m.email})` : m.email}
                  </option>
                ))}
              </select>
            </div>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label">Quality Engineer</label>
              <select className="input" value={qmQeId} onChange={(e) => setQmQeId(e.target.value)} style={{ minWidth: 260 }}>
                <option value="">Select Quality Engineer</option>
                {qes.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.name?.trim() ? `${q.name} (${q.email})` : q.email}
                  </option>
                ))}
              </select>
            </div>
            <button type="button" className="btn btn-primary" onClick={() => void assignQmQe()} disabled={busy || !qmId || !qmQeId}>
              Assign
            </button>
          </div>

          <div className="table-wrap" style={{ marginTop: '1rem' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Quality Manager</th>
                  <th>Assigned Quality Engineers</th>
                  <th style={{ width: 100 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {qualityManagers.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="table-empty">
                      No Quality Managers. Create a user with Quality Manager role.
                    </td>
                  </tr>
                ) : (
                  qualityManagers.flatMap((m) => {
                    const qeIds = m.qmAssignedQeIds ?? [];
                    if (qeIds.length === 0) {
                      return (
                        <tr key={m.id}>
                          <td>{m.name?.trim() ? m.name : m.email}</td>
                          <td colSpan={2} className="table-empty">
                            None
                          </td>
                        </tr>
                      );
                    }
                    return qeIds.map((qid) => {
                      const qe = qes.find((x) => x.id === qid);
                      return (
                        <tr key={`${m.id}-${qid}`}>
                          <td>{m.name?.trim() ? m.name : m.email}</td>
                          <td>{qe?.name?.trim() ? `${qe.name} (${qe.email})` : qe?.email ?? qid}</td>
                          <td>
                            <button type="button" className="btn btn-ghost" onClick={() => void removeQmQe(m.id, qid)} disabled={busy}>
                              Remove
                            </button>
                          </td>
                        </tr>
                      );
                    });
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

    </div>
  );
}

