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

export async function uploadDocumentToStorage(args: {
  documentId: string;
  fileName: string;
  fileMime: string | null;
  fileBuffer: Buffer;
}): Promise<{ storagePath: string }> {
  const supabase = requireStorageClient();
  const safeName = args.fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 140) || 'document.bin';
  const key = `documents/${args.documentId}/${Date.now()}-${randomBytes(6).toString('hex')}-${safeName}`;
  const { error } = await supabase.storage.from(SUPABASE_STORAGE_BUCKET).upload(key, args.fileBuffer, {
    upsert: false,
    contentType: args.fileMime || 'application/octet-stream',
  });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  return { storagePath: key };
}

export const FARM_PROFILE_IMAGE_MAX_BYTES = 12 * 1024 * 1024;

/** Signed URL for reading an object from the primary storage bucket. */
export async function createSignedUrlForPath(
  storagePath: string,
  expiresSec: number = 3600
): Promise<string> {
  const supabase = requireStorageClient();
  const { data, error } = await supabase.storage
    .from(SUPABASE_STORAGE_BUCKET)
    .createSignedUrl(storagePath, expiresSec);
  if (error || !data?.signedUrl) {
    throw new Error(`Storage signed URL failed: ${error?.message || 'Unknown error'}`);
  }
  return data.signedUrl;
}

export async function createRecordDownloadSignedUrl(storagePath: string): Promise<string> {
  return createSignedUrlForPath(storagePath, 60);
}

export async function uploadFarmProfileImageToStorage(args: {
  farmId: string;
  section: string;
  fileName: string;
  fileMime: string | null;
  fileBuffer: Buffer;
}): Promise<{ storagePath: string }> {
  const supabase = requireStorageClient();
  const safeName = args.fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 140) || 'image.bin';
  const sectionSafe = args.section.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 40) || 'section';
  const key = `farms/${args.farmId}/${sectionSafe}/${Date.now()}-${randomBytes(6).toString('hex')}-${safeName}`;
  const { error } = await supabase.storage.from(SUPABASE_STORAGE_BUCKET).upload(key, args.fileBuffer, {
    upsert: false,
    contentType: args.fileMime || 'application/octet-stream',
  });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  return { storagePath: key };
}

export async function uploadEmployeeProfileImageToStorage(args: {
  userId: string;
  fileName: string;
  fileMime: string | null;
  fileBuffer: Buffer;
}): Promise<{ storagePath: string }> {
  const supabase = requireStorageClient();
  const safeName = args.fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 140) || 'image.bin';
  const key = `employee-profiles/${args.userId}/${Date.now()}-${randomBytes(6).toString('hex')}-${safeName}`;
  const { error } = await supabase.storage.from(SUPABASE_STORAGE_BUCKET).upload(key, args.fileBuffer, {
    upsert: false,
    contentType: args.fileMime || 'application/octet-stream',
  });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  return { storagePath: key };
}

/** Remove one object; ignores \"not found\" style failures so deletes stay idempotent. */
export async function deleteObjectFromStorage(storagePath: string): Promise<void> {
  const supabase = requireStorageClient();
  const { error } = await supabase.storage.from(SUPABASE_STORAGE_BUCKET).remove([storagePath]);
  if (error) throw new Error(`Storage delete failed: ${error.message}`);
}

