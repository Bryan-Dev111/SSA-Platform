/**
 * Audits page: table (schedule, results, notes); only Admin/QE set result;
 * column with finding #s (clickable → Findings Record).
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
  supplierId: string;
  supplier: Supplier;
  auditTypeId: string | null;
  auditType: AuditType | null;
  auditDate: string;
  result: 'Passed' | 'Failed' | 'Cancelled' | null;
  notes: string | null;
  derivedStatus: string;
  findingCodes: string[];
}

/** Format ISO/YYYY-MM-DD date as locale date string without timezone shift */
function formatCalendarDate(isoOrDateStr: string): string {
  const ymd = isoOrDateStr.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return isoOrDateStr;
  return new Date(ymd + 'T12:00:00').toLocaleDateString();
}

export function Audits() {
  const { token, user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const supplierFilter = searchParams.get('supplierId') ?? '';
  const [audits, setAudits] = useState<Audit[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [auditTypes, setAuditTypes] = useState<AuditType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newAudit, setNewAudit] = useState({ supplierId: '', auditDate: '', auditTypeId: '', notes: '' });
  const [submitting, setSubmitting] = useState(false);
  const roleNames = user?.roleNames ?? [];
  const canSetResult = roleNames.includes('Admin') || roleNames.includes('QualityEngineer');
  const canCreateAudit = roleNames.includes('Admin') || roleNames.includes('QualityEngineer');

  useEffect(() => {
    if (!token) return;
    const q = supplierFilter ? `?supplierId=${encodeURIComponent(supplierFilter)}` : '';
    Promise.all([
      apiJson<Audit[]>(`/audits${q}`, { token }),
      apiJson<Supplier[]>('/suppliers', { token }),
      apiJson<AuditType[]>('/audits/types', { token }),
    ])
      .then(([a, s, t]) => {
        setAudits(a);
        setSuppliers(s);
        setAuditTypes(t);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [token, supplierFilter]);

  const handleSetResult = async (auditId: string, result: 'Passed' | 'Failed' | 'Cancelled') => {
    if (!token) return;
    setUpdatingId(auditId);
    try {
      const updated = await apiJson<Audit>(`/audits/${auditId}`, {
        token,
        method: 'PATCH',
        body: JSON.stringify({ result }),
      });
      setAudits((prev) => prev.map((a) => (a.id === auditId ? updated : a)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleCreateAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !newAudit.supplierId || !newAudit.auditDate) return;
    setSubmitting(true);
    try {
      const created = await apiJson<Audit>('/audits', {
        token,
        method: 'POST',
        body: JSON.stringify({
          supplierId: newAudit.supplierId,
          auditDate: newAudit.auditDate,
          auditTypeId: newAudit.auditTypeId || null,
          notes: newAudit.notes || null,
        }),
      });
      setAudits((prev) => [created, ...prev]);
      setNewAudit({ supplierId: '', auditDate: '', auditTypeId: '', notes: '' });
      setShowNewForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create audit');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="page">
        <header className="page-header">
          <h1 className="page-title">Audits</h1>
        </header>
        <div className="loading-message">
          <div className="loading-spinner" />
          <p style={{ marginTop: 12 }}>Loading audits…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1 className="page-title">Audits</h1>
        <p className="page-description">Schedule and results. Set result (Passed/Failed/Cancelled) as Admin or Quality Engineer.</p>
      </header>

      {error && (
        <div className="alert-error" role="alert">
          {error}
        </div>
      )}

      <div style={{ marginBottom: '1rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
        <label>
          <span style={{ marginRight: 8, fontSize: 'var(--text-sm)' }}>Supplier filter:</span>
          <select
            className="input"
            value={supplierFilter}
            onChange={(e) => {
              const v = e.target.value;
              if (v) setSearchParams({ supplierId: v });
              else setSearchParams({});
            }}
            style={{ width: 'auto', minWidth: 180 }}
          >
            <option value="">All</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code} — {s.name}
              </option>
            ))}
          </select>
        </label>
        {canCreateAudit && (
          <button type="button" className="btn btn-primary" onClick={() => setShowNewForm(!showNewForm)}>
            {showNewForm ? 'Cancel' : 'New audit'}
          </button>
        )}
      </div>

      {showNewForm && canCreateAudit && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="card-body">
            <h2 style={{ marginTop: 0, marginBottom: '1rem', fontSize: 'var(--text-lg)' }}>Schedule new audit</h2>
            <form onSubmit={handleCreateAudit}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                <div className="input-group">
                  <label className="input-label">Supplier *</label>
                  <select
                    className="input"
                    value={newAudit.supplierId}
                    onChange={(e) => setNewAudit((p) => ({ ...p, supplierId: e.target.value }))}
                    required
                  >
                    <option value="">Select</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>{s.code} — {s.name}</option>
                    ))}
                  </select>
                </div>
                <div className="input-group">
                  <label className="input-label">Audit date *</label>
                  <input
                    type="date"
                    className="input"
                    value={newAudit.auditDate}
                    onChange={(e) => setNewAudit((p) => ({ ...p, auditDate: e.target.value }))}
                    required
                  />
                </div>
                <div className="input-group">
                  <label className="input-label">Audit type</label>
                  <select
                    className="input"
                    value={newAudit.auditTypeId}
                    onChange={(e) => setNewAudit((p) => ({ ...p, auditTypeId: e.target.value }))}
                  >
                    <option value="">—</option>
                    {auditTypes.map((t) => (
                      <option key={t.id} value={t.id}>{t.code} {t.name ? `— ${t.name}` : ''}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="input-group" style={{ marginBottom: '1rem' }}>
                <label className="input-label">Notes</label>
                <input
                  type="text"
                  className="input"
                  value={newAudit.notes}
                  onChange={(e) => setNewAudit((p) => ({ ...p, notes: e.target.value }))}
                  placeholder="Optional"
                />
              </div>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Creating…' : 'Create audit'}
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Supplier</th>
                <th>Date</th>
                <th>Type</th>
                <th>Status</th>
                <th>Result</th>
                <th>Notes</th>
                <th>Findings</th>
              </tr>
            </thead>
            <tbody>
              {audits.length === 0 ? (
                <tr>
                  <td colSpan={8} className="table-empty">
                    No audits in scope.
                  </td>
                </tr>
              ) : (
                audits.map((a) => (
                  <tr key={a.id}>
                    <td><strong>{a.code}</strong></td>
                    <td>{a.supplier.code} — {a.supplier.name}</td>
                    <td>{formatCalendarDate(a.auditDate)}</td>
                    <td>{a.auditType ? `${a.auditType.code}${a.auditType.name ? ` ${a.auditType.name}` : ''}` : '—'}</td>
                    <td>{a.derivedStatus}</td>
                    <td>
                      {canSetResult && a.derivedStatus !== 'Cancelled' && a.derivedStatus !== 'Complete' ? (
                        <select
                          className="input"
                          value={a.result ?? ''}
                          onChange={(e) => {
                            const v = e.target.value as 'Passed' | 'Failed' | 'Cancelled';
                            if (v) handleSetResult(a.id, v);
                          }}
                          disabled={updatingId === a.id}
                          style={{ width: 'auto', minWidth: 100 }}
                        >
                          <option value="">—</option>
                          <option value="Passed">Passed</option>
                          <option value="Failed">Failed</option>
                          <option value="Cancelled">Cancelled</option>
                        </select>
                      ) : (
                        a.result ?? '—'
                      )}
                    </td>
                    <td style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={a.notes ?? ''}>
                      {a.notes ?? '—'}
                    </td>
                    <td>
                      {a.findingCodes.length === 0
                        ? '—'
                        : a.findingCodes.map((code) => (
                            <Link
                              key={code}
                              to={`/findings-record?findingId=${encodeURIComponent(code)}`}
                              style={{ display: 'block', marginBottom: 2 }}
                            >
                              {code}
                            </Link>
                          ))}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
