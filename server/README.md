# Sentinel API (Server)

The app uses **Supabase** as the database. See **docs/SUPABASE_SETUP.md** for full setup and migration from local PostgreSQL.

## Setup

1. Copy `../.env.example` to `../.env` and `server/.env.example` to `server/.env`. Set **`DATABASE_URL`** in both to your **Supabase** connection string (Project Settings → Database → Connection string → Session; add `?sslmode=require&connect_timeout=30`).
2. Install and generate Prisma client:
   ```bash
   npm install
   npx prisma generate
   ```
3. Apply the database schema on Supabase (**never use `migrate dev` against production** — it may prompt to reset and drop all data):
   ```bash
   npm run db:migrate
   ```
   If Prisma reports migrations were **modified after they were applied**, your live schema may already match; sync checksum metadata only (no data loss) by running `npm run db:migrate:sync-checksums`, then executing the printed `UPDATE "_prisma_migrations"...` statements in the Supabase SQL Editor, then run `npm run db:migrate` again.
4. Seed roles and test users (if the DB is empty):
   ```bash
   npm run db:seed
   ```

## Scripts

- `npm run dev` — Start API with tsx watch
- `npm run build` — Compile TypeScript to `dist/`
- `npm run start` — Run `dist/index.js`
- `npm run db:migrate` — Apply pending migrations (`migrate deploy`, safe for Supabase)
- `npm run db:migrate:dev` — Create/apply migrations in dev (`migrate dev`; uses shadow DB, not for shared prod)
- `npm run db:migrate:sync-checksums` — Print SQL to fix `_prisma_migrations.checksum` after intentional migration edits
- `npm run db:studio` — Open Prisma Studio
