/**
 * Audit detail page (read-only): show audit fields and linked findings.
 * Used by CAR page "Audit" column to navigate to corresponding audit.
 */
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { getDocumentLocale } from '../i18n/locale';
import { apiJson } from '../api/client';
import { downloadWithAuthProgress } from '../utils/apiHelpers';

interface Supplier {
  id: string;
  code: string;
  name: string;
}

interface AuditType {
  id: string;
  code: string;
  name: string | null;
}

interface AuditRecordRow {
  id: string;
  name: string;
  hasFile: boolean;
  status: 'PENDING' | 'Approved' | 'Rejected';
  internalOrSupplier: 'internal' | 'supplier';
  createdAt: string;
}

interface Audit {
  id: string;
  supplierId: string;
  code: string;
  auditDate: string;
  auditor: string | null;
  result: 'Passed' | 'Failed' | 'Cancelled' | null;
  summary: string | null;
  scope: string | null;
  notes: string | null;
  derivedStatus: string;
  supplier: Supplier;
  auditType: AuditType | null;
  findingCodes: string[];
  records: AuditRecordRow[];
}

function formatAuditRecordDate(isoOrDateStr: string | null | undefined): string {
  if (!isoOrDateStr) return '—';
  const ymd = isoOrDateStr.trim().slice(0, 10);
  const d = new Date(ymd);
  if (Number.isNaN(d.getTime())) return isoOrDateStr;
  return d.toLocaleDateString(getDocumentLocale(), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatRecordStatusLabel(status: AuditRecordRow['status']): string {
  switch (status) {
    case 'PENDING':
      return 'Pending';
    case 'Approved':
      return 'Approved';
    case 'Rejected':
      return 'Rejected';
    default:
      return status;
  }
}

export function AuditRecord() {
  const { token, user } = useAuth();
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();
  const auditId = searchParams.get('id');

  const [audit, setAudit] = useState<Audit | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingRecordId, setDownloadingRecordId] = useState<string | null>(null);

  const roleNames = user?.roleNames ?? [];
  const canAttachRecord =
    !roleNames.includes('Supplier') &&
    roleNames.some((r) => ['Admin', 'QualityEngineer', 'QualityManager', 'Auditor', 'Buyer'].includes(r));

  const downloadRecord = async (recordId: string, recordName: string) => {
    if (!token) return;
    setDownloadingRecordId(recordId);
    try {
      await downloadWithAuthProgress(`/records/${recordId}/download`, token, recordName, () => {});
    } finally {
      setDownloadingRecordId(null);
    }
  };

  useEffect(() => {
    if (!token) return;
    if (!auditId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    apiJson<Audit>(`/audits/${encodeURIComponent(auditId)}`, { token })
      .then((a) => setAudit(a))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load audit'))
      .finally(() => setLoading(false));
  }, [token, auditId]);

  if (loading) {
    return (
      <div className="page">
        <header className="page-header">
          <h1 className="page-title">{t('page.auditRecord')}</h1>
        </header>
        <div className="loading-message">
          <div className="loading-spinner" />
          <p style={{ marginTop: 12 }}>{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1 className="page-title">
          {audit ? `${audit.code} (${audit.supplier.name})` : 'Audit Record'}
        </h1>
        <p className="page-description">
          {audit ? `Status: ${audit.derivedStatus}` : 'Audit not found or missing id.'}
        </p>
        <p style={{ marginTop: 4 }}>
          <Link to="/audits" style={{ textDecoration: 'none' }}>← Back to Audits</Link>
        </p>
      </header>

      {error && <div className="alert-error">{error}</div>}

      {!audit && !error ? <div className="placeholder-empty"><strong>Audit not found</strong></div> : null}

      {audit && (
        <div className="card">
          <div className="card-body">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="input-label">Supplier</label>
                <div className="input" style={{ userSelect: 'text' }}>
                  {audit.supplier.code}: {audit.supplier.name}
                </div>
              </div>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="input-label">Audit type</label>
                <div className="input" style={{ userSelect: 'text' }}>
                  {audit.auditType ? `${audit.auditType.code}${audit.auditType.name ? ` — ${audit.auditType.name}` : ''}` : '—'}
                </div>
              </div>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="input-label">Audit date</label>
                <div className="input" style={{ userSelect: 'text' }}>
                  {formatAuditRecordDate(audit.auditDate)}
                </div>
              </div>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="input-label">Result</label>
                <div className="input" style={{ userSelect: 'text' }}>
                  {audit.result ?? '—'}
                </div>
              </div>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="input-label">Auditor</label>
                <div className="input" style={{ userSelect: 'text' }}>
                  {audit.auditor?.trim() ? audit.auditor : '—'}
                </div>
              </div>
            </div>

            <div style={{ marginTop: '1rem' }}>
              <label className="input-label">Summary</label>
              <div className="input" style={{ userSelect: 'text', whiteSpace: 'pre-wrap', lineHeight: 1.45 }}>
                {audit.summary?.trim() ? audit.summary : '—'}
              </div>
            </div>

            <div style={{ marginTop: '1rem' }}>
              <label className="input-label">Scope</label>
              <div className="input" style={{ userSelect: 'text', whiteSpace: 'pre-wrap', lineHeight: 1.45 }}>
                {audit.scope?.trim() ? audit.scope : '—'}
              </div>
            </div>

            <div style={{ marginTop: '1rem' }}>
              <label className="input-label">Notes</label>
              <div className="input" style={{ userSelect: 'text' }}>
                {audit.notes ?? '—'}
              </div>
            </div>

            <div style={{ marginTop: '1rem' }}>
              <h2 style={{ marginTop: 0, marginBottom: '0.75rem', fontSize: 'var(--text-lg)' }}>
                Findings
              </h2>
              {audit.findingCodes.length === 0 ? (
                <p className="table-empty" style={{ padding: '1rem', margin: 0 }}>No findings linked.</p>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {audit.findingCodes.map((code) => (
                    <Link
                      key={code}
                      to={`/findings-record?findingId=${encodeURIComponent(code)}`}
                      className="btn btn-ghost"
                      style={{ textDecoration: 'none' }}
                    >
                      {code}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div style={{ marginTop: '1.5rem' }}>
              <h2 style={{ marginTop: 0, marginBottom: '0.75rem', fontSize: 'var(--text-lg)' }}>
                Attachments / records
              </h2>
              {(audit.records?.length ?? 0) === 0 ? (
                <p className="table-empty" style={{ padding: '1rem', margin: 0 }}>No records linked to this audit.</p>
              ) : (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  {(audit.records ?? []).map((r) => (
                    <li
                      key={r.id}
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        gap: '0.5rem 1rem',
                        padding: '0.65rem 0.75rem',
                        border: '1px solid var(--color-border-subtle)',
                        borderRadius: 8,
                        background: 'var(--color-surface-muted, rgba(0,0,0,0.02))',
                      }}
                    >
                      <span style={{ fontWeight: 600, flex: '1 1 160px' }}>{r.name}</span>
                      <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
                        {formatRecordStatusLabel(r.status)} · {r.internalOrSupplier === 'internal' ? 'Internal' : 'Supplier'}
                      </span>
                      <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
                        {formatAuditRecordDate(r.createdAt)}
                      </span>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        style={{ padding: '0.2rem 0.5rem', fontSize: 'var(--text-sm)' }}
                        disabled={!r.hasFile || downloadingRecordId === r.id}
                        onClick={() => r.hasFile && void downloadRecord(r.id, r.name)}
                        title={r.hasFile ? 'Download file' : 'No file attached'}
                      >
                        {downloadingRecordId === r.id ? 'Downloading…' : r.hasFile ? 'Download' : 'No file'}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {canAttachRecord ? (
                <p style={{ marginTop: '0.75rem', marginBottom: 0, fontSize: 'var(--text-sm)' }}>
                  <Link
                    to={`/records?auditId=${encodeURIComponent(audit.id)}&supplierId=${encodeURIComponent(audit.supplierId)}`}
                    className="btn btn-ghost"
                    style={{ fontSize: 'var(--text-sm)', padding: '0.25rem 0.5rem' }}
                  >
                    Manage records for this audit
                  </Link>
                </p>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

