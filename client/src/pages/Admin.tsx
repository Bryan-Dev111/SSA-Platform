/**
 * Admin: Day 8 reference data + Day 9 audit types, risk weights, buyers/suppliers, permissions.
 */
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { apiJson } from '../api/client';
import { ConfirmDialog } from '../components/ConfirmDialog';
import {
  AdminAuditTypesPanel,
  AdminBuyersSuppliersPanel,
  AdminPermissionsPanel,
  AdminRiskWeightsPanel,
} from './admin/AdminDay9Panels';

type Tab =
  | 'commodity'
  | 'defect'
  | 'disposition'
  | 'auditTypes'
  | 'riskWeights'
  | 'users'
  | 'employees'
  | 'buyersSuppliers'
  | 'permissions';

interface CommodityType {
  id: string;
  name: string;
}

interface CodeRow {
  id: string;
  code: string;
  name: string | null;
  active: boolean;
}

export function Admin() {
  const { token } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('commodity');

  const [commodities, setCommodities] = useState<CommodityType[]>([]);
  const [newCommodityName, setNewCommodityName] = useState('');
  const [editCommodity, setEditCommodity] = useState<{ id: string; name: string } | null>(null);

  const [defects, setDefects] = useState<CodeRow[]>([]);
  const [newDefect, setNewDefect] = useState({ code: '', name: '' });
  const [editDefect, setEditDefect] = useState<CodeRow | null>(null);

  const [dispositions, setDispositions] = useState<CodeRow[]>([]);
  const [newDisposition, setNewDisposition] = useState({ code: '', name: '' });
  const [editDisposition, setEditDisposition] = useState<CodeRow | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<{ kind: Tab; id: string; label: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const loadCommodities = useCallback(async () => {
    if (!token) return;
    try {
      const r = await apiJson<{ list: CommodityType[] }>('/commodity-types', { token });
      setCommodities(r.list);
    } catch {
      setCommodities([]);
      toast.error('Failed to load commodity types');
    }
  }, [token, toast]);

  const loadDefects = useCallback(async () => {
    if (!token) return;
    try {
      const r = await apiJson<{ list: CodeRow[] }>('/defect-codes?all=1', { token });
      setDefects(r.list);
    } catch {
      setDefects([]);
      toast.error('Failed to load defect codes');
    }
  }, [token, toast]);

  const loadDispositions = useCallback(async () => {
    if (!token) return;
    try {
      const r = await apiJson<{ list: CodeRow[] }>('/disposition-codes?all=1', { token });
      setDispositions(r.list);
    } catch {
      setDispositions([]);
      toast.error('Failed to load disposition codes');
    }
  }, [token, toast]);

  useEffect(() => {
    if (!token) return;
    if (tab === 'commodity') loadCommodities();
    if (tab === 'defect') loadDefects();
    if (tab === 'disposition') loadDispositions();
  }, [token, tab, loadCommodities, loadDefects, loadDispositions]);

  const addCommodity = async () => {
    if (!token || !newCommodityName.trim()) return;
    setBusy(true);
    try {
      await apiJson('/commodity-types', {
        token,
        method: 'POST',
        body: JSON.stringify({ name: newCommodityName.trim() }),
      });
      setNewCommodityName('');
      toast.success('Commodity type added');
      await loadCommodities();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Add failed');
    } finally {
      setBusy(false);
    }
  };

  const saveCommodityEdit = async () => {
    if (!token || !editCommodity || !editCommodity.name.trim()) return;
    setBusy(true);
    try {
      await apiJson(`/commodity-types/${editCommodity.id}`, {
        token,
        method: 'PATCH',
        body: JSON.stringify({ name: editCommodity.name.trim() }),
      });
      setEditCommodity(null);
      toast.success('Updated');
      await loadCommodities();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!token || !deleteTarget) return;
    const target = deleteTarget;
    setBusy(true);
    try {
      const path =
        target.kind === 'commodity'
          ? `/commodity-types/${target.id}`
          : target.kind === 'defect'
            ? `/defect-codes/${target.id}`
            : `/disposition-codes/${target.id}`;
      await apiJson(path, { token, method: 'DELETE' });
      toast.success('Deleted');
      setDeleteTarget(null);
      if (target.kind === 'commodity') await loadCommodities();
      if (target.kind === 'defect') await loadDefects();
      if (target.kind === 'disposition') await loadDispositions();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setBusy(false);
    }
  };

  const addDefect = async () => {
    if (!token || !newDefect.code.trim()) return;
    setBusy(true);
    try {
      await apiJson('/defect-codes', {
        token,
        method: 'POST',
        body: JSON.stringify({
          code: newDefect.code.trim(),
          name: newDefect.name.trim() || null,
          active: true,
        }),
      });
      setNewDefect({ code: '', name: '' });
      toast.success('Defect code added');
      await loadDefects();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Add failed');
    } finally {
      setBusy(false);
    }
  };

  const saveDefectEdit = async () => {
    if (!token || !editDefect || !editDefect.code.trim()) return;
    setBusy(true);
    try {
      await apiJson(`/defect-codes/${editDefect.id}`, {
        token,
        method: 'PATCH',
        body: JSON.stringify({
          code: editDefect.code.trim(),
          name: editDefect.name?.trim() || null,
          active: editDefect.active,
        }),
      });
      setEditDefect(null);
      toast.success('Updated');
      await loadDefects();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setBusy(false);
    }
  };

  const addDisposition = async () => {
    if (!token || !newDisposition.code.trim()) return;
    setBusy(true);
    try {
      await apiJson('/disposition-codes', {
        token,
        method: 'POST',
        body: JSON.stringify({
          code: newDisposition.code.trim(),
          name: newDisposition.name.trim() || null,
          active: true,
        }),
      });
      setNewDisposition({ code: '', name: '' });
      toast.success('Disposition code added');
      await loadDispositions();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Add failed');
    } finally {
      setBusy(false);
    }
  };

  const saveDispositionEdit = async () => {
    if (!token || !editDisposition || !editDisposition.code.trim()) return;
    setBusy(true);
    try {
      await apiJson(`/disposition-codes/${editDisposition.id}`, {
        token,
        method: 'PATCH',
        body: JSON.stringify({
          code: editDisposition.code.trim(),
          name: editDisposition.name?.trim() || null,
          active: editDisposition.active,
        }),
      });
      setEditDisposition(null);
      toast.success('Updated');
      await loadDispositions();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setBusy(false);
    }
  };

  const toggleDefectActive = async (row: CodeRow) => {
    if (!token) return;
    setBusy(true);
    try {
      await apiJson(`/defect-codes/${row.id}`, {
        token,
        method: 'PATCH',
        body: JSON.stringify({ active: !row.active }),
      });
      toast.info(!row.active ? 'Activated' : 'Deactivated');
      await loadDefects();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setBusy(false);
    }
  };

  const toggleDispositionActive = async (row: CodeRow) => {
    if (!token) return;
    setBusy(true);
    try {
      await apiJson(`/disposition-codes/${row.id}`, {
        token,
        method: 'PATCH',
        body: JSON.stringify({ active: !row.active }),
      });
      toast.info(!row.active ? 'Activated' : 'Deactivated');
      await loadDispositions();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <header className="page-header">
        <h1 className="page-title">Admin</h1>
        <p className="page-description">
          Reference data (Day 8), audit types & risk weights, buyer/supplier management, and permission matrix (Day 9).
        </p>
      </header>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {(
          [
            ['commodity', 'Commodity types'],
            ['defect', 'Defect codes'],
            ['disposition', 'Disposition codes'],
            ['auditTypes', 'Audit types'],
            ['riskWeights', 'Risk weights'],
            ['users', 'Users'],
            ['employees', 'Employees'],
            ['buyersSuppliers', 'Buyers & suppliers'],
            ['permissions', 'Permissions'],
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

      {tab === 'auditTypes' && <AdminAuditTypesPanel token={token} toast={toast} />}
      {tab === 'riskWeights' && <AdminRiskWeightsPanel token={token} toast={toast} />}
      {tab === 'users' && (
        <AdminBuyersSuppliersPanel
          token={token}
          toast={toast}
          showCreateUser
          showUsersTable
          showBuyerSupplierSections={false}
          usersOnlyEmployees={false}
          usersTableTitle="Users"
        />
      )}
      {tab === 'employees' && (
        <AdminBuyersSuppliersPanel
          token={token}
          toast={toast}
          showCreateUser={false}
          showUsersTable
          showBuyerSupplierSections={false}
          usersOnlyEmployees
          usersTableTitle="Employees"
        />
      )}
      {tab === 'buyersSuppliers' && (
        <AdminBuyersSuppliersPanel
          token={token}
          toast={toast}
          showCreateUser={false}
          showUsersTable={false}
          showBuyerSupplierSections
        />
      )}
      {tab === 'permissions' && <AdminPermissionsPanel token={token} />}

      {tab === 'commodity' && (
        <div className="card">
          <div className="card-body">
            <h2 style={{ marginTop: 0 }}>Commodity types</h2>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div className="input-group" style={{ flex: '1 1 200px', marginBottom: 0 }}>
                <label className="input-label">New name</label>
                <input
                  className="input"
                  value={newCommodityName}
                  onChange={(e) => setNewCommodityName(e.target.value)}
                  placeholder="e.g. Electronics"
                />
              </div>
              <button type="button" className="btn btn-primary" onClick={addCommodity} disabled={busy || !newCommodityName.trim()}>
                Add
              </button>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th style={{ width: 160 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {commodities.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="table-empty">
                        No commodity types yet.
                      </td>
                    </tr>
                  ) : (
                    commodities.map((c) => (
                      <tr key={c.id}>
                        <td>
                          {editCommodity?.id === c.id ? (
                            <input
                              className="input"
                              value={editCommodity.name}
                              onChange={(e) => setEditCommodity({ ...editCommodity, name: e.target.value })}
                            />
                          ) : (
                            c.name
                          )}
                        </td>
                        <td>
                          {editCommodity?.id === c.id ? (
                            <>
                              <button type="button" className="btn btn-primary" style={{ marginRight: 8 }} onClick={saveCommodityEdit} disabled={busy}>
                                Save
                              </button>
                              <button type="button" className="btn btn-ghost" onClick={() => setEditCommodity(null)}>
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                className="btn btn-ghost"
                                style={{ marginRight: 8 }}
                                onClick={() => setEditCommodity({ id: c.id, name: c.name })}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="btn btn-ghost"
                                onClick={() => setDeleteTarget({ kind: 'commodity', id: c.id, label: c.name })}
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

      {tab === 'defect' && (
        <div className="card">
          <div className="card-body">
            <h2 style={{ marginTop: 0 }}>Defect codes</h2>
            <p style={{ marginTop: 0, color: 'var(--color-text-muted)' }}>
              Inactive codes stay on old records but are hidden from new dropdowns.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.5rem', marginBottom: '1rem' }}>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="input-label">Code</label>
                <input className="input" value={newDefect.code} onChange={(e) => setNewDefect((p) => ({ ...p, code: e.target.value }))} placeholder="DC-001" />
              </div>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="input-label">Description</label>
                <input className="input" value={newDefect.name} onChange={(e) => setNewDefect((p) => ({ ...p, name: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <button type="button" className="btn btn-primary" onClick={addDefect} disabled={busy || !newDefect.code.trim()}>
                  Add
                </button>
              </div>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Description</th>
                    <th>Active</th>
                    <th style={{ width: 220 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {defects.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="table-empty">
                        No defect codes yet.
                      </td>
                    </tr>
                  ) : (
                    defects.map((row) => (
                      <tr key={row.id}>
                        <td>
                          {editDefect?.id === row.id ? (
                            <input
                              className="input"
                              value={editDefect.code}
                              onChange={(e) => setEditDefect({ ...editDefect, code: e.target.value })}
                            />
                          ) : (
                            row.code
                          )}
                        </td>
                        <td>
                          {editDefect?.id === row.id ? (
                            <input
                              className="input"
                              value={editDefect.name ?? ''}
                              onChange={(e) => setEditDefect({ ...editDefect, name: e.target.value })}
                            />
                          ) : (
                            row.name ?? '—'
                          )}
                        </td>
                        <td>{row.active ? 'Yes' : 'No'}</td>
                        <td>
                          {editDefect?.id === row.id ? (
                            <>
                              <label style={{ marginRight: 8 }}>
                                <input
                                  type="checkbox"
                                  checked={editDefect.active}
                                  onChange={(e) => setEditDefect({ ...editDefect, active: e.target.checked })}
                                />{' '}
                                Active
                              </label>
                              <button type="button" className="btn btn-primary" style={{ marginRight: 8 }} onClick={saveDefectEdit} disabled={busy}>
                                Save
                              </button>
                              <button type="button" className="btn btn-ghost" onClick={() => setEditDefect(null)}>
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button type="button" className="btn btn-ghost" style={{ marginRight: 8 }} onClick={() => setEditDefect({ ...row })}>
                                Edit
                              </button>
                              <button type="button" className="btn btn-ghost" style={{ marginRight: 8 }} onClick={() => toggleDefectActive(row)} disabled={busy}>
                                {row.active ? 'Deactivate' : 'Activate'}
                              </button>
                              <button
                                type="button"
                                className="btn btn-ghost"
                                onClick={() => setDeleteTarget({ kind: 'defect', id: row.id, label: row.code })}
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

      {tab === 'disposition' && (
        <div className="card">
          <div className="card-body">
            <h2 style={{ marginTop: 0 }}>Disposition codes</h2>
            <p style={{ marginTop: 0, color: 'var(--color-text-muted)' }}>
              Used on Findings (draft). Inactive codes are hidden from new selections.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.5rem', marginBottom: '1rem' }}>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="input-label">Code</label>
                <input
                  className="input"
                  value={newDisposition.code}
                  onChange={(e) => setNewDisposition((p) => ({ ...p, code: e.target.value }))}
                  placeholder="DSP-001"
                />
              </div>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="input-label">Description</label>
                <input className="input" value={newDisposition.name} onChange={(e) => setNewDisposition((p) => ({ ...p, name: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <button type="button" className="btn btn-primary" onClick={addDisposition} disabled={busy || !newDisposition.code.trim()}>
                  Add
                </button>
              </div>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Description</th>
                    <th>Active</th>
                    <th style={{ width: 220 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {dispositions.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="table-empty">
                        No disposition codes yet.
                      </td>
                    </tr>
                  ) : (
                    dispositions.map((row) => (
                      <tr key={row.id}>
                        <td>
                          {editDisposition?.id === row.id ? (
                            <input
                              className="input"
                              value={editDisposition.code}
                              onChange={(e) => setEditDisposition({ ...editDisposition, code: e.target.value })}
                            />
                          ) : (
                            row.code
                          )}
                        </td>
                        <td>
                          {editDisposition?.id === row.id ? (
                            <input
                              className="input"
                              value={editDisposition.name ?? ''}
                              onChange={(e) => setEditDisposition({ ...editDisposition, name: e.target.value })}
                            />
                          ) : (
                            row.name ?? '—'
                          )}
                        </td>
                        <td>{row.active ? 'Yes' : 'No'}</td>
                        <td>
                          {editDisposition?.id === row.id ? (
                            <>
                              <label style={{ marginRight: 8 }}>
                                <input
                                  type="checkbox"
                                  checked={editDisposition.active}
                                  onChange={(e) => setEditDisposition({ ...editDisposition, active: e.target.checked })}
                                />{' '}
                                Active
                              </label>
                              <button type="button" className="btn btn-primary" style={{ marginRight: 8 }} onClick={saveDispositionEdit} disabled={busy}>
                                Save
                              </button>
                              <button type="button" className="btn btn-ghost" onClick={() => setEditDisposition(null)}>
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button type="button" className="btn btn-ghost" style={{ marginRight: 8 }} onClick={() => setEditDisposition({ ...row })}>
                                Edit
                              </button>
                              <button
                                type="button"
                                className="btn btn-ghost"
                                style={{ marginRight: 8 }}
                                onClick={() => toggleDispositionActive(row)}
                                disabled={busy}
                              >
                                {row.active ? 'Deactivate' : 'Activate'}
                              </button>
                              <button
                                type="button"
                                className="btn btn-ghost"
                                onClick={() => setDeleteTarget({ kind: 'disposition', id: row.id, label: row.code })}
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

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete?"
        message={deleteTarget ? `Remove "${deleteTarget.label}"? This cannot be undone.` : ''}
        confirmLabel="Delete"
        variant="danger"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
