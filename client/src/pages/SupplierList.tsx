/**
 * Supplier List: fetches GET /suppliers (scope: Admin all; Buyer assigned; Supplier own)
 */
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiJson } from '../api/client';

interface Supplier {
  id: string;
  code: string;
  name: string;
  city: string | null;
  country: string | null;
}

export function SupplierList() {
  const { token } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    apiJson<Supplier[]>('/suppliers', { token })
      .then(setSuppliers)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="page">
        <header className="page-header">
          <h1 className="page-title">Supplier List</h1>
          <p className="page-description">Suppliers in your scope.</p>
        </header>
        <div className="loading-message">
          <div className="loading-spinner" />
          <p style={{ marginTop: 12 }}>Loading suppliers…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page">
        <header className="page-header">
          <h1 className="page-title">Supplier List</h1>
        </header>
        <div className="alert-error">{error}</div>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1 className="page-title">Supplier List</h1>
        <p className="page-description">
          Admin sees all; Buyer sees assigned suppliers; Supplier sees own record.
        </p>
      </header>
      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>City</th>
                <th>Country</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="table-empty">
                    No suppliers in scope.
                  </td>
                </tr>
              ) : (
                suppliers.map((s) => (
                  <tr key={s.id}>
                    <td><strong>{s.code}</strong></td>
                    <td>{s.name}</td>
                    <td>{s.city ?? '—'}</td>
                    <td>{s.country ?? '—'}</td>
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
