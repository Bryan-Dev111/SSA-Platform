/**
 * Migrate data from local PostgreSQL to Supabase.
 * Run from server/: npm run db:migrate-data
 *
 * Requires in server/.env:
 *   LOCAL_DATABASE_URL = local PostgreSQL (source, with data)
 *   DATABASE_URL or SUPABASE_MIGRATION_URL = Supabase (target; schema already applied)
 *
 * If you get "Tenant or user not found", set SUPABASE_MIGRATION_URL to the EXACT
 * Session URI from Supabase Dashboard → Project Settings → Database → Connection string → Session.
 */
import path from 'path';
import { config } from 'dotenv';
import { Client } from 'pg';

config({ path: path.resolve(process.cwd(), '.env') });
config({ path: path.resolve(process.cwd(), '..', '.env') });

const LOCAL_URL = process.env.LOCAL_DATABASE_URL;
// Prefer exact migration URL (paste from dashboard) to avoid "Tenant or user not found"
const SUPABASE_URL = process.env.SUPABASE_MIGRATION_URL || process.env.DATABASE_URL;

if (!LOCAL_URL) {
  console.error('Missing LOCAL_DATABASE_URL in server/.env (your local PostgreSQL connection string).');
  process.exit(1);
}
if (!SUPABASE_URL) {
  console.error('Missing SUPABASE_MIGRATION_URL or DATABASE_URL in server/.env (Supabase connection string).');
  process.exit(1);
}
if (LOCAL_URL === SUPABASE_URL) {
  console.error('LOCAL_DATABASE_URL and Supabase URL must be different (local = source, Supabase = target).');
  process.exit(1);
}

// Tables in dependency order for INSERT (parents before children). Reverse for TRUNCATE.
const TABLE_ORDER = [
  'Role',
  'User',
  'UserRole',
  'CommodityType',
  'Supplier',
  'BuyerSupplier',
  'AuditType',
  'Audit',
  'Finding',
  'CorrectiveAction',
  'Shipment',
  'ShipmentSchedule',
  'Record',
  'Document',
  'InternalDoc',
  'RiskWeightConfig',
  'RiskSnapshot',
  'Opportunity',
  'Alert',
  'UserAlertPreference',
  'IdSequence',
];

function quoteId(name: string): string {
  return `"${name}"`;
}

/** Strip sslmode from URL so we can force SSL options in code (avoid verify-full / cert chain errors). */
function urlWithoutSslMode(url: string): string {
  return url
    .replace(/[?&]sslmode=[^&]+/g, '')
    .replace(/[?&]uselibpqcompat=[^&]+/g, '')
    .replace(/\?&/, '?')
    .replace(/\?$/, '');
}

async function main() {
  // Source: for Supabase, use SSL but do not verify cert (avoids "self-signed certificate in certificate chain")
  const isSupabaseSource = LOCAL_URL.includes('supabase.co') || LOCAL_URL.includes('pooler.supabase.com');
  const localUrl = isSupabaseSource ? urlWithoutSslMode(LOCAL_URL) : LOCAL_URL;
  const local = new Client({
    connectionString: localUrl,
    ...(isSupabaseSource && { ssl: { rejectUnauthorized: false } }),
  });

  // Target: same — SSL without cert verification for Supabase pooler
  const supabaseUrl = urlWithoutSslMode(SUPABASE_URL);
  const supabase = new Client({
    connectionString: supabaseUrl,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await local.connect();
    console.log('Connected to local PostgreSQL.');
    await supabase.connect();
    console.log('Connected to Supabase.');

    // Ensure all tables exist on Supabase
    const existing = await supabase.query<{ tablename: string }>(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`
    );
    const existingSet = new Set((existing.rows || []).map((r) => r.tablename));
    const missing = TABLE_ORDER.filter((t) => !existingSet.has(t));
    if (missing.length > 0) {
      console.error('Supabase is missing tables:', missing.join(', '));
      console.error('Run from server/: npx prisma migrate deploy');
      process.exit(1);
    }

    // Truncate Supabase tables (children first)
    const truncateOrder = [...TABLE_ORDER].reverse();
    const tableList = truncateOrder.map(quoteId).join(', ');
    console.log('Truncating existing data in Supabase...');
    await supabase.query(`TRUNCATE TABLE ${tableList} CASCADE`);
    console.log('Truncate done.');

    for (const table of TABLE_ORDER) {
      const res = await local.query(`SELECT * FROM ${quoteId(table)}`);
      const rows = res.rows as Record<string, unknown>[];
      const fields = res.fields;
      if (!fields?.length) continue;
      if (rows.length === 0) {
        console.log(`  ${table}: 0 rows (skip)`);
        continue;
      }

      const columns = fields.map((f) => quoteId(f.name));
      const placeholders = rows.map((_, i) => {
        const start = i * fields.length + 1;
        return `(${fields.map((_, j) => `$${start + j}`).join(', ')})`;
      });
      const sql = `INSERT INTO ${quoteId(table)} (${columns.join(', ')}) VALUES ${placeholders.join(', ')}`;

      const values: unknown[] = [];
      for (const row of rows) {
        for (const f of fields) {
          let val = row[f.name];
          if (val instanceof Date) val = val.toISOString();
          values.push(val);
        }
      }

      await supabase.query(sql, values);
      console.log(`  ${table}: ${rows.length} rows copied.`);
    }

    console.log('Migration completed. Local data is now in Supabase.');
  } catch (e) {
    const err = e as Error & { message?: string };
    const msg = String(err.message ?? e);
    console.error('Migration failed:', msg);
    if (msg.includes('Tenant or user not found')) {
      console.error('');
      console.error('Fix: Use the EXACT Session URI from Supabase:');
      console.error('  1. Dashboard → your project → Project Settings (gear) → Database');
      console.error('  2. Connection string → Session mode → copy the URI');
      console.error('  3. Replace [YOUR-PASSWORD] with your database password');
      console.error('  4. In server/.env set: SUPABASE_MIGRATION_URL="<that full URI>"');
      console.error('  5. Add ?sslmode=require at the end if not present. Run npm run db:migrate-data again.');
    }
    if (msg.includes('ENOTFOUND') && LOCAL_URL.includes('db.') && LOCAL_URL.includes('supabase.co')) {
      console.error('');
      console.error('Fix: The Direct connection (db.xxx.supabase.co) cannot be resolved. Use Session pooler instead:');
      console.error('  1. Dashboard → your project (source) → Project Settings → Database');
      console.error('  2. Connection string → Session mode → copy URI (host: aws-0-<region>.pooler.supabase.com)');
      console.error('  3. In server/.env set LOCAL_DATABASE_URL="<that URI>" with your password and ?sslmode=require');
      console.error('  4. If the project is paused, restore it first from the Dashboard.');
    }
    process.exit(1);
  } finally {
    await local.end();
    await supabase.end();
  }
}

main();
