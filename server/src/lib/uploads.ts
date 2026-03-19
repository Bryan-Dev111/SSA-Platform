/**
 * Local file uploads under process.cwd()/uploads (Day 10).
 */
import { mkdir, writeFile, access } from 'fs/promises';
import path from 'path';
import { randomBytes } from 'crypto';

const UPLOADS_ROOT = path.join(process.cwd(), 'uploads');

export function safeUploadFileName(name: string): string {
  const base = path.basename(name).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
  return base || 'attachment';
}

/** Stored path uses forward slashes, e.g. records/abc.pdf */
export async function saveBase64ToUploads(
  subDir: 'records' | 'documents' | 'internal',
  fileBase64Raw: string,
  uploadFileName: string,
  maxBytes: number
): Promise<string> {
  const comma = fileBase64Raw.indexOf(',');
  const b64 = comma >= 0 ? fileBase64Raw.slice(comma + 1) : fileBase64Raw;
  const buf = Buffer.from(b64, 'base64');
  if (!buf.length) throw new Error('Empty file');
  if (buf.length > maxBytes) throw new Error(`File too large (max ${maxBytes} bytes)`);
  const dir = path.join(UPLOADS_ROOT, subDir);
  await mkdir(dir, { recursive: true });
  const unique = `${Date.now()}-${randomBytes(8).toString('hex')}-${safeUploadFileName(uploadFileName)}`;
  const dest = path.join(dir, unique);
  await writeFile(dest, buf);
  return path.posix.join(subDir, unique);
}

/** Resolve stored path to absolute file; null if invalid or outside uploads. */
export function resolveStoredUploadPath(storedPath: string | null | undefined): string | null {
  if (!storedPath || typeof storedPath !== 'string') return null;
  if (storedPath.includes('..') || storedPath.startsWith('/')) return null;
  const parts = storedPath.split('/').filter(Boolean);
  if (parts.length < 2) return null;
  const full = path.resolve(UPLOADS_ROOT, ...parts);
  const root = path.resolve(UPLOADS_ROOT);
  if (!full.startsWith(root)) return null;
  return full;
}

export async function fileExists(absPath: string): Promise<boolean> {
  try {
    await access(absPath);
    return true;
  } catch {
    return false;
  }
}

export const MAX_FILE_BYTES = 8 * 1024 * 1024;
