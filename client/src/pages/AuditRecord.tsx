/**
 * Audit detail page (read-only): show audit fields and linked findings.
 * Used by CAR page "Audit" column to navigate to corresponding audit.
 */
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiJson } from '../api/client';

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

interface Audit {
  id: string;
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
}

export function AuditRecord() {
  const { token } = useAuth();
  const [searchParams] = useSearchParams();
  const auditId = searchParams.get('id');

  const [audit, setAudit] = useState<Audit | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
          <h1 className="page-title">Audit Record</h1>
        </header>
        <div className="loading-message">
          <div className="loading-spinner" />
          <p style={{ marginTop: 12 }}>Loading…</p>
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
                  {audit.supplier.code} — {audit.supplier.name}
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
                  {audit.auditDate}
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
          </div>
        </div>
      )}
    </div>
  );
}

