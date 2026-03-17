# Connect to Local PostgreSQL

## 1. Install PostgreSQL (if needed)

- **Windows:** Download from [postgresql.org](https://www.postgresql.org/download/windows/) or use Chocolatey: `choco install postgresql`
- **macOS:** `brew install postgresql` then `brew services start postgresql`
- **Linux:** `sudo apt install postgresql postgresql-contrib` (Ubuntu/Debian)

Ensure the PostgreSQL service is **running** (default port **5432**).

---

## 2. Create the database

Open a terminal and connect as the postgres user (or another superuser), then create the `sentinel` database.

**Option A — Command line (psql):**

```bash
# Windows (if psql is in PATH):
psql -U postgres -c "CREATE DATABASE sentinel;"

# Or open psql and run:
# psql -U postgres
# CREATE DATABASE sentinel;
# \q
```

**Option B — pgAdmin or another GUI:** Create a new database named `sentinel`.

---

## 3. Set the connection string

Create a **`.env`** file in the **`server`** folder (same level as `prisma/`), or in the project root **`E:\MVP`**.

**Format:**

```
postgresql://USERNAME:PASSWORD@HOST:PORT/DATABASE_NAME?schema=public
```

**Examples:**

- Default local user `postgres`, password `postgres`, database `sentinel`:
  ```
  DATABASE_URL="postgresql://postgres:postgres@localhost:5432/sentinel?schema=public"
  ```

- User `myuser`, password `mypass`, database `sentinel`:
  ```
  DATABASE_URL="postgresql://myuser:mypass@localhost:5432/sentinel?schema=public"
  ```

- If PostgreSQL is on a different port (e.g. 5433):
  ```
  DATABASE_URL="postgresql://postgres:postgres@localhost:5433/sentinel?schema=public"
  ```

**Special characters in password:** URL-encode them. Example: `p@ss#word` → `p%40ss%23word`.

---

## 4. Create the `.env` file

**In `E:\MVP\server\.env`** (recommended so Prisma finds it when you run commands from `server/`):

```env
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/sentinel?schema=public"
JWT_SECRET="your-secret-key-at-least-32-characters-long"
PORT=4000
NODE_ENV=development
```

Replace `postgres` and `YOUR_PASSWORD` with your PostgreSQL username and password.

---

## 5. Run the migration

From the **`server`** folder:

```bash
cd E:\MVP\server
npx prisma migrate deploy
```

Or for development (creates migration history and applies):

```bash
npx prisma migrate dev --name init
```

If the connection works, you should see: `Applied X migration(s).`

---

## 6. Verify

- **Prisma Studio (browse data):**  
  `cd server` then `npx prisma studio`  
  Opens at http://localhost:5555

- **API:**  
  Start the server with `npm run dev` and open http://localhost:4000/health

---

## Troubleshooting

| Issue | What to try |
|-------|---------------------|
| **Connection refused** | PostgreSQL not running. Start the service (e.g. Windows: Services → postgresql-x64-16). |
| **Password authentication failed** | Check username/password in `DATABASE_URL`; ensure the user can log in (e.g. `psql -U postgres`). |
| **Database "sentinel" does not exist** | Create it (Step 2). |
| **Prisma can't find .env** | Put `.env` in `server/` (next to `prisma/`) and run Prisma commands from `server/`. |
| **SSL/dialect errors** | Add `?schema=public` to the URL; for local DB, SSL is usually not required. |
