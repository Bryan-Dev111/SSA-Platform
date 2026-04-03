/**
 * Multipart POST /records with upload progress (shared by Records page and Audits inline upload).
 */
const API_BASE = import.meta.env.VITE_API_URL || '/api';

export const MAX_RECORD_UPLOAD_BYTES = 75 * 1024 * 1024;

export type PostRecordPayload = {
  name: string;
  supplierId: string | null;
  auditId: string | null;
  shipmentId: string | null;
  carId: string | null;
  internalOrSupplier: 'supplier' | 'internal';
  file: File | null;
  notes: string;
};

export function postRecordWithProgress(
  payload: PostRecordPayload,
  token: string,
  onProgress: (percent: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE}/records`);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.upload.onprogress = (evt) => {
      if (!evt.lengthComputable) return;
      const percent = Math.max(0, Math.min(100, Math.round((evt.loaded / evt.total) * 100)));
      onProgress(percent);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100);
        resolve();
      } else {
        reject(new Error(xhr.responseText || `HTTP ${xhr.status}`));
      }
    };
    xhr.onerror = () => reject(new Error('Network error while uploading file'));
    const form = new FormData();
    form.append('name', payload.name);
    form.append('internalOrSupplier', payload.internalOrSupplier);
    form.append('supplierId', payload.supplierId ?? '');
    form.append('auditId', payload.auditId ?? '');
    form.append('shipmentId', payload.shipmentId ?? '');
    form.append('carId', payload.carId ?? '');
    form.append('notes', payload.notes);
    if (payload.file) form.append('file', payload.file);
    xhr.send(form);
  });
}
