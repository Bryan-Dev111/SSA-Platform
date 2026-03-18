# Supabase as database + migrate local data

Use Supabase as the app database and optionally **migrate all existing data** from your local PostgreSQL into Supabase.

---

## Quick steps: migrate local DB (with content) → Supabase

1. **Supabase:** New project → Settings → Database → Connection string (URI). Use **Direct** or Session + `connection_limit=1&connect_timeout=30`. Add `?sslmode=require`.
2. **server/.env:** Set `LOCAL_DATABASE_URL` = your local Postgres URL. Set `DATABASE_URL` = Supabase URI.
3. **server/:** `npm install` → `npx prisma migrate deploy` (creates empty tables on Supabase).
4. **server/:** `npm run db:migrate-data` (copies all rows from local to Supabase).
5. **root .env:** Set `DATABASE_URL` to the same Supabase URI. Run `npm run dev` and verify login and features.

---

## Part A — Migrate local PostgreSQL (with content) into Supabase

Use this when you already have data in a **local** PostgreSQL database and want to move it to Supabase without losing anything.

### 1. Create Supabase project and get connection string

1. Go to [supabase.com](https://supabase.com) → **New project** (name, database password, region). Wait until **Active**.
2. **Project Settings** (gear) → **Database** → **Connection string** → **URI**.
3. Copy the URI. Prefer **Direct connection** (host `db.xxx.supabase.co`) to avoid pool timeouts.
4. Replace `[YOUR-PASSWORD]` with your database password. Add **`?sslmode=require`** at the end.  
   If using **Session pooler**, also add: **`&connection_limit=1&connect_timeout=30`**.

### 2. Configure server/.env for migration

In **`server/.env`** set **both** URLs:

```env
# Source: your current local PostgreSQL (with all data)
LOCAL_DATABASE_URL="postgresql://postgres:YOUR_LOCAL_PASSWORD@localhost:5432/sentinel?schema=public"

# Target: Supabase (empty; we will create schema then copy data)
DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres?sslmode=require"
```

Use your real local user/password/database name and your real Supabase URI. **Do not** point both at the same database.

### 3. Apply schema on Supabase

From **`server/`**:

```bash
npm install
npx prisma generate
npx prisma migrate deploy
```

This creates all tables on Supabase (empty). **Do not** run `npm run db:seed` yet; the migration script will copy your local data.

### 4. Run the data migration

Ensure **local PostgreSQL is running** and has the data you want. From **`server/`**:

```bash
npm run db:migrate-data
```

The script will:

- Connect to local (source) and Supabase (target).
- Truncate app tables on Supabase, then copy every row from local in dependency order (Role → User → … → IdSequence).

You should see lines like `Role: N rows copied`, `User: N rows copied`, etc., then: **Migration completed. Local data is now in Supabase.**

### 5. Switch app to Supabase only

After verifying data in Supabase (e.g. `npm run db:studio` with `DATABASE_URL` pointing to Supabase):

1. In **root `.env`** set **`DATABASE_URL`** to the **same** Supabase URI (so the API uses Supabase).
2. Optionally remove **`LOCAL_DATABASE_URL`** from `server/.env` if you no longer need it.

### 6. Run and verify

From **`server/`**: `npm run dev`. Start the client, log in with an existing user (e.g. `admin@sentinel.local`), and confirm all features: Dashboard, Findings, Audits, Suppliers, etc.

---

## Part B — Fresh Supabase (no local data)

If you do **not** need to migrate existing data:

1. Create a Supabase project and get **`DATABASE_URL`** (with `?sslmode=require`; add `connection_limit=1&connect_timeout=30` if using Session pooler).
2. Set **`DATABASE_URL`** in both **root `.env`** and **`server/.env`**.
3. From **`server/`**: `npx prisma migrate deploy` then **`npm run db:seed`** (creates roles and test users).

---

## Troubleshooting

| Issue | What to do |
|--------|------------|
| **Missing LOCAL_DATABASE_URL** | Add it in `server/.env` with your local Postgres URL. |
| **LOCAL_DATABASE_URL and DATABASE_URL must be different** | One must be local, the other Supabase. |
| **Supabase is missing tables** | Run `npx prisma migrate deploy` from `server/` first. |
| **ENOTFOUND / getaddrinfo** (Direct host not found) | Your network or DNS can't resolve `db.xxx.supabase.co`. Use the **Session pooler** URL instead: Supabase → Project Settings → Database → Connection string → **Session** (host like `aws-0-REGION.pooler.supabase.com`). In `server/.env` set `DATABASE_URL` to that URI (password + `?sslmode=require&connection_limit=1&connect_timeout=30`). |
| **Can't reach database server (P1001)** | Check project is Active; try Session pooler if Direct fails; check firewall/VPN; ensure `?sslmode=require`. |
| **Connection pool timeout (P2024)** | Use **Direct** connection URL, or add `connection_limit=1&connect_timeout=30` to Session pooler URL. |
| **Self-signed certificate** | The migration script uses `rejectUnauthorized: false` for Supabase; run again. |
| **Tenant or user not found** | The pooler needs the **exact** Session URI for your project’s region. In **Supabase Dashboard** → your project → **Project Settings** → **Database** → **Connection string** → **Session** tab: copy the full URI. Replace `[YOUR-PASSWORD]` with your DB password, add `?sslmode=require` at the end if missing. In **`server/.env`** set **`SUPABASE_MIGRATION_URL`** to that exact string (leave `DATABASE_URL` as is if you prefer). Run `npm run db:migrate-data` again. Also ensure the project is **Active** (if Paused, click **Restore**). |

---

## Requirements alignment

All app behaviour stays the same with Supabase:

- **Auth:** JWT login/register; roles and supplier/buyer scope from DB.
- **RBAC:** Same as Day 1 role–page matrix (Dashboard, Findings, Audits, Suppliers, etc.).
- **Findings:** DRAFT → Waiting Disposition → Waiting Approval → Closed; Admin/QE approve; Admin delete; Buyer scoped.
- **Audits:** CRUD; Passed/Failed/Cancelled; Admin/QE set result; Admin delete; Buyer filtered.
- **Suppliers:** Admin all; Buyer assigned; Supplier own only.

Only the database host changes; no feature or requirement changes.
