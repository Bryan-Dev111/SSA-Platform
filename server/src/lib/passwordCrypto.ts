import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';

function getPasswordEncryptionKey(): Buffer {
  const raw = process.env.PASSWORD_ENCRYPTION_KEY;
  if (!raw || !raw.trim()) {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret || !jwtSecret.trim()) {
      throw new Error('Either PASSWORD_ENCRYPTION_KEY or JWT_SECRET must be set');
    }
    return createHash('sha256').update(jwtSecret, 'utf8').digest();
  }
  const trimmed = raw.trim();
  const isHex = /^[0-9a-fA-F]+$/.test(trimmed);
  if (isHex) {
    const buf = Buffer.from(trimmed, 'hex');
    if (buf.length !== 32) throw new Error('PASSWORD_ENCRYPTION_KEY hex must decode to 32 bytes');
    return buf;
  }
  const buf = Buffer.from(trimmed, 'base64');
  if (buf.length !== 32) throw new Error('PASSWORD_ENCRYPTION_KEY base64 must decode to 32 bytes');
  return buf;
}

export function encryptPassword(plain: string): string {
  const key = getPasswordEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString('base64');
}

export function decryptPassword(encrypted: string | null): string | null {
  if (!encrypted) return null;
  try {
    const key = getPasswordEncryptionKey();
    const buf = Buffer.from(encrypted, 'base64');
    if (buf.length < 12 + 16) return null;
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const ciphertext = buf.subarray(28);
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(Buffer.from(tag));
    const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
    return plain;
  } catch {
    return null;
  }
}
