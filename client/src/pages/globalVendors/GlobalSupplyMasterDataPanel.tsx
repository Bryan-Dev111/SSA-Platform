import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiJson } from '../../api/client';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { useLanguage } from '../../context/LanguageContext';

interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

type OptionRow = {
  id: string;
  name: string;
};

export type GlobalSupplyMasterEntity = 'crops' | 'countries' | 'expenseTypes';

interface GlobalSupplyMasterDataPanelProps {
  token: string | null;
  toast: ToastApi;
  entity: GlobalSupplyMasterEntity;
  endpoint:
    | '/global-supply-options/crops'
    | '/global-supply-options/countries'
    | '/global-supply-options/expense-types'
    | '/supplier-assurance-options/expense-types';
}

export function GlobalSupplyMasterDataPanel({
  token,
  toast,
  entity,
  endpoint,
}: GlobalSupplyMasterDataPanelProps) {
  const { t } = useLanguage();
  const pfx = `gvAdmin.masterData.${entity}` as const;

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
      toast.error(e instanceof Error ? e.message : t(`${pfx}.loadFailed`));
      setList([]);
    }
  }, [endpoint, token, toast, t, pfx]);

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
      toast.error(t(`${pfx}.nameRequired`));
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
      toast.success(t(`${pfx}.added`));
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t(`${pfx}.addFailed`));
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!token || !editId) return;
    const value = editName.trim();
    if (!value) {
      toast.error(t(`${pfx}.nameRequired`));
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
      toast.success(t(`${pfx}.updated`));
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t(`${pfx}.updateFailed`));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!token || !deleteRow) return;
    setBusy(true);
    try {
      await apiJson(`${endpoint}/${deleteRow.id}`, { token, method: 'DELETE' });
      toast.success(t(`${pfx}.deleted`));
      setDeleteRow(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t(`${pfx}.deleteFailed`));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card">
      <div className="card-body">
        <h2 style={{ marginTop: 0 }}>{t(`${pfx}.title`)}</h2>
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
            placeholder={t(`${pfx}.placeholder`)}
            disabled={busy}
          />
          <button type="button" className="btn btn-primary" onClick={() => void add()} disabled={busy}>
            {t('gvAdmin.masterData.common.add')}
          </button>
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t(`${pfx}.column`)}</th>
                <th style={{ width: 220 }}>{t('gvAdmin.masterData.common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {sortedList.length === 0 ? (
                <tr>
                  <td colSpan={2} className="table-empty">
                    {t(`${pfx}.empty`)}
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
                            {t('common.save')}
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
                            {t('common.cancel')}
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
                            {t('common.edit')}
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost"
                            onClick={() => setDeleteRow(row)}
                            disabled={busy}
                          >
                            {t('common.delete')}
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
        title={t(`${pfx}.deleteTitle`)}
        message={deleteRow ? t(`${pfx}.deleteMessage`, { name: deleteRow.name }) : ''}
        confirmLabel={t('common.delete')}
        variant="danger"
        onCancel={() => setDeleteRow(null)}
        onConfirm={() => void remove()}
      />
    </div>
  );
}
