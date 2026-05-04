import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiJson } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { SortableTh } from '../../components/SortableTh';
import { getDocumentLocale } from '../../i18n/locale';
import { downloadTableXlsx, type ExportRow } from '../../utils/exportExcel';
import { cmpNum, cmpStr, dateMs, toggleSort, type SortDir } from '../../utils/tableSort';

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

type BuyerRelationshipSortKey =
  | 'buyerName'
  | 'buyerCountry'
  | 'buyerCity'
  | 'firstPurchaseOrderDate'
  | 'totalPurchaseOrders';

export function BuyerRelationshipsPage() {
  const { token } = useAuth();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [buyers, setBuyers] = useState<BuyerRow[]>([]);
  const [orders, setOrders] = useState<PurchaseOrderRow[]>([]);
  const [sort, setSort] = useState<{ key: BuyerRelationshipSortKey | null; dir: SortDir }>({
    key: 'buyerName',
    dir: 'asc',
  });

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

  const sortedRows = useMemo(() => {
    const list = [...rows];
    const { key, dir } = sort;
    if (!key) return list;
    return list.sort((a, b) => {
      switch (key) {
        case 'buyerName':
          return cmpStr(a.buyerName ?? '', b.buyerName ?? '', dir);
        case 'buyerCountry':
          return cmpStr(a.buyerCountry ?? '', b.buyerCountry ?? '', dir);
        case 'buyerCity':
          return cmpStr(a.buyerCity ?? '', b.buyerCity ?? '', dir);
        case 'firstPurchaseOrderDate':
          return cmpNum(
            dateMs(a.firstPurchaseOrderDate),
            dateMs(b.firstPurchaseOrderDate),
            dir
          );
        case 'totalPurchaseOrders':
          return cmpNum(a.totalPurchaseOrders, b.totalPurchaseOrders, dir);
        default:
          return 0;
      }
    });
  }, [rows, sort]);

  const onSortColumn = (columnKey: string) => {
    setSort((prev) => toggleSort(prev, columnKey as BuyerRelationshipSortKey));
  };

  const exportToExcel = useCallback(() => {
    if (sortedRows.length === 0) {
      toast.info('No buyer relationships to export yet.');
      return;
    }
    try {
      const locale = getDocumentLocale();
      const exportRows: ExportRow[] = sortedRows.map((row) => ({
        'Buyer Name': row.buyerName,
        'Buyer Contact Email': row.buyerContactEmail ?? '—',
        'Buyer Country': row.buyerCountry ?? '—',
        'Buyer City': row.buyerCity ?? '—',
        'First Purchase Order Date': row.firstPurchaseOrderDate
          ? new Date(row.firstPurchaseOrderDate).toLocaleDateString(locale, {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })
          : '—',
        'Total Purchase Orders': row.totalPurchaseOrders,
        Notes: row.notes?.trim() ? row.notes : '—',
      }));
      const stamp = new Date().toISOString().slice(0, 10);
      downloadTableXlsx(`Buyer_Relationships_${stamp}`, 'Buyer Relationships', exportRows);
      toast.success('Exported to Excel');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Export failed');
    }
  }, [sortedRows, toast]);

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
      <header
        className="page-header"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <h1 className="page-title" style={{ marginBottom: 0 }}>
          Buyer Relationships
        </h1>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={exportToExcel}
          disabled={loading}
          title="Download the table as an Excel file"
        >
          Export to Excel
        </button>
      </header>

      {error ? <div className="alert-error">{error}</div> : null}

      <div className="card">
        <div className="table-wrap">
          <table className="table table--sticky-header">
            <thead>
              <tr>
                <SortableTh
                  label="Buyer Name"
                  columnKey="buyerName"
                  activeKey={sort.key}
                  dir={sort.dir}
                  onSort={onSortColumn}
                />
                <th>Buyer Contact Email</th>
                <SortableTh
                  label="Buyer Country"
                  columnKey="buyerCountry"
                  activeKey={sort.key}
                  dir={sort.dir}
                  onSort={onSortColumn}
                />
                <SortableTh
                  label="Buyer City"
                  columnKey="buyerCity"
                  activeKey={sort.key}
                  dir={sort.dir}
                  onSort={onSortColumn}
                />
                <SortableTh
                  label="First Purchase Order Date"
                  columnKey="firstPurchaseOrderDate"
                  activeKey={sort.key}
                  dir={sort.dir}
                  onSort={onSortColumn}
                />
                <SortableTh
                  label="Total Purchase Orders"
                  columnKey="totalPurchaseOrders"
                  activeKey={sort.key}
                  dir={sort.dir}
                  onSort={onSortColumn}
                />
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
                sortedRows.map((row) => (
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

