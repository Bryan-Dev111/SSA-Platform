import 'dotenv/config';

/**
 * Fix P3005: database has tables but Prisma Migrate has no history on this instance.
 *
 * Default flow:
 * 1) If the DB drifts from schema.prisma, prints the SQL diff. Apply it in the Supabase SQL Editor
 *    (review carefully — especially enum / column changes). Then re-run this script.
 * 2) Marks every folder under prisma/migrations as already applied (chronological order).
 * 3) Runs `prisma migrate deploy` (should report no pending migrations).
 *
 * If you already aligned the database (e.g. ran the printed SQL or `prisma db push`):
 *   npm run db:baseline-supabase -- --resolve-only
 *
 * Dev/staging shortcut (can drop/recreate columns — not for production without review):
 *   npx prisma db push --accept-data-loss
 *   npm run db:baseline-supabase -- --resolve-only
 *
 * Usage (from server/):  npm run db:baseline-supabase
 */
import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(__dirname, '../..');
const prismaDir = path.join(serverRoot, 'prisma');
const schemaPath = path.join(prismaDir, 'schema.prisma');
const migrationsRoot = path.join(prismaDir, 'migrations');

function run(cmd: string) {
  execSync(cmd, { stdio: 'inherit', cwd: serverRoot, env: process.env, shell: process.platform === 'win32' });
}

function resolveAppliedAllowDuplicates(migrationName: string) {
  try {
    execSync(`npx prisma migrate resolve --applied "${migrationName}"`, {
      cwd: serverRoot,
      env: process.env,
      shell: process.platform === 'win32',
      encoding: 'utf-8',
      stdio: ['inherit', 'pipe', 'pipe'],
    });
  } catch (e: unknown) {
    const err = e as { stderr?: Buffer; message?: string };
    const errText = `${err.message ?? ''}\n${err.stderr?.toString?.() ?? ''}`;
    if (/already (been )?applied|already recorded|P3008|P3014/i.test(errText)) {
      console.log(`  (already applied — skip)`);
      return;
    }
    throw e;
  }
}

function main() {
  const resolveOnly = process.argv.includes('--resolve-only');

  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set. Run from server/ so .env is loaded, or export DATABASE_URL.');
    process.exit(1);
  }

  if (!resolveOnly) {
    console.log('Checking drift: live database → schema.prisma …\n');
    let diff: string;
    try {
      diff = execSync(
        `npx prisma migrate diff --from-url "${process.env.DATABASE_URL}" --to-schema-datamodel "${schemaPath}" --script`,
        { cwd: serverRoot, encoding: 'utf-8', env: process.env, shell: process.platform === 'win32' }
      );
    } catch (e) {
      console.error('migrate diff failed. Check DATABASE_URL (direct/session connection to Postgres, not broken pooler).', e);
      process.exit(1);
    }

    const sql = diff.trim();
    if (sql.length > 0) {
      console.error('Database does not yet match schema.prisma. Apply the SQL below in Supabase → SQL Editor, then run:\n');
      console.error('  npm run db:baseline-supabase -- --resolve-only\n');
      console.error('--- cut ---\n');
      console.error(sql);
      console.error('\n--- end ---\n');
      process.exit(1);
    }
  } else {
    console.log('Skipping drift check (--resolve-only).\n');
  }

  const names = fs
    .readdirSync(migrationsRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((name) => fs.existsSync(path.join(migrationsRoot, name, 'migration.sql')))
    .sort();

  console.log(`Marking ${names.length} migration(s) as already applied…\n`);
  for (const name of names) {
    console.log(`  resolve --applied ${name}`);
    resolveAppliedAllowDuplicates(name);
  }

  console.log('\nRunning prisma migrate deploy…\n');
  run('npx prisma migrate deploy');
  console.log('\nBaseline complete. Future migrations: use npm run db:migrate:deploy');
}

main();
