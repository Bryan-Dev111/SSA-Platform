/**
 * Prints SQL to update `_prisma_migrations.checksum` to match each local `migration.sql`
 * file (SHA-256 of UTF-8 contents, same algorithm Prisma Migrate uses).
 *
 * Use when Prisma reports "migration was modified after it was applied" after you
 * intentionally fixed migration SQL. Run the printed statements in Supabase SQL Editor.
 * This does NOT delete data; it only updates metadata Prisma uses to verify files.
 *
 * Usage (from server/):
 *   npx tsx prisma/scripts/print-migration-checksums-sql.ts
 */
import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';

const migrationsRoot = path.resolve(__dirname, '../migrations');

function checksumForMigrationFile(contents: string): string {
  return createHash('sha256').update(contents, 'utf8').digest('hex');
}

const entries = fs
  .readdirSync(migrationsRoot, { withFileTypes: true })
  .filter((d) => d.isDirectory() && !d.name.startsWith('.') && d.name !== 'node_modules')
  .map((d) => d.name)
  .sort();

console.log(
  '-- Prisma migration checksum sync (safe metadata only; no table drops).\n-- Review, then run in Supabase SQL Editor if checksums were out of date.\n'
);

for (const name of entries) {
  const sqlPath = path.join(migrationsRoot, name, 'migration.sql');
  if (!fs.existsSync(sqlPath)) continue;
  const contents = fs.readFileSync(sqlPath, 'utf8');
  const checksum = checksumForMigrationFile(contents);
  console.log(`-- ${name}`);
  console.log(
    `UPDATE "_prisma_migrations" SET "checksum" = '${checksum}' WHERE "migration_name" = '${name}';`
  );
  console.log('');
}
