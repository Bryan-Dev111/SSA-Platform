/**
 * Global Vendors — Purchase Orders list and creation modal.
 */
import { FormEvent, useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { apiFetch, apiJson } from '../../api/client';
import type { FarmRow } from './FarmersInformationPage';

type PurchaseOrderRow = {
  id: string;
  code: string;
  farmId: string | null;
  buyerName: string;
  buyerEmail: string | null;
  orderDate: string | null;
  crop: string | null;
  quantityKg: number | null;
  pricePerKg: number | null;
  totalAmount: number | null;
  status: string | null;
  notes: string | null;
  estimatedFarmerDeliveryDate: string | null;
  estimatedArrivalAtBuyer: string | null;
  destinationCountry: string | null;
  portOfDischarge: string | null;
  createdAt: string;
  updatedAt: string;
  farm: {
    id: string;
    code: string;
    farmName: string;
    country: string;
  } | null;
  attachments: {
    id: string;
    kind: string;
    fileName: string | null;
    createdAt: string;
  }[];
};

export function PurchaseOrdersPage() {
  const { token } = useAuth();
  const toast = useToast();
  const [orders, setOrders] = useState<PurchaseOrderRow[]>([]);
  const [farms, setFarms] = useState<FarmRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [attachSavingId, setAttachSavingId] = useState<string | null>(null);

  const [farmId, setFarmId] = useState<string>('');
  const [buyerName, setBuyerName] = useState('');
  const [buyerEmail, setBuyerEmail] = useState('');
  const [crop, setCrop] = useState('');
  const [quantityKg, setQuantityKg] = useState('');
  const [pricePerKg, setPricePerKg] = useState('');
  const [status, setStatus] = useState('');
  const [notes, setNotes] = useState('');
  const [orderDate, setOrderDate] = useState('');
  const [estimatedFarmerDeliveryDate, setEstimatedFarmerDeliveryDate] =
    useState('');
  const [estimatedArrivalAtBuyer, setEstimatedArrivalAtBuyer] =
    useState('');
  const [destinationCountry, setDestinationCountry] = useState('');
  const [portOfDischarge, setPortOfDischarge] = useState('');

  const load = (opts?: { silent?: boolean }) => {
    if (!token) return;
    if (!opts?.silent) setLoading(true);
    setError(null);
    Promise.all([
      apiJson<PurchaseOrderRow[]>('/purchase-orders', { token }),
      apiJson<FarmRow[]>('/farms', { token }),
    ])
      .then(([ordersRes, farmsRes]) => {
        setOrders(ordersRes);
        setFarms(farmsRes);
      })
      .catch((e) =>
        setError(
          e instanceof Error ? e.message : 'Failed to load purchase orders'
        )
      )
      .finally(() => {
        if (!opts?.silent) setLoading(false);
      });
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- token-driven refresh
  }, [token]);

  const closeModal = () => {
    setModalOpen(false);
    setFarmId('');
    setBuyerName('');
    setBuyerEmail('');
    setCrop('');
    setQuantityKg('');
    setPricePerKg('');
    setStatus('');
    setNotes('');
    setOrderDate('');
    setEstimatedFarmerDeliveryDate('');
    setEstimatedArrivalAtBuyer('');
    setDestinationCountry('');
    setPortOfDischarge('');
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    try {
      await apiJson<PurchaseOrderRow>('/purchase-orders', {
        token,
        method: 'POST',
        body: JSON.stringify({
          farmId: farmId || null,
          buyerName,
          buyerEmail: buyerEmail || null,
          orderDate: orderDate || null,
          crop: crop || null,
          quantityKg: quantityKg === '' ? null : Number(quantityKg),
          pricePerKg: pricePerKg === '' ? null : Number(pricePerKg),
          status: status || null,
          notes: notes || null,
          estimatedFarmerDeliveryDate:
            estimatedFarmerDeliveryDate || null,
          estimatedArrivalAtBuyer: estimatedArrivalAtBuyer || null,
          destinationCountry: destinationCountry || null,
          portOfDischarge: portOfDischarge || null,
        }),
      });
      toast.success('Purchase order created');
      closeModal();
      load({ silent: true });
    } catch (err) {
      let msg = 'Could not create purchase order';
      if (err instanceof Error) {
        try {
          const j = JSON.parse(err.message) as { error?: string };
          if (j.error) msg = j.error;
        } catch {
          msg = err.message || msg;
        }
      }
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const attachFile = async (orderId: string, kind: string, file: File) => {
    if (!token) return;
    setAttachSavingId(orderId);
    try {
      const form = new FormData();
      form.append('kind', kind);
      form.append('file', file);
      await apiFetch(`/purchase-orders/${orderId}/attachments`, {
        token,
        method: 'POST',
        body: form,
      });
      toast.success('Attachment uploaded');
      load({ silent: true });
    } catch (err) {
      let msg = 'Could not upload attachment';
      if (err instanceof Error) {
        try {
          const j = JSON.parse(err.message) as { error?: string };
          if (j.error) msg = j.error;
        } catch {
          msg = err.message || msg;
        }
      }
      toast.error(msg);
    } finally {
      setAttachSavingId(null);
    }
  };

  const handleFileInput = (
    orderId: string,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const kind = e.target.getAttribute('data-kind') || 'NoteFile';
    void attachFile(orderId, kind, file);
    // reset input so selecting the same file again still fires change
    e.target.value = '';
  };

  if (loading && orders.length === 0) {
    return (
      <div className="page">
        <header className="page-header">
          <h1 className="page-title">Purchase Orders</h1>
        </header>
        <div className="loading-message">
          <div className="loading-spinner" />
          <p style={{ marginTop: 12 }}>Loading purchase orders…</p>
        </div>
      </div>
    );
  }

  if (error && orders.length === 0) {
    return (
      <div className="page">
        <header className="page-header">
          <h1 className="page-title">Purchase Orders</h1>
        </header>
        <div className="alert-error">{error}</div>
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
        <h1 className="page-title">Purchase Orders</h1>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setModalOpen(true)}
        >
          New purchase order
        </button>
      </header>
      {error && orders.length > 0 && (
        <div className="alert-error" style={{ marginBottom: 12 }}>
          {error}
        </div>
      )}
      <div className="card">
        <div className="table-wrap">
          <table className="table table--sticky-header">
            <thead>
              <tr>
                <th>PO ID</th>
                <th>Farm</th>
                <th>Buyer</th>
                <th>Order date</th>
                <th>Crop</th>
                <th>Qty (kg)</th>
                <th>Price/kg</th>
                <th>Total</th>
                <th>Status</th>
                <th>Est. farmer delivery</th>
                <th>Est. arrival at buyer</th>
                <th>Destination country</th>
                <th>Port of discharge</th>
                <th>Created</th>
                <th>Attachments</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={10} className="table-empty">
                    No purchase orders yet. Use{' '}
                    <strong>New purchase order</strong> to create one.
                  </td>
                </tr>
              ) : (
                orders.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <strong>{o.code}</strong>
                    </td>
                    <td>
                      {o.farm
                        ? `${o.farm.code} — ${o.farm.farmName}`
                        : '—'}
                    </td>
                    <td>
                      <div>{o.buyerName}</div>
                      {o.buyerEmail && (
                        <div
                          style={{
                            fontSize: 'var(--text-xs)',
                            color: 'var(--color-text-muted)',
                          }}
                        >
                          {o.buyerEmail}
                        </div>
                      )}
                    </td>
                    <td>
                      {o.orderDate
                        ? new Date(o.orderDate).toLocaleDateString(
                            undefined,
                            {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            }
                          )
                        : '—'}
                    </td>
                    <td>{o.crop ?? '—'}</td>
                    <td>
                      {o.quantityKg != null ? (
                        <>{o.quantityKg.toLocaleString()}</>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      {o.pricePerKg != null ? (
                        <>${o.pricePerKg.toFixed(2)}</>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      {o.totalAmount != null ? (
                        <>${o.totalAmount.toFixed(2)}</>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>{o.status ?? 'Open'}</td>
                    <td>
                      {o.estimatedFarmerDeliveryDate
                        ? new Date(
                            o.estimatedFarmerDeliveryDate
                          ).toLocaleDateString(undefined, {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })
                        : '—'}
                    </td>
                    <td>
                      {o.estimatedArrivalAtBuyer
                        ? new Date(
                            o.estimatedArrivalAtBuyer
                          ).toLocaleDateString(undefined, {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })
                        : '—'}
                    </td>
                    <td>{o.destinationCountry ?? '—'}</td>
                    <td>{o.portOfDischarge ?? '—'}</td>
                    <td>
                      {new Date(o.createdAt).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>
                    <td style={{ minWidth: 220 }}>
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 4,
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: 4,
                          }}
                        >
                          <label className="btn btn-xs">
                            Invoice
                            <input
                              type="file"
                              style={{ display: 'none' }}
                              data-kind="Invoice"
                              onChange={(e) => handleFileInput(o.id, e)}
                              disabled={attachSavingId === o.id}
                            />
                          </label>
                          <label className="btn btn-xs">
                            Certificate
                            <input
                              type="file"
                              style={{ display: 'none' }}
                              data-kind="Certificate"
                              onChange={(e) => handleFileInput(o.id, e)}
                              disabled={attachSavingId === o.id}
                            />
                          </label>
                          <label className="btn btn-xs">
                            Contract
                            <input
                              type="file"
                              style={{ display: 'none' }}
                              data-kind="Contract"
                              onChange={(e) => handleFileInput(o.id, e)}
                              disabled={attachSavingId === o.id}
                            />
                          </label>
                          <label className="btn btn-xs">
                            Notes file
                            <input
                              type="file"
                              style={{ display: 'none' }}
                              data-kind="NoteFile"
                              onChange={(e) => handleFileInput(o.id, e)}
                              disabled={attachSavingId === o.id}
                            />
                          </label>
                        </div>
                        {o.attachments.length > 0 && (
                          <ul
                            style={{
                              margin: 0,
                              paddingLeft: 16,
                              fontSize: 'var(--text-xs)',
                            }}
                          >
                            {o.attachments.map((a) => (
                              <li key={a.id}>
                                <span>{a.kind}</span>{' '}
                                {a.fileName && (
                                  <span
                                    style={{
                                      color: 'var(--color-text-muted)',
                                    }}
                                  >
                                    — {a.fileName}
                                  </span>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen ? (
        <div
          className="confirm-dialog-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-po-title"
          onClick={closeModal}
          onKeyDown={(ev) => ev.key === 'Escape' && closeModal()}
        >
          <div
            className="confirm-dialog"
            style={{ maxWidth: 640 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="add-po-title" className="confirm-dialog-title">
              New purchase order
            </h3>
            <form
              onSubmit={submit}
              className="stack"
              style={{ gap: 12, marginTop: 16 }}
            >
              <label className="field">
                <span className="field-label">Farm (optional)</span>
                <select
                  className="input"
                  value={farmId}
                  onChange={(e) => setFarmId(e.target.value)}
                >
                  <option value="">No farm selected</option>
                  {farms.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.code} — {f.farmName} ({f.country})
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="field-label">Buyer name</span>
                <input
                  className="input"
                  value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value)}
                  required
                />
              </label>
              <label className="field">
                <span className="field-label">Buyer email</span>
                <input
                  className="input"
                  type="email"
                  value={buyerEmail}
                  onChange={(e) => setBuyerEmail(e.target.value)}
                />
              </label>
              <label className="field">
                <span className="field-label">Order date</span>
                <input
                  className="input"
                  type="date"
                  value={orderDate}
                  onChange={(e) => setOrderDate(e.target.value)}
                />
              </label>
              <label className="field">
                <span className="field-label">Crop</span>
                <input
                  className="input"
                  value={crop}
                  onChange={(e) => setCrop(e.target.value)}
                  placeholder="e.g. Coffee, Cocoa"
                />
              </label>
              <div className="field-grid">
                <label className="field">
                  <span className="field-label">Quantity (kg)</span>
                  <input
                    className="input"
                    type="number"
                    min={0}
                    step={0.01}
                    value={quantityKg}
                    onChange={(e) => setQuantityKg(e.target.value)}
                  />
                </label>
                <label className="field">
                  <span className="field-label">Price per kg</span>
                  <input
                    className="input"
                    type="number"
                    min={0}
                    step={0.01}
                    value={pricePerKg}
                    onChange={(e) => setPricePerKg(e.target.value)}
                  />
                </label>
              </div>
              <label className="field">
                <span className="field-label">Status</span>
                <input
                  className="input"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  placeholder="e.g. Open, Closed"
                />
              </label>
              <div className="field-grid">
                <label className="field">
                  <span className="field-label">
                    Estimated farmer delivery date
                  </span>
                  <input
                    className="input"
                    type="date"
                    value={estimatedFarmerDeliveryDate}
                    onChange={(e) =>
                      setEstimatedFarmerDeliveryDate(e.target.value)
                    }
                  />
                </label>
                <label className="field">
                  <span className="field-label">
                    Estimated arrival at buyer
                  </span>
                  <input
                    className="input"
                    type="date"
                    value={estimatedArrivalAtBuyer}
                    onChange={(e) =>
                      setEstimatedArrivalAtBuyer(e.target.value)
                    }
                  />
                </label>
              </div>
              <div className="field-grid">
                <label className="field">
                  <span className="field-label">Destination country</span>
                  <input
                    className="input"
                    value={destinationCountry}
                    onChange={(e) => setDestinationCountry(e.target.value)}
                  />
                </label>
                <label className="field">
                  <span className="field-label">Port of discharge</span>
                  <input
                    className="input"
                    value={portOfDischarge}
                    onChange={(e) => setPortOfDischarge(e.target.value)}
                  />
                </label>
              </div>
              <label className="field">
                <span className="field-label">Notes</span>
                <textarea
                  className="input"
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </label>
              <div className="confirm-dialog-actions" style={{ marginTop: 8 }}>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={closeModal}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving}
                >
                  {saving ? 'Saving…' : 'Create PO'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

