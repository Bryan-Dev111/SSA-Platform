import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiJson } from '../../api/client';
import { ConfirmDialog } from '../../components/ConfirmDialog';

interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

type OptionRow = {
  id: string;
  name: string;
};

interface GlobalSupplyMasterDataPanelProps {
  token: string | null;
  toast: ToastApi;
  title: string;
  noun: string;
  endpoint:
    | '/global-supply-options/crops'
    | '/global-supply-options/countries'
    | '/global-supply-options/expense-types';
}

export function GlobalSupplyMasterDataPanel({
  token,
  toast,
  title,
  noun,
  endpoint,
}: GlobalSupplyMasterDataPanelProps) {
  const [list, setList] = useState<OptionRow[]>([]);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [deleteRow, setDeleteRow] = useState<OptionRow | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const r = await apiJson<{ list: OptionRow[] }>(endpoint, { token });
      setList(r.list);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : `Failed to load ${noun.toLowerCase()}`);
      setList([]);
    }
  }, [endpoint, noun, token, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const sortedList = useMemo(
    () => [...list].sort((a, b) => a.name.localeCompare(b.name)),
    [list]
  );

  const add = async () => {
    if (!token) return;
    const value = newName.trim();
    if (!value) {
      toast.error(`${noun} name is required`);
      return;
    }
    setBusy(true);
    try {
      await apiJson(endpoint, {
        token,
        method: 'POST',
        body: JSON.stringify({ name: value }),
      });
      setNewName('');
      toast.success(`${noun} added`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : `Could not add ${noun.toLowerCase()}`);
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!token || !editId) return;
    const value = editName.trim();
    if (!value) {
      toast.error(`${noun} name is required`);
      return;
    }
    setBusy(true);
    try {
      await apiJson(`${endpoint}/${editId}`, {
        token,
        method: 'PATCH',
        body: JSON.stringify({ name: value }),
      });
      setEditId(null);
      setEditName('');
      toast.success(`${noun} updated`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : `Could not update ${noun.toLowerCase()}`);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!token || !deleteRow) return;
    setBusy(true);
    try {
      await apiJson(`${endpoint}/${deleteRow.id}`, { token, method: 'DELETE' });
      toast.success(`${noun} deleted`);
      setDeleteRow(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : `Could not delete ${noun.toLowerCase()}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card">
      <div className="card-body">
        <h2 style={{ marginTop: 0 }}>{title}</h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto',
            gap: 8,
            marginBottom: '0.8rem',
          }}
        >
          <input
            className="input"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={`Add ${noun.toLowerCase()}...`}
            disabled={busy}
          />
          <button type="button" className="btn btn-primary" onClick={() => void add()} disabled={busy}>
            Add
          </button>
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{noun}</th>
                <th style={{ width: 220 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedList.length === 0 ? (
                <tr>
                  <td colSpan={2} className="table-empty">
                    No {noun.toLowerCase()} values yet.
                  </td>
                </tr>
              ) : (
                sortedList.map((row) => (
                  <tr key={row.id}>
                    <td>
                      {editId === row.id ? (
                        <input
                          className="input"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          disabled={busy}
                        />
                      ) : (
                        row.name
                      )}
                    </td>
                    <td>
                      {editId === row.id ? (
                        <>
                          <button
                            type="button"
                            className="btn btn-primary"
                            style={{ marginRight: 8 }}
                            onClick={() => void save()}
                            disabled={busy}
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost"
                            onClick={() => {
                              setEditId(null);
                              setEditName('');
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
                              setEditId(row.id);
                              setEditName(row.name);
                            }}
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
        open={!!deleteRow}
        title={`Delete ${noun.toLowerCase()}?`}
        message={
          deleteRow
            ? `Delete "${deleteRow.name}"? This value will no longer appear in selector lists.`
            : ''
        }
        confirmLabel="Delete"
        variant="danger"
        onCancel={() => setDeleteRow(null)}
        onConfirm={() => void remove()}
      />
    </div>
  );
}
