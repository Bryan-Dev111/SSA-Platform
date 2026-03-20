import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const SUPABASE_STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'records';

function requireStorageClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase Storage is not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).');
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const MAX_RECORD_FILE_BYTES = 150 * 1024 * 1024;

export async function uploadRecordToStorage(args: {
  supplierId: string | null;
  recordId: string;
  fileName: string;
  fileMime: string | null;
  fileBuffer: Buffer;
}): Promise<{ storagePath: string }> {
  const supabase = requireStorageClient();
  const safeName = args.fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 140) || 'upload.bin';
  const key = `${args.supplierId || 'none'}/${args.recordId}/${Date.now()}-${randomBytes(6).toString('hex')}-${safeName}`;
  const { error } = await supabase.storage.from(SUPABASE_STORAGE_BUCKET).upload(key, args.fileBuffer, {
    upsert: false,
    contentType: args.fileMime || 'application/octet-stream',
  });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  return { storagePath: key };
}

export async function createRecordDownloadSignedUrl(storagePath: string): Promise<string> {
  const supabase = requireStorageClient();
  const { data, error } = await supabase.storage.from(SUPABASE_STORAGE_BUCKET).createSignedUrl(storagePath, 60);
  if (error || !data?.signedUrl) throw new Error(`Storage signed URL failed: ${error?.message || 'Unknown error'}`);
  return data.signedUrl;
}

