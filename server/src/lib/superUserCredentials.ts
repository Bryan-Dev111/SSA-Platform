/**
 * Super user password (not in DB). Default is code constant; changes persist to a local file.
 */
import fs from 'fs/promises';
import path from 'path';
import * as bcrypt from 'bcrypt';
import { SUPER_USER_PASSWORD } from './superUser';

const MIN_PASSWORD_LENGTH = 8;
const STORE_DIR = path.resolve(process.cwd(), 'server', '.data');
const STORE_FILE = path.join(STORE_DIR, 'super-credentials.json');

let cachedHash: string | null = null;

async function ensureDefaultHash(): Promise<string> {
  return bcrypt.hash(SUPER_USER_PASSWORD, 10);
}

async function loadPasswordHash(): Promise<string> {
  if (cachedHash) return cachedHash;
  try {
    const raw = await fs.readFile(STORE_FILE, 'utf8');
    const data = JSON.parse(raw) as { passwordHash?: string };
    if (typeof data.passwordHash === 'string' && data.passwordHash.length > 0) {
      cachedHash = data.passwordHash;
      return cachedHash;
    }
  } catch {
    /* use built-in default */
  }
  cachedHash = await ensureDefaultHash();
  return cachedHash;
}

export async function verifySuperPassword(password: string): Promise<boolean> {
  const hash = await loadPasswordHash();
  return bcrypt.compare(password, hash);
}

export async function changeSuperPassword(
  currentPassword: string,
  newPassword: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!currentPassword) {
    return { ok: false, error: 'Current password is required' };
  }
  if (!newPassword || newPassword.length < MIN_PASSWORD_LENGTH) {
    return {
      ok: false,
      error: `New password must be at least ${MIN_PASSWORD_LENGTH} characters`,
    };
  }
  const hash = await loadPasswordHash();
  const currentOk = await bcrypt.compare(currentPassword, hash);
  if (!currentOk) {
    return { ok: false, error: 'Current password is incorrect' };
  }
  const sameAsCurrent = await bcrypt.compare(newPassword, hash);
  if (sameAsCurrent) {
    return { ok: false, error: 'New password must be different from the current password' };
  }
  const newHash = await bcrypt.hash(newPassword, 10);
  await fs.mkdir(STORE_DIR, { recursive: true });
  await fs.writeFile(
    STORE_FILE,
    JSON.stringify({ passwordHash: newHash, updatedAt: new Date().toISOString() }, null, 2),
    'utf8'
  );
  cachedHash = newHash;
  return { ok: true };
}
