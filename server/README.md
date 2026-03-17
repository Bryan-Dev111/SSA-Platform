# Sentinel API (Server)

## Setup

1. Copy `../.env.example` to `../.env` (or create `.env` in project root) and set `DATABASE_URL` to your PostgreSQL connection string.
2. Install and generate Prisma client:
   ```bash
   npm install
   npx prisma generate
   ```
3. Apply the database migration (when PostgreSQL is running):
   ```bash
   npx prisma migrate deploy
   ```
   Or for development with a new DB:
   ```bash
   npx prisma migrate dev --name init
   ```

## Scripts

- `npm run dev` — Start API with tsx watch
- `npm run build` — Compile TypeScript to `dist/`
- `npm run start` — Run `dist/index.js`
- `npm run db:migrate` — Run migrations (dev)
- `npm run db:studio` — Open Prisma Studio
