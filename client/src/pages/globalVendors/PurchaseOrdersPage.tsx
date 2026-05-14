/**
 * Global Vendors — Purchase Orders list and creation modal.
 */
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useLanguage } from '../../context/LanguageContext';
import { apiFetch, apiJson } from '../../api/client';
import type { FarmRow } from './FarmersInformationPage';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { downloadTableXlsx, type ExportRow } from '../../utils/exportExcel';

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

type CropOption = {
  id: string;
  name: string;
};

type CountryOption = {
  id: string;
  name: string;
};

type BuyerOption = {
  id: string;
  name: string;
  contactEmail: string | null;
};

function dateInputFromIso(iso: string | null | undefined): string {
  if (!iso) return '';
  return iso.slice(0, 10);
}

export function PurchaseOrdersPage({
  /** When false (default), list is read-only: no create/edit/close/attachments/reopen. */
  canCreatePurchaseOrder = false,
}: {
  canCreatePurchaseOrder?: boolean;
}) {
  const { token } = useAuth();
  const { t, locale } = useLanguage();
  const canManagePOs = canCreatePurchaseOrder;
  const toast = useToast();
  const [orders, setOrders] = useState<PurchaseOrderRow[]>([]);
  const [farms, setFarms] = useState<FarmRow[]>([]);
  const [cropOptions, setCropOptions] = useState<CropOption[]>([]);
  const [countryOptions, setCountryOptions] = useState<CountryOption[]>([]);
  const [buyerOptions, setBuyerOptions] = useState<BuyerOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [attachSavingId, setAttachSavingId] = useState<string | null>(null);
  const [closingId, setClosingId] = useState<string | null>(null);
  const [reopeningId, setReopeningId] = useState<string | null>(null);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [editOrderId, setEditOrderId] = useState<string | null>(null);

  const [farmId, setFarmId] = useState<string>('');
  const [buyerName, setBuyerName] = useState('');
  const [buyerEmail, setBuyerEmail] = useState('');
  const [crop, setCrop] = useState('');
  const [quantityKg, setQuantityKg] = useState('');
  const [pricePerKg, setPricePerKg] = useState('');
  const [notes, setNotes] = useState('');
  const [orderDate, setOrderDate] = useState('');
  const [estimatedFarmerDeliveryDate, setEstimatedFarmerDeliveryDate] =
    useState('');
  const [estimatedArrivalAtBuyer, setEstimatedArrivalAtBuyer] =
    useState('');
  const [destinationCountry, setDestinationCountry] = useState('');
  const [portOfDischarge, setPortOfDischarge] = useState('');
  const [closeConfirmOrder, setCloseConfirmOrder] = useState<PurchaseOrderRow | null>(null);
  const [reopenConfirmOrder, setReopenConfirmOrder] = useState<PurchaseOrderRow | null>(null);
  const topScrollRef = useRef<HTMLDivElement | null>(null);
  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const tableRef = useRef<HTMLTableElement | null>(null);
  const [topScrollInnerWidth, setTopScrollInnerWidth] = useState(0);

  const load = (opts?: { silent?: boolean }) => {
    if (!token) return;
    if (!opts?.silent) setLoading(true);
    setError(null);
    Promise.all([
      apiJson<PurchaseOrderRow[]>('/purchase-orders', { token }),
      apiJson<FarmRow[]>('/farms', { token }),
      apiJson<{ list: CropOption[] }>('/global-supply-options/crops', { token }).catch(
        () => ({ list: [] as CropOption[] })
      ),
      apiJson<{ list: CountryOption[] }>('/global-supply-options/countries', { token }).catch(
        () => ({ list: [] as CountryOption[] })
      ),
      apiJson<{ list: BuyerOption[] }>('/global-supply-options/buyers', { token }).catch(
        () => ({ list: [] as BuyerOption[] })
      ),
    ])
      .then(([ordersRes, farmsRes, cropsRes, countriesRes, buyersRes]) => {
        setOrders(ordersRes);
        setFarms(farmsRes);
        setCropOptions(cropsRes.list);
        setCountryOptions(countriesRes.list);
        setBuyerOptions(buyersRes.list);
      })
      .catch((e) =>
        setError(
          e instanceof Error ? e.message : t('purchaseOrders.loadFailed')
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

  useEffect(() => {
    const syncTopTrackWidth = () => {
      setTopScrollInnerWidth(tableRef.current?.scrollWidth ?? 0);
    };
    syncTopTrackWidth();
    window.addEventListener('resize', syncTopTrackWidth);
    return () => window.removeEventListener('resize', syncTopTrackWidth);
  }, [orders, loading]);

  const buyerNameOptions = useMemo(() => {
    const names = new Set<string>();
    buyerOptions.forEach((option) => {
      const name = option.name.trim();
      if (name) names.add(name);
    });
    if (buyerName.trim()) names.add(buyerName.trim());
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [buyerOptions, buyerName]);

  const buyerEmailOptions = useMemo(() => {
    const emails = new Set<string>();
    buyerOptions.forEach((option) => {
      const email = option.contactEmail?.trim();
      if (!email) return;
      if (!buyerName.trim() || option.name.trim() === buyerName.trim()) {
        emails.add(email);
      }
    });
    if (buyerEmail.trim()) emails.add(buyerEmail.trim());
    return [...emails].sort((a, b) => a.localeCompare(b));
  }, [buyerOptions, buyerName, buyerEmail]);

  const resetFormFields = () => {
    setFarmId('');
    setBuyerName('');
    setBuyerEmail('');
    setCrop('');
    setQuantityKg('');
    setPricePerKg('');
    setNotes('');
    setOrderDate('');
    setEstimatedFarmerDeliveryDate('');
    setEstimatedArrivalAtBuyer('');
    setDestinationCountry('');
    setPortOfDischarge('');
  };

  const closeModal = () => {
    setModalOpen(false);
    resetFormFields();
    setFormMode('create');
    setEditOrderId(null);
  };

  const openCreateModal = () => {
    if (!canManagePOs) return;
    resetFormFields();
    setFormMode('create');
    setEditOrderId(null);
    setModalOpen(true);
  };

  const openEditModal = (o: PurchaseOrderRow) => {
    if (!canManagePOs) return;
    setFormMode('edit');
    setEditOrderId(o.id);
    setFarmId(o.farmId ?? '');
    setBuyerName(o.buyerName);
    setBuyerEmail(o.buyerEmail ?? '');
    setCrop(o.crop ?? '');
    setQuantityKg(o.quantityKg != null ? String(o.quantityKg) : '');
    setPricePerKg(o.pricePerKg != null ? String(o.pricePerKg) : '');
    setNotes(o.notes ?? '');
    setOrderDate(dateInputFromIso(o.orderDate));
    setEstimatedFarmerDeliveryDate(dateInputFromIso(o.estimatedFarmerDeliveryDate));
    setEstimatedArrivalAtBuyer(dateInputFromIso(o.estimatedArrivalAtBuyer));
    setDestinationCountry(o.destinationCountry ?? '');
    setPortOfDischarge(o.portOfDischarge ?? '');
    setModalOpen(true);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token || !canManagePOs) return;
    setSaving(true);
    try {
      const payload = {
        farmId: farmId || null,
        buyerName,
        buyerEmail: buyerEmail || null,
        orderDate: orderDate || null,
        crop: crop || null,
        quantityKg: quantityKg === '' ? null : Number(quantityKg),
        pricePerKg: pricePerKg === '' ? null : Number(pricePerKg),
        notes: notes || null,
        estimatedFarmerDeliveryDate:
          estimatedFarmerDeliveryDate || null,
        estimatedArrivalAtBuyer: estimatedArrivalAtBuyer || null,
        destinationCountry: destinationCountry || null,
        portOfDischarge: portOfDischarge || null,
      };

      if (formMode === 'edit' && editOrderId) {
        await apiJson<PurchaseOrderRow>(`/purchase-orders/${editOrderId}`, {
          token,
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        toast.success(t('toast.purchaseOrderUpdated'));
      } else {
        await apiJson<PurchaseOrderRow>('/purchase-orders', {
          token,
          method: 'POST',
          body: JSON.stringify(payload),
        });
        toast.success(t('toast.purchaseOrderCreated'));
      }
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

  const uploadAttachments = async (orderId: string, files: FileList | File[]) => {
    if (!token || !canManagePOs) return;
    const arr = Array.from(files);
    if (arr.length === 0) return;
    setAttachSavingId(orderId);
    try {
      for (const file of arr) {
        const form = new FormData();
        form.append('file', file);
        const res = await apiFetch(`/purchase-orders/${orderId}/attachments`, {
          token,
          method: 'POST',
          body: form,
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || `HTTP ${res.status}`);
        }
      }
      toast.success(
        arr.length === 1 ? 'Attachment uploaded' : `${arr.length} attachments uploaded`
      );
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

  const handleAttachmentFiles = (
    orderId: string,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const list = e.target.files;
    if (!list?.length) return;
    void uploadAttachments(orderId, list);
    e.target.value = '';
  };

  const openAttachmentDownload = async (orderId: string, attachmentId: string) => {
    if (!token) return;
    try {
      const r = await apiJson<{ url: string }>(
        `/purchase-orders/${orderId}/attachments/${attachmentId}/url`,
        { token }
      );
      window.open(r.url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      let msg = 'Could not open attachment';
      if (err instanceof Error) {
        try {
          const j = JSON.parse(err.message) as { error?: string };
          if (j.error) msg = j.error;
        } catch {
          msg = err.message || msg;
        }
      }
      toast.error(msg);
    }
  };

  const deleteAttachment = async (orderId: string, attachmentId: string) => {
    if (!token || !canManagePOs) return;
    setAttachSavingId(orderId);
    try {
      const res = await apiFetch(
        `/purchase-orders/${orderId}/attachments/${attachmentId}`,
        { token, method: 'DELETE' }
      );
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
      toast.success(t('toast.attachmentRemoved'));
      load({ silent: true });
    } catch (err) {
      let msg = 'Could not remove attachment';
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

  const closePurchaseOrder = async (order: PurchaseOrderRow) => {
    if (!token || !canManagePOs) return;
    const currentStatus = (order.status ?? 'Open').trim().toLowerCase();
    if (currentStatus === 'closed') {
      toast.info(t('toast.poAlreadyClosed'));
      return;
    }
    setClosingId(order.id);
    try {
      await apiJson(`/purchase-orders/${order.id}/close`, {
        token,
        method: 'PATCH',
      });
      toast.success(t('toast.poClosed', { code: order.code }));
      load({ silent: true });
      setCloseConfirmOrder(null);
    } catch (err) {
      let msg = 'Could not close purchase order';
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
      setClosingId(null);
    }
  };

  const reopenPurchaseOrder = async (order: PurchaseOrderRow) => {
    if (!token || !canManagePOs) return;
    const currentStatus = (order.status ?? 'Open').trim().toLowerCase();
    if (currentStatus !== 'closed') {
      toast.info(t('toast.onlyClosedPoCanReopen'));
      return;
    }
    setReopeningId(order.id);
    try {
      await apiJson(`/purchase-orders/${order.id}/reopen`, {
        token,
        method: 'PATCH',
      });
      toast.success(t('toast.poReopened', { code: order.code }));
      load({ silent: true });
      setReopenConfirmOrder(null);
    } catch (err) {
      let msg = 'Could not reopen purchase order';
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
      setReopeningId(null);
    }
  };

  const exportToExcel = useCallback(() => {
    if (orders.length === 0) {
      toast.info(t('purchaseOrders.nothingToExport'));
      return;
    }
    const isoDay = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : '');
    try {
      const rows: ExportRow[] = orders.map((o) => {
        const isClosed = (o.status ?? 'Open').trim().toLowerCase() === 'closed';
        const total =
          o.totalAmount ??
          (o.quantityKg != null && o.pricePerKg != null ? o.quantityKg * o.pricePerKg : null);
        return {
          [t('table.col.status')]: isClosed ? t('purchaseOrders.statusClosed') : t('purchaseOrders.statusOpen'),
          [t('table.col.poId')]: o.code,
          [t('table.col.farm')]: o.farm ? `${o.farm.code} — ${o.farm.farmName}` : '—',
          [t('table.col.buyer')]: o.buyerName,
          [t('samples.col.buyerEmail')]: o.buyerEmail ?? '—',
          [t('table.col.orderDate')]: isoDay(o.orderDate) || '—',
          [t('table.col.crop')]: o.crop ?? '—',
          [t('table.col.qtyKg')]: o.quantityKg ?? '—',
          [t('table.col.pricePerKg')]: o.pricePerKg ?? '—',
          [t('table.col.total')]: total != null ? Number(total.toFixed(2)) : '—',
          [t('table.col.estFarmerDelivery')]: isoDay(o.estimatedFarmerDeliveryDate) || '—',
          [t('table.col.estArrivalBuyer')]: isoDay(o.estimatedArrivalAtBuyer) || '—',
          [t('table.col.destinationCountry')]: o.destinationCountry ?? '—',
          [t('table.col.portOfDischarge')]: o.portOfDischarge ?? '—',
          [t('table.col.created')]: o.createdAt
            ? new Date(o.createdAt).toLocaleDateString(locale, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })
            : '—',
          [t('table.col.attachments')]:
            o.attachments.map((a) => a.fileName || a.kind || t('common.download')).join('; ') || '—',
          [t('table.col.notes')]: (o.notes ?? '').trim() || '—',
        };
      });
      const stamp = new Date().toISOString().slice(0, 10);
      downloadTableXlsx(
        `${t('purchaseOrders.exportFilePrefix')}_${stamp}`,
        t('purchaseOrders.exportSheet'),
        rows
      );
      toast.success(t('findings.exportDone'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('findings.exportFailed'));
    }
  }, [orders, toast, t, locale]);

  const syncScrollFromTop = () => {
    if (!topScrollRef.current || !tableScrollRef.current) return;
    tableScrollRef.current.scrollLeft = topScrollRef.current.scrollLeft;
  };

  const syncScrollFromTable = () => {
    if (!topScrollRef.current || !tableScrollRef.current) return;
    topScrollRef.current.scrollLeft = tableScrollRef.current.scrollLeft;
  };

  if (loading && orders.length === 0) {
    return (
      <div className="page">
        <header className="page-header">
          <h1 className="page-title">{t('nav.purchaseOrders')}</h1>
        </header>
        <div className="loading-message">
          <div className="loading-spinner" />
          <p style={{ marginTop: 12 }}>{t('purchaseOrders.loading')}</p>
        </div>
      </div>
    );
  }

  if (error && orders.length === 0) {
    return (
      <div className="page">
        <header className="page-header">
          <h1 className="page-title">{t('nav.purchaseOrders')}</h1>
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
        <h1 className="page-title" style={{ marginBottom: 0 }}>
          {t('nav.purchaseOrders')}
        </h1>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={exportToExcel}
            disabled={loading}
            title={t('purchaseOrders.exportHint')}
          >
            {t('common.exportExcel')}
          </button>
          {canManagePOs ? (
            <button type="button" className="btn btn-primary" onClick={() => openCreateModal()}>
              {t('purchaseOrders.newOrder')}
            </button>
          ) : null}
        </div>
      </header>
      {error && orders.length > 0 && (
        <div className="alert-error" style={{ marginBottom: 12 }}>
          {error}
        </div>
      )}
      <div className="card">
        <div
          ref={topScrollRef}
          className="purchase-orders-table-scroll"
          style={{ overflowY: 'hidden', marginBottom: 6 }}
          onScroll={syncScrollFromTop}
          aria-label={t('purchaseOrders.scrollAria')}
        >
          <div style={{ height: 1, width: topScrollInnerWidth || '100%' }} />
        </div>
        <div
          ref={tableScrollRef}
          className="table-wrap purchase-orders-table-scroll"
          onScroll={syncScrollFromTable}
        >
          <table
            ref={tableRef}
            className="table table--sticky-header table--prevent-shrink purchase-orders-table--freeze-first-4"
          >
            <thead>
              <tr>
                <th>{t('table.col.closePo')}</th>
                <th>{t('table.col.poId')}</th>
                <th>{t('table.col.farm')}</th>
                <th>{t('table.col.buyer')}</th>
                <th>{t('table.col.orderDate')}</th>
                <th>{t('table.col.crop')}</th>
                <th>{t('table.col.qtyKg')}</th>
                <th>{t('table.col.pricePerKg')}</th>
                <th>{t('table.col.total')}</th>
                <th>{t('table.col.estFarmerDelivery')}</th>
                <th>{t('table.col.estArrivalBuyer')}</th>
                <th>{t('table.col.destinationCountry')}</th>
                <th>{t('table.col.portOfDischarge')}</th>
                <th>{t('table.col.created')}</th>
                <th>{t('table.col.attachments')}</th>
                <th>{t('table.col.edit')}</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={16} className="table-empty">
                    {canManagePOs ? (
                      <>{t('purchaseOrders.emptyWithHint')}</>
                    ) : (
                      t('purchaseOrders.empty')
                    )}
                  </td>
                </tr>
              ) : (
                orders.map((o) => {
                  const isClosed = (o.status ?? 'Open').trim().toLowerCase() === 'closed';
                  return (
                  <tr
                    key={o.id}
                    style={isClosed ? { backgroundColor: 'var(--color-surface-2, #f3f4f6)' } : undefined}
                  >
                    <td>
                      {canManagePOs ? (
                        <button
                          type="button"
                          className="btn btn-xs btn-ghost"
                          onClick={() => setCloseConfirmOrder(o)}
                          disabled={closingId === o.id || reopeningId === o.id || isClosed}
                        >
                          {isClosed
                            ? t('purchaseOrders.statusClosed')
                            : closingId === o.id
                              ? t('purchaseOrders.closing')
                              : t('purchaseOrders.closePo')}
                        </button>
                      ) : (
                        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
                          {isClosed ? t('purchaseOrders.statusClosed') : t('purchaseOrders.statusOpen')}
                        </span>
                      )}
                    </td>
                    <td>
                      <strong>{o.code}</strong>
                    </td>
                    <td>
                      {o.farm
                        ? `${o.farm.code} — ${o.farm.farmName}`
                        : '—'}
                    </td>
                    <td style={{ whiteSpace: 'normal', verticalAlign: 'top' }}>
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
                        ? new Date(o.orderDate).toLocaleDateString(locale, {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })
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
                    <td>
                      {o.estimatedFarmerDeliveryDate
                        ? new Date(
                            o.estimatedFarmerDeliveryDate
                          ).toLocaleDateString(locale, {
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
                          ).toLocaleDateString(locale, {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })
                        : '—'}
                    </td>
                    <td>{o.destinationCountry ?? '—'}</td>
                    <td>{o.portOfDischarge ?? '—'}</td>
                    <td>
                      {new Date(o.createdAt).toLocaleDateString(locale, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>
                    <td
                      style={{
                        minWidth: 220,
                        whiteSpace: 'normal',
                        verticalAlign: 'top',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 4,
                        }}
                      >
                        {canManagePOs ? (
                          <label className="btn btn-xs">
                            Add file…
                            <input
                              type="file"
                              multiple
                              style={{ display: 'none' }}
                              onChange={(e) => handleAttachmentFiles(o.id, e)}
                              disabled={attachSavingId === o.id}
                            />
                          </label>
                        ) : null}
                        {attachSavingId === o.id ? (
                          <span
                            style={{
                              fontSize: 'var(--text-xs)',
                              color: 'var(--color-text-muted)',
                            }}
                          >
                            Uploading…
                          </span>
                        ) : null}
                        {o.attachments.length > 0 && (
                          <ul
                            style={{
                              margin: '4px 0 0',
                              paddingLeft: 16,
                              fontSize: 'var(--text-xs)',
                              listStyle: 'disc',
                            }}
                          >
                            {o.attachments.map((a) => (
                              <li key={a.id}>
                                <button
                                  type="button"
                                  className="link-button"
                                  style={{
                                    padding: 0,
                                    fontSize: 'inherit',
                                    verticalAlign: 'baseline',
                                  }}
                                  onClick={() =>
                                    void openAttachmentDownload(o.id, a.id)
                                  }
                                >
                                  {a.fileName || 'Download'}
                                </button>
                                {a.kind && a.kind !== 'Document' ? (
                                  <span
                                    style={{
                                      color: 'var(--color-text-muted)',
                                      marginLeft: 6,
                                    }}
                                  >
                                    ({a.kind})
                                  </span>
                                ) : null}
                                {canManagePOs ? (
                                  <button
                                    type="button"
                                    className="btn btn-xs btn-ghost"
                                    style={{ marginLeft: 6 }}
                                    title="Remove attachment"
                                    disabled={attachSavingId === o.id}
                                    onClick={() => void deleteAttachment(o.id, a.id)}
                                  >
                                    Remove
                                  </button>
                                ) : null}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </td>
                    <td>
                      {canManagePOs ? (
                        <div
                          style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: 6,
                            justifyContent: 'flex-end',
                            alignItems: 'center',
                          }}
                        >
                          <button
                            type="button"
                            className="btn btn-xs btn-ghost"
                            onClick={() => openEditModal(o)}
                            disabled={
                              closingId === o.id ||
                              reopeningId === o.id ||
                              attachSavingId === o.id
                            }
                          >
                            Edit
                          </button>
                          {isClosed ? (
                            <button
                              type="button"
                              className="btn btn-xs btn-ghost"
                              onClick={() => setReopenConfirmOrder(o)}
                              disabled={
                                closingId === o.id ||
                                reopeningId === o.id ||
                                attachSavingId === o.id
                              }
                            >
                              {reopeningId === o.id ? 'Reopening…' : 'Reopen'}
                            </button>
                          ) : null}
                        </div>
                      ) : (
                        <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>—</span>
                      )}
                    </td>
                  </tr>
                  );
                })
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
          <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <h3 id="add-po-title" className="confirm-dialog-title">
              {formMode === 'edit' ? t('purchaseOrders.editOrder') : t('purchaseOrders.newOrder')}
            </h3>
            <form
              onSubmit={submit}
              className="stack"
              style={{ gap: 12, marginTop: 16 }}
            >
              <label className="field">
                <span className="field-label">Farm</span>
                <select
                  className="input"
                  value={farmId}
                  onChange={(e) => setFarmId(e.target.value)}
                  required
                >
                  <option value="">Select farm</option>
                  {farms.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.code} — {f.farmName} ({f.country})
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="field-label">Buyer name</span>
                <select
                  className="input"
                  value={buyerName}
                  onChange={(e) => {
                    const name = e.target.value;
                    setBuyerName(name);
                    const matchingWithEmail = buyerOptions.find(
                      (option) => option.name.trim() === name && option.contactEmail?.trim()
                    );
                    if (matchingWithEmail?.contactEmail) {
                      setBuyerEmail(matchingWithEmail.contactEmail);
                    } else if (name === '') {
                      setBuyerEmail('');
                    }
                  }}
                  required
                >
                  <option value="">Select buyer name</option>
                  {buyerNameOptions.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="field-label">Buyer email</span>
                <select
                  className="input"
                  value={buyerEmail}
                  onChange={(e) => {
                    const email = e.target.value;
                    setBuyerEmail(email);
                    const matchingByEmail = buyerOptions.find(
                      (option) => option.contactEmail?.trim() === email
                    );
                    if (matchingByEmail?.name) {
                      setBuyerName(matchingByEmail.name);
                    }
                  }}
                >
                  <option value="">Select buyer contact email</option>
                  {buyerEmailOptions.map((email) => (
                    <option key={email} value={email}>
                      {email}
                    </option>
                  ))}
                </select>
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
                <select
                  className="input"
                  value={crop}
                  onChange={(e) => setCrop(e.target.value)}
                >
                  <option value="">Select crop</option>
                  {cropOptions.map((option) => (
                    <option key={option.id} value={option.name}>
                      {option.name}
                    </option>
                  ))}
                </select>
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
                  <select
                    className="input"
                    value={destinationCountry}
                    onChange={(e) => setDestinationCountry(e.target.value)}
                  >
                    <option value="">Select country</option>
                    {countryOptions.map((option) => (
                      <option key={option.id} value={option.name}>
                        {option.name}
                      </option>
                    ))}
                  </select>
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
                  {saving
                    ? 'Saving…'
                    : formMode === 'edit'
                      ? 'Update PO'
                      : 'Create PO'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={closeConfirmOrder !== null}
        title="Close purchase order?"
        message={
          closeConfirmOrder
            ? `Are you sure this PO is ready to close? (${closeConfirmOrder.code})`
            : ''
        }
        confirmLabel="Close PO"
        onConfirm={() => closeConfirmOrder && void closePurchaseOrder(closeConfirmOrder)}
        onCancel={() => setCloseConfirmOrder(null)}
      />
      <ConfirmDialog
        open={reopenConfirmOrder !== null}
        title="Reopen purchase order?"
        message={
          reopenConfirmOrder
            ? `This will set the PO back to open status. (${reopenConfirmOrder.code})`
            : ''
        }
        confirmLabel="Reopen PO"
        onConfirm={() =>
          reopenConfirmOrder && void reopenPurchaseOrder(reopenConfirmOrder)
        }
        onCancel={() => setReopenConfirmOrder(null)}
      />
    </div>
  );
}

