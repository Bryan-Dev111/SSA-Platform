# Sentinel API (Server)

The app uses **Supabase** as the database. See **docs/SUPABASE_SETUP.md** for full setup and migration from local PostgreSQL.

## Setup

1. Copy `../.env.example` to `../.env` and `server/.env.example` to `server/.env`. Set **`DATABASE_URL`** in both to your **Supabase** connection string (Project Settings → Database → Connection string → Session; add `?sslmode=require&connect_timeout=30`).
2. Install and generate Prisma client:
   ```bash
   npm install
   npx prisma generate
   ```
3. Apply the database schema on Supabase:
   ```bash
   npx prisma migrate deploy
   ```
4. Seed roles and test users (if the DB is empty):
   ```bash
   npm run db:seed
   ```

## Scripts

- `npm run dev` — Start API with tsx watch
- `npm run build` — Compile TypeScript to `dist/`
- `npm run start` — Run `dist/index.js`
- `npm run db:migrate` — Run migrations (dev)
- `npm run db:studio` — Open Prisma Studio
