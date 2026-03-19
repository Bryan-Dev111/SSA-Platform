# Deploy frontend + backend on Vercel

The project is set up so you can deploy **both** the client and the server on a single Vercel project.

## What was changed

- **server/src/app.ts** — Express app is created and exported here (no `listen`). Used by both local `index.ts` and the Vercel serverless handler.
- **server/src/index.ts** — Imports the app and calls `app.listen()` for local development.
- **api/index.js** (repo root) — Vercel serverless handler: forwards `/api/*` to the Express app (strips `/api` prefix).
- **vercel.json** (repo root) — Builds the server then the client; static output is `client/dist`; rewrites `/api/*` to the serverless function.

## Deploy steps

1. Push the repo to GitHub (or your Git provider).
2. In [vercel.com](https://vercel.com): **Add New** → **Project** → import this repo.
3. **Do not** set a Root Directory (use repo root).
4. **Environment variables** (Project → Settings → Environment Variables): add for **Production** (and Preview if you want):
   - `DATABASE_URL` — your Supabase connection string (same as in `server/.env`).
   - `JWT_SECRET` — same as in `server/.env`.
5. Deploy. Vercel will run the `buildCommand` from `vercel.json` (build server, then client).
6. After deploy, the app is at `https://your-project.vercel.app`. The client uses `/api` for requests (same origin), so you do **not** need to set `VITE_API_URL`.

## Local development

- **Server:** From `server/`, run `npm run dev` (unchanged).
- **Client:** From `client/`, run `npm run dev` (Vite proxy sends `/api` to `localhost:4000`).
- No change to how you develop; only the deployment path uses the serverless wrapper.

## If you use a different backend URL

If you later host the backend elsewhere and only the frontend on Vercel, set **`VITE_API_URL`** in Vercel to your backend URL (e.g. `https://your-api.railway.app`). Then the client will call that URL instead of `/api`.
