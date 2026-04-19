/**
 * Admin — Employee Assignments
 * A) Auditor → Supplier
 * B) Quality Engineer → Buyer (QE derives suppliers from Buyer → Suppliers)
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiJson } from '../../api/client';

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

export function AdminEmployeeAssignmentsPanel({
  token,
  toast,
}: {
  token: string | null;
  toast: ToastApi;
}) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [employeeId, setEmployeeId] = useState('');
  const [employeeSupplierId, setEmployeeSupplierId] = useState('');

  const [qeId, setQeId] = useState('');
  const [qeBuyerId, setQeBuyerId] = useState('');
  const [qmId, setQmId] = useState('');
  const [qmQeId, setQmQeId] = useState('');

  const load = useCallback(async () => {
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

  useEffect(() => {
    void load();
  }, [load]);

  const employeeContractors = useMemo(
    () => users.filter((u) => Boolean(u.isEmployee) || Boolean(u.isContractor)),
    [users]
  );
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
      await load();
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
      await load();
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
      await load();
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
      await load();
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
      await load();
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
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Remove failed');
    } finally {
      setBusy(false);
    }
  };

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
                  <th>Auditor</th>
                  <th>Type</th>
                  <th>Assigned Suppliers</th>
                  <th style={{ width: 100 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {employeeContractors.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="table-empty">
                      No employees/contractors found.
                    </td>
                  </tr>
                ) : (
                  employeeContractors.flatMap((a) => {
                    const supplierIds = a.employeeAssignedSupplierIds ?? [];
                    if (supplierIds.length === 0) {
                      return (
                        <tr key={a.id}>
                          <td>{a.name?.trim() ? a.name : a.email}</td>
                          <td>{a.isContractor ? 'Contractor' : 'Employee'}</td>
                          <td colSpan={2} className="table-empty">
                            None
                          </td>
                        </tr>
                      );
                    }
                    return supplierIds.map((sid) => {
                      const sup = supplierById[sid];
                      return (
                        <tr key={`${a.id}-${sid}`}>
                          <td>{a.name?.trim() ? a.name : a.email}</td>
                          <td>{a.isContractor ? 'Contractor' : 'Employee'}</td>
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

