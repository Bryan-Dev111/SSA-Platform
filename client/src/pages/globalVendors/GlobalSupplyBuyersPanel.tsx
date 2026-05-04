import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiJson } from '../../api/client';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { SortableTh } from '../../components/SortableTh';
import { downloadTableXlsx, type ExportRow } from '../../utils/exportExcel';
import { cmpStr, toggleSort, type SortDir } from '../../utils/tableSort';

type ToastApi = {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
};

type BuyerRow = {
  id: string;
  name: string;
  country: string | null;
  city: string | null;
  contactEmail: string | null;
  notes: string | null;
};

type BuyerDraft = {
  name: string;
  country: string;
  city: string;
  contactEmail: string;
  notes: string;
};

const EMPTY_DRAFT: BuyerDraft = {
  name: '',
  country: '',
  city: '',
  contactEmail: '',
  notes: '',
};

type BuyerTableSortKey = 'name' | 'country' | 'city' | 'contactEmail' | 'notes';

export function GlobalSupplyBuyersPanel({
  token,
  toast,
}: {
  token: string | null;
  toast: ToastApi;
}) {
  const [list, setList] = useState<BuyerRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [newDraft, setNewDraft] = useState<BuyerDraft>(EMPTY_DRAFT);
  const [editRow, setEditRow] = useState<BuyerRow | null>(null);
  const [deleteRow, setDeleteRow] = useState<BuyerRow | null>(null);
  const [sort, setSort] = useState<{ key: BuyerTableSortKey | null; dir: SortDir }>({
    key: 'name',
    dir: 'asc',
  });

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const r = await apiJson<{ list: BuyerRow[] }>('/global-supply-options/buyers', {
        token,
      });
      setList(r.list);
    } catch {
      setList([]);
      toast.error('Failed to load buyers');
    }
  }, [token, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const createBuyer = async () => {
    if (!token) return;
    if (!newDraft.name.trim()) {
      toast.error('Buyer name is required');
      return;
    }
    setBusy(true);
    try {
      await apiJson('/global-supply-options/buyers', {
        token,
        method: 'POST',
        body: JSON.stringify({
          name: newDraft.name.trim(),
          country: newDraft.country.trim() || null,
          city: newDraft.city.trim() || null,
          contactEmail: newDraft.contactEmail.trim() || null,
          notes: newDraft.notes.trim() || null,
        }),
      });
      setNewDraft(EMPTY_DRAFT);
      toast.success('Buyer added');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not add buyer');
    } finally {
      setBusy(false);
    }
  };

  const saveEdit = async () => {
    if (!token || !editRow) return;
    if (!editRow.name.trim()) {
      toast.error('Buyer name is required');
      return;
    }
    setBusy(true);
    try {
      await apiJson(`/global-supply-options/buyers/${editRow.id}`, {
        token,
        method: 'PATCH',
        body: JSON.stringify({
          name: editRow.name.trim(),
          country: editRow.country?.trim() || null,
          city: editRow.city?.trim() || null,
          contactEmail: editRow.contactEmail?.trim() || null,
          notes: editRow.notes?.trim() || null,
        }),
      });
      setEditRow(null);
      toast.success('Buyer updated');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not update buyer');
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!token || !deleteRow) return;
    setBusy(true);
    try {
      await apiJson(`/global-supply-options/buyers/${deleteRow.id}`, {
        token,
        method: 'DELETE',
      });
      setDeleteRow(null);
      toast.success('Buyer deleted');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not delete buyer');
    } finally {
      setBusy(false);
    }
  };

  const sortedList = useMemo(() => {
    const arr = [...list];
    const { key, dir } = sort;
    if (!key) return arr;
    return arr.sort((a, b) => {
      switch (key) {
        case 'name':
          return cmpStr(a.name ?? '', b.name ?? '', dir);
        case 'country':
          return cmpStr(a.country ?? '', b.country ?? '', dir);
        case 'city':
          return cmpStr(a.city ?? '', b.city ?? '', dir);
        case 'contactEmail':
          return cmpStr(a.contactEmail ?? '', b.contactEmail ?? '', dir);
        case 'notes':
          return cmpStr(a.notes ?? '', b.notes ?? '', dir);
        default:
          return 0;
      }
    });
  }, [list, sort]);

  const onSortColumn = (columnKey: string) => {
    setSort((prev) => toggleSort(prev, columnKey as BuyerTableSortKey));
  };

  const exportToExcel = useCallback(() => {
    if (sortedList.length === 0) {
      toast.info('No buyers to export yet.');
      return;
    }
    try {
      const rows: ExportRow[] = sortedList.map((row) => ({
        'Buyer Name': row.name,
        Country: row.country ?? '—',
        City: row.city ?? '—',
        'Contact Email': row.contactEmail ?? '—',
        Notes: row.notes ?? '—',
      }));
      const stamp = new Date().toISOString().slice(0, 10);
      downloadTableXlsx(`Global_Supply_Buyers_${stamp}`, 'Buyers', rows);
      toast.success('Exported to Excel');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Export failed');
    }
  }, [sortedList, toast]);

  return (
    <div className="card">
      <div className="card-body">
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            marginBottom: '0.75rem',
          }}
        >
          <h2 style={{ marginTop: 0, marginBottom: 0 }}>Buyers</h2>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={exportToExcel}
            disabled={busy}
            title="Download the buyers table as an Excel file"
          >
            Export to Excel
          </button>
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
            <label className="input-label">Buyer Name</label>
            <input
              className="input"
              value={newDraft.name}
              onChange={(e) => setNewDraft((d) => ({ ...d, name: e.target.value }))}
            />
          </div>
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label">Country</label>
            <input
              className="input"
              value={newDraft.country}
              onChange={(e) => setNewDraft((d) => ({ ...d, country: e.target.value }))}
            />
          </div>
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label">City</label>
            <input
              className="input"
              value={newDraft.city}
              onChange={(e) => setNewDraft((d) => ({ ...d, city: e.target.value }))}
            />
          </div>
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label">Contact Email</label>
            <input
              className="input"
              type="email"
              value={newDraft.contactEmail}
              onChange={(e) =>
                setNewDraft((d) => ({ ...d, contactEmail: e.target.value }))
              }
            />
          </div>
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label">Notes</label>
            <input
              className="input"
              value={newDraft.notes}
              onChange={(e) => setNewDraft((d) => ({ ...d, notes: e.target.value }))}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void createBuyer()}
              disabled={busy}
            >
              Add
            </button>
          </div>
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <SortableTh
                  label="Buyer Name"
                  columnKey="name"
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
                <SortableTh
                  label="City"
                  columnKey="city"
                  activeKey={sort.key}
                  dir={sort.dir}
                  onSort={onSortColumn}
                />
                <SortableTh
                  label="Contact Email"
                  columnKey="contactEmail"
                  activeKey={sort.key}
                  dir={sort.dir}
                  onSort={onSortColumn}
                />
                <SortableTh
                  label="Notes"
                  columnKey="notes"
                  activeKey={sort.key}
                  dir={sort.dir}
                  onSort={onSortColumn}
                />
                <th style={{ width: 170 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.length === 0 ? (
                <tr>
                  <td colSpan={6} className="table-empty">
                    No buyers yet.
                  </td>
                </tr>
              ) : (
                sortedList.map((row) => (
                  <tr key={row.id}>
                    <td>
                      {editRow?.id === row.id ? (
                        <input
                          className="input"
                          value={editRow.name}
                          onChange={(e) =>
                            setEditRow((r) => (r ? { ...r, name: e.target.value } : r))
                          }
                        />
                      ) : (
                        row.name
                      )}
                    </td>
                    <td>
                      {editRow?.id === row.id ? (
                        <input
                          className="input"
                          value={editRow.country ?? ''}
                          onChange={(e) =>
                            setEditRow((r) =>
                              r ? { ...r, country: e.target.value || null } : r
                            )
                          }
                        />
                      ) : (
                        row.country ?? '—'
                      )}
                    </td>
                    <td>
                      {editRow?.id === row.id ? (
                        <input
                          className="input"
                          value={editRow.city ?? ''}
                          onChange={(e) =>
                            setEditRow((r) =>
                              r ? { ...r, city: e.target.value || null } : r
                            )
                          }
                        />
                      ) : (
                        row.city ?? '—'
                      )}
                    </td>
                    <td>
                      {editRow?.id === row.id ? (
                        <input
                          className="input"
                          type="email"
                          value={editRow.contactEmail ?? ''}
                          onChange={(e) =>
                            setEditRow((r) =>
                              r ? { ...r, contactEmail: e.target.value || null } : r
                            )
                          }
                        />
                      ) : (
                        row.contactEmail ?? '—'
                      )}
                    </td>
                    <td>
                      {editRow?.id === row.id ? (
                        <input
                          className="input"
                          value={editRow.notes ?? ''}
                          onChange={(e) =>
                            setEditRow((r) =>
                              r ? { ...r, notes: e.target.value || null } : r
                            )
                          }
                        />
                      ) : (
                        row.notes ?? '—'
                      )}
                    </td>
                    <td>
                      {editRow?.id === row.id ? (
                        <>
                          <button
                            type="button"
                            className="btn btn-primary"
                            style={{ marginRight: 8 }}
                            onClick={() => void saveEdit()}
                            disabled={busy}
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost"
                            onClick={() => setEditRow(null)}
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
                            onClick={() => setEditRow({ ...row })}
                            disabled={busy}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost"
                            onClick={() => setDeleteRow(row)}
                            disabled={busy}
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

      <ConfirmDialog
        open={deleteRow !== null}
        title="Delete buyer?"
        message={deleteRow ? `Delete ${deleteRow.name}?` : ''}
        confirmLabel="Delete"
        variant="danger"
        onCancel={() => setDeleteRow(null)}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}

