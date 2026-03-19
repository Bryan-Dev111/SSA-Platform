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
