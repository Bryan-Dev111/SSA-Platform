const API_BASE = import.meta.env.VITE_API_URL || '/api';

export function parseApiError(e: unknown): string {
  const msg = e instanceof Error ? e.message : 'Something went wrong';
  try {
    const j = JSON.parse(msg) as { error?: string };
    if (j?.error && typeof j.error === 'string') return j.error;
  } catch {
    /* plain text */
  }
  return msg;
}

export function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = r.result as string;
      const i = s.indexOf(',');
      resolve(i >= 0 ? s.slice(i + 1) : s);
    };
    r.onerror = () => reject(new Error('Could not read file'));
    r.readAsDataURL(file);
  });
}

/** GET binary with Bearer token and trigger browser download */
export async function downloadWithAuth(path: string, token: string | null, filename: string): Promise<void> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path.startsWith('/') ? '' : '/'}${path}`;
  const headers: HeadersInit = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    const text = await res.text();
    let err = text || `HTTP ${res.status}`;
    try {
      const j = JSON.parse(text) as { error?: string };
      if (j?.error) err = j.error;
    } catch {
      /* keep */
    }
    throw new Error(err);
  }
  const blob = await res.blob();
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(href);
}

/** GET binary with Bearer token + progress callback and trigger browser download */
export function downloadWithAuthProgress(
  path: string,
  token: string | null,
  filename: string,
  onProgress: (percent: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const url = path.startsWith('http') ? path : `${API_BASE}${path.startsWith('/') ? '' : '/'}${path}`;
    const xhr = new XMLHttpRequest();
    let fallbackTick: number | null = null;
    let fallbackProgress = 1;
    let hasComputableProgress = false;
    xhr.open('GET', url);
    xhr.responseType = 'blob';
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    // Start fallback immediately so UI always moves even when browser omits progress events.
    onProgress(fallbackProgress);
    fallbackTick = window.setInterval(() => {
      if (hasComputableProgress) return;
      fallbackProgress = Math.min(95, fallbackProgress + 2);
      onProgress(fallbackProgress);
    }, 180);
    xhr.onprogress = (evt) => {
      if (evt.lengthComputable) {
        hasComputableProgress = true;
        onProgress(Math.max(0, Math.min(100, Math.round((evt.loaded / evt.total) * 100))));
        return;
      }
      // Non-computable progress events: fallback timer continues to pulse.
    };
    xhr.onload = () => {
      if (fallbackTick !== null) window.clearInterval(fallbackTick);
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100);
        const blob = xhr.response as Blob;
        const href = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = href;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(href);
        resolve();
      } else {
        const text = typeof xhr.responseText === 'string' ? xhr.responseText : '';
        let err = text || `HTTP ${xhr.status}`;
        try {
          const j = JSON.parse(text) as { error?: string };
          if (j?.error) err = j.error;
        } catch {
          /* keep */
        }
        reject(new Error(err));
      }
    };
    xhr.onerror = () => {
      if (fallbackTick !== null) window.clearInterval(fallbackTick);
      reject(new Error('Download failed'));
    };
    xhr.send();
  });
}
