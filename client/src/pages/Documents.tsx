/**
 * Day 10: Policies, SOPs, etc. — list & view for authorized roles; Admin/QE manage.
 */
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';
import { apiJson } from '../api/client';
import { parseApiError, downloadWithAuthProgress } from '../utils/apiHelpers';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { SortableTh } from '../components/SortableTh';
import { cmpNum, cmpStr, dateMs, toggleSort, type SortDir } from '../utils/tableSort';
import { commandMediaDocumentTypeLabel } from '../constants/commandMedia';

interface DocumentRow {
  id: string;
  documentNumber: string;
  name: string;
  revision: string | null;
  documentType: string;
  filePath: string | null;
  createdAt: string;
}

interface DocumentApiRow {
  id: string;
  documentNumber: string;
  name: string;
  category: string | null;
  documentType: string;
  filePath: string | null;
  createdAt: string;
}

function formatCommandMediaDate(iso: string | undefined, locale: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' });
}

function translatedCommandMediaType(
  documentType: string,
  translate: (key: string, defaultValue?: string) => string
): string {
  return translate(`commandMedia.type.${documentType}`, commandMediaDocumentTypeLabel(documentType));
}

export function Documents() {
  const { token, user } = useAuth();
  const { t, locale } = useLanguage();
  const toast = useToast();
  const [rows, setRows] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<Record<string, number>>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [tableSort, setTableSort] = useState<{ key: string | null; dir: SortDir }>({ key: null, dir: 'asc' });

  const sortedRows = useMemo(() => {
    if (!tableSort.key) return rows;
    const { key: k, dir } = tableSort;
    const list = [...rows];
    list.sort((a, b) => {
      switch (k) {
        case 'type':
          return cmpStr(
            translatedCommandMediaType(a.documentType, t),
            translatedCommandMediaType(b.documentType, t),
            dir
          );
        case 'number':
          return cmpStr(a.documentNumber, b.documentNumber, dir);
        case 'name':
          return cmpStr(a.name, b.name, dir);
        case 'revision':
          return cmpStr(a.revision ?? '', b.revision ?? '', dir);
        case 'created':
          return cmpNum(dateMs(a.createdAt), dateMs(b.createdAt), dir);
        default:
          return 0;
      }
    });
    return list;
  }, [rows, tableSort, t]);

  const canMutate =
    (user?.roleNames?.includes('Admin') ?? false) ||
    (user?.roleNames?.includes('QualityEngineer') ?? false) ||
    (user?.roleNames?.includes('QualityManager') ?? false);
  const totalCount = sortedRows.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const pageSafe = Math.min(page, totalPages) || 1;
  const paginatedRows = sortedRows.slice((pageSafe - 1) * pageSize, pageSafe * pageSize);

  const load = () => {
    if (!token) return;
    apiJson<DocumentApiRow[]>('/documents', { token })
      .then((list) =>
        setRows(
          list.map((r) => ({
            ...r,
            revision: r.category,
          }))
        )
      )
      .catch((e) => setError(parseApiError(e)));
  };

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    setError(null);
    apiJson<DocumentApiRow[]>('/documents', { token })
      .then((list) =>
        setRows(
          list.map((r) => ({
            ...r,
            revision: r.category,
          }))
        )
      )
      .catch((e) => setError(parseApiError(e)))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(sortedRows.length / pageSize));
    if (page > maxPage) setPage(maxPage);
  }, [sortedRows.length, page, pageSize]);

  const remove = async (id: string) => {
    if (!token) return;
    setDeleteConfirmId(null);
    setDeletingId(id);
    try {
      await apiJson(`/documents/${id}`, { token, method: 'DELETE' });
      toast.success(t('documents.toastDeleted'));
      load();
    } catch (e) {
      toast.error(parseApiError(e));
    } finally {
      setDeletingId(null);
    }
  };

  const download = async (r: DocumentRow) => {
    if (!token || !r.filePath) {
      toast.error(t('toast.noFileAttached'));
      return;
    }
    try {
      setDownloading((prev) => ({ ...prev, [r.id]: 0 }));
      await downloadWithAuthProgress(`/documents/${r.id}/download`, token, `${r.documentNumber}-${r.name}`, (p) => {
        setDownloading((prev) => ({ ...prev, [r.id]: p }));
      });
      toast.success(t('toast.downloadCompleted'));
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

  return (
    <div className="page">
      <header className="page-header">
        <h1 className="page-title">{t('admin.tab.commandMedia')}</h1>
      </header>

      {error && <div className="alert-error">{error}</div>}

      <div className="card">
        <div className="card-body">
          <h2 style={{ marginTop: 0 }}>{t('documents.libraryTitle')}</h2>
          <div className="table-wrap">
            {loading ? (
              <p className="table-empty">{t('common.loading')}</p>
            ) : rows.length === 0 ? (
              <p className="table-empty">{t('documents.empty')}</p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <SortableTh
                      label={t('documents.col.type')}
                      columnKey="type"
                      activeKey={tableSort.key}
                      dir={tableSort.dir}
                      onSort={(col) => setTableSort((p) => toggleSort(p, col))}
                    />
                    <SortableTh
                      label={t('documents.col.number')}
                      columnKey="number"
                      activeKey={tableSort.key}
                      dir={tableSort.dir}
                      onSort={(col) => setTableSort((p) => toggleSort(p, col))}
                    />
                    <SortableTh
                      label={t('documents.col.name')}
                      columnKey="name"
                      activeKey={tableSort.key}
                      dir={tableSort.dir}
                      onSort={(col) => setTableSort((p) => toggleSort(p, col))}
                    />
                    <SortableTh
                      label={t('documents.col.revision')}
                      columnKey="revision"
                      activeKey={tableSort.key}
                      dir={tableSort.dir}
                      onSort={(col) => setTableSort((p) => toggleSort(p, col))}
                    />
                    <SortableTh
                      label={t('documents.col.created')}
                      columnKey="created"
                      activeKey={tableSort.key}
                      dir={tableSort.dir}
                      onSort={(col) => setTableSort((p) => toggleSort(p, col))}
                    />
                    <th>{t('table.col.view')}</th>
                    {canMutate ? <th /> : null}
                  </tr>
                </thead>
                <tbody>
                  {paginatedRows.map((r) => (
                    <tr key={r.id}>
                      <td>{translatedCommandMediaType(r.documentType, t)}</td>
                      <td>{r.documentNumber}</td>
                      <td>{r.name}</td>
                      <td>{r.revision ?? '—'}</td>
                      <td>{formatCommandMediaDate(r.createdAt, locale)}</td>
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
                              t('common.download')
                            )}
                          </button>
                        ) : (
                          '—'
                        )}
                      </td>
                      {canMutate ? (
                        <td>
                          <button
                            type="button"
                            className="btn btn-danger"
                            disabled={deletingId === r.id}
                            onClick={() => setDeleteConfirmId(r.id)}
                          >
                            {t('common.delete')}
                          </button>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          {rows.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '1rem', paddingTop: '0.75rem' }}>
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
                {t('table.paginationRange', {
                  start: (pageSafe - 1) * pageSize + 1,
                  end: Math.min(pageSafe * pageSize, totalCount),
                  total: totalCount,
                })}
              </span>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: 'var(--text-sm)' }}>
                {t('table.rowsPerPage')}
                <select
                  className="input"
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  style={{ width: 'auto' }}
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </label>
              <div style={{ display: 'flex', gap: '0.25rem' }}>
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={pageSafe <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  {t('table.previous')}
                </button>
                <span style={{ alignSelf: 'center', fontSize: 'var(--text-sm)' }}>
                  {t('table.pageOf', { page: pageSafe, pages: totalPages })}
                </span>
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={pageSafe >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  {t('table.next')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      <ConfirmDialog
        open={deleteConfirmId !== null}
        title="Delete document"
        message="Delete this document? This cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => {
          if (!deleteConfirmId) return;
          void remove(deleteConfirmId);
        }}
        onCancel={() => setDeleteConfirmId(null)}
      />
    </div>
  );
}
