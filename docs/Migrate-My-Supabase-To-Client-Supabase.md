# Migrate your Supabase database into the client's Supabase project

Use this when **your** Supabase project (your account) has all the data and you want to copy **schema + data** into the **client's** Supabase project (you have been invited as Administrator).

The existing script `npm run db:migrate-data` copies from a **source** Postgres URL to a **target** Postgres URL. Here, source = your Supabase, target = client's Supabase.

---

## What you need

1. **Source:** Your Supabase project (your account) — has the schema and all data.
2. **Target:** Client's Supabase project — can be empty or existing; it will get the same schema and a full copy of your data (target tables are truncated first).

You need the **database connection URI** for both projects.

---

## Step 1: Get the connection string from YOUR Supabase (source)

1. Log in to [supabase.com](https://supabase.com) with **your** account.
2. Open the **project** that has the data you want to migrate.
3. Go to **Project Settings** (gear icon) → **Database**.
4. Under **Connection string**, choose **URI**.
5. Select **Session** mode (recommended). Avoid Direct for migration — Direct (`db.xxx.supabase.co`) can give `ENOTFOUND` if the project is paused.
6. Copy the URI. It looks like:  
   `postgresql://postgres.[project-ref]:[YOUR-PASSWORD]@aws-0-[region].pooler.supabase.com:5432/postgres`
7. Replace `[YOUR-PASSWORD]` with your **database password** (reset it on this page if needed).
8. Add **`?sslmode=require`** at the end if it is not already there.
9. If the project is **paused**, click **Restore project** in the Dashboard first.
10. Save this URI — you will use it as **source** in the next steps.

---

## Step 2: Get the connection string from CLIENT's Supabase (target)

1. Log in to [supabase.com](https://supabase.com) and switch to the **client's organization/project** (the one that invited you).
2. Open the **client's project** where you want the data to live.
3. Go to **Project Settings** (gear) → **Database**.
4. Copy the **Connection string** (URI) as above (Session or Direct).
5. Replace `[YOUR-PASSWORD]` with the **client's database password** (you need to know it or they must provide it; they can reset it under Database settings).
6. Add **`?sslmode=require`** at the end if needed.
7. Save this URI — you will use it as **target**.

---

## Step 3: Configure `server/.env` for migration

In **`server/.env`** set **only** these for the migration (temporarily):

```env
# SOURCE = your Supabase (has all the data)
LOCAL_DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres?sslmode=require"

# TARGET = client's Supabase (will receive schema + data)
DATABASE_URL="postgresql://postgres.[ref]:[CLIENT-PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres?sslmode=require"
```

- **LOCAL_DATABASE_URL** = the URI from **Step 1** (your project, with data).
- **DATABASE_URL** = the URI from **Step 2** (client's project).

Use real passwords and URIs. Do **not** point both at the same database.

If you get errors like "Tenant or user not found" when running the migration, try:

- Using the **Session** mode URI for the **target** (client's project), and set it explicitly:
  - `SUPABASE_MIGRATION_URL="postgresql://postgres.[ref]:[PASSWORD]@...?sslmode=require"`
  The script uses `SUPABASE_MIGRATION_URL` if set, otherwise `DATABASE_URL`.

---

## Step 4: Apply schema on the client's database (target)

The migration script expects the **target** to already have the same tables. So we create the schema on the client's project first.

1. Open a terminal.
2. Go to the **server** folder:  
   `cd server`
3. Ensure dependencies are installed:  
   `npm install`
4. Generate Prisma client:  
   `npx prisma generate`
5. Apply migrations to the **target** (client's DB — `DATABASE_URL`):  
   `npx prisma migrate deploy`

This creates all tables in the client's Supabase project. No data is copied yet.

---

## Step 5: Run the data migration

Still in **`server/`**:

```bash
npm run db:migrate-data
```

What this does:

- Connects to **LOCAL_DATABASE_URL** (your Supabase = source).
- Connects to **DATABASE_URL** or **SUPABASE_MIGRATION_URL** (client's Supabase = target).
- **Truncates** all app tables in the target (in the right order to respect foreign keys).
- **Copies every row** from source to target, table by table (Roles, Users, Audits, Findings, CARs, etc.).

You should see lines like:

- `Role: N rows copied`
- `User: N rows copied`
- …
- `Migration completed. Local data is now in Supabase.`

Your current database content (from your Supabase) is now in the client's Supabase project.

---

## Step 6: Use the client's project from now on

1. In **`server/.env`** (and any root `.env` that the app uses), set **`DATABASE_URL`** to the **client's** Supabase URI only, so the app runs against the client's database.
2. You can remove **`LOCAL_DATABASE_URL`** from `server/.env` if you no longer need it (or leave it for reference).
3. **If the client's database is new/empty**, create the schema once from **`server/`**:  
   `npx prisma generate` then `npx prisma migrate deploy`.  
   Then run the data migration (Step 5) if you haven't already, or run the app if data is already there.
4. Run the app and log in; you should see all the migrated data in the client's project.

---

## Summary

| Step | Action |
|------|--------|
| 1 | Get database URI from **your** Supabase project (source). |
| 2 | Get database URI from **client's** Supabase project (target). |
| 3 | In `server/.env`: `LOCAL_DATABASE_URL` = your URI, `DATABASE_URL` = client's URI. |
| 4 | In `server/`: `npx prisma migrate deploy` (creates schema on client's DB). |
| 5 | In `server/`: `npm run db:migrate-data` (copies all data from your DB to client's DB). |
| 6 | Set app `DATABASE_URL` to client's URI only and run the app. |

Yes, the migrated database **includes all current data** from your Supabase account; the script copies every row from every app table into the client's project.
