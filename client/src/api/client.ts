/**
 * API client: base URL, attach Bearer token, handle 401
 */
const API_BASE = import.meta.env.VITE_API_URL || '/api';

function resolveClientLocale(): string {
  if (typeof document !== 'undefined') {
    const docLang = document.documentElement.lang?.trim();
    if (docLang) return docLang;
  }
  if (typeof navigator !== 'undefined') {
    const navLang = navigator.language?.trim();
    if (navLang) return navLang;
  }
  return 'en-US';
}

export async function apiFetch(
  path: string,
  options: RequestInit & { token?: string | null } = {}
): Promise<Response> {
  const { token, ...init } = options;
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (!headers.has('Accept-Language')) headers.set('Accept-Language', resolveClientLocale());
  if (!(init.body instanceof FormData) && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const url = path.startsWith('http') ? path : `${API_BASE}${path.startsWith('/') ? '' : '/'}${path}`;
  const res = await fetch(url, { ...init, headers });
  if (res.status === 401 && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('auth:logout'));
  }
  return res;
}

export async function apiJson<T>(path: string, options?: RequestInit & { token?: string | null }): Promise<T> {
  const res = await apiFetch(path, options);
  const text = await res.text();
  if (!res.ok) throw new Error(text || `HTTP ${res.status}`);
  return text ? (JSON.parse(text) as T) : ({} as T);
}
