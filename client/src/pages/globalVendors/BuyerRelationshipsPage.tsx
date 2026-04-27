import { useEffect, useMemo, useState } from 'react';
import { apiJson } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { getDocumentLocale } from '../../i18n/locale';

type BuyerRow = {
  id: string;
  name: string;
  country: string | null;
  city: string | null;
  contactEmail: string | null;
  notes: string | null;
};

type PurchaseOrderRow = {
  buyerName: string;
  buyerEmail: string | null;
  orderDate: string | null;
  createdAt: string;
};

type BuyerRelationshipRow = {
  id: string;
  buyerName: string;
  buyerContactEmail: string | null;
  buyerCountry: string | null;
  buyerCity: string | null;
  firstPurchaseOrderDate: string | null;
  totalPurchaseOrders: number;
  notes: string | null;
};

function normalizeText(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

export function BuyerRelationshipsPage() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [buyers, setBuyers] = useState<BuyerRow[]>([]);
  const [orders, setOrders] = useState<PurchaseOrderRow[]>([]);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    setError(null);
    Promise.all([
      apiJson<{ list: BuyerRow[] }>('/global-supply-options/buyers', { token }),
      apiJson<PurchaseOrderRow[]>('/purchase-orders', { token }),
    ])
      .then(([buyersRes, poRes]) => {
        setBuyers(buyersRes.list);
        setOrders(poRes);
      })
      .catch((e) =>
        setError(e instanceof Error ? e.message : 'Failed to load buyer relationships')
      )
      .finally(() => setLoading(false));
  }, [token]);

  const rows = useMemo<BuyerRelationshipRow[]>(() => {
    return buyers.map((buyer) => {
      const buyerEmail = normalizeText(buyer.contactEmail);
      const buyerName = normalizeText(buyer.name);

      const relatedOrders = orders.filter((order) => {
        const poEmail = normalizeText(order.buyerEmail);
        if (buyerEmail && poEmail) return poEmail === buyerEmail;
        return normalizeText(order.buyerName) === buyerName;
      });

      let firstPoDate: string | null = null;
      for (const order of relatedOrders) {
        const candidate = order.orderDate || order.createdAt || null;
        if (!candidate) continue;
        if (!firstPoDate || new Date(candidate).getTime() < new Date(firstPoDate).getTime()) {
          firstPoDate = candidate;
        }
      }

      return {
        id: buyer.id,
        buyerName: buyer.name,
        buyerContactEmail: buyer.contactEmail,
        buyerCountry: buyer.country,
        buyerCity: buyer.city,
        firstPurchaseOrderDate: firstPoDate,
        totalPurchaseOrders: relatedOrders.length,
        notes: buyer.notes,
      };
    });
  }, [buyers, orders]);

  if (loading) {
    return (
      <div className="page">
        <header className="page-header">
          <h1 className="page-title">Buyer Relationships</h1>
        </header>
        <div className="loading-message">
          <div className="loading-spinner" />
          <p style={{ marginTop: 12 }}>Loading buyer relationships...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1 className="page-title">Buyer Relationships</h1>
      </header>

      {error ? <div className="alert-error">{error}</div> : null}

      <div className="card">
        <div className="table-wrap">
          <table className="table table--sticky-header">
            <thead>
              <tr>
                <th>Buyer Name</th>
                <th>Buyer Contact Email</th>
                <th>Buyer Country</th>
                <th>Buyer City</th>
                <th>First Purchase Order Date</th>
                <th>Total Purchase Orders</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="table-empty">
                    No buyers yet. Add buyers in Admin - Buyers.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.buyerName}</td>
                    <td>{row.buyerContactEmail ?? '—'}</td>
                    <td>{row.buyerCountry ?? '—'}</td>
                    <td>{row.buyerCity ?? '—'}</td>
                    <td>
                      {row.firstPurchaseOrderDate
                        ? new Date(row.firstPurchaseOrderDate).toLocaleDateString(getDocumentLocale(), {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })
                        : '—'}
                    </td>
                    <td>{row.totalPurchaseOrders}</td>
                    <td>{row.notes?.trim() ? row.notes : '—'}</td>
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

