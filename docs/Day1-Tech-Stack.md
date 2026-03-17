# Day 1 Deliverable 1.5 — Tech Stack

**Project:** Sentinel Supplier Assurance Platform  
**Date:** March 16, 2026

Single recommended stack for the 3-week build. One choice per layer — no alternatives; lock and build.

---

## Recommended stack

| Layer | Technology | Why |
|-------|------------|-----|
| **Frontend** | **React 18 + Vite + TypeScript** | Fast dev server, small bundle, type safety; standard for SPAs; easy role-based routing and placeholder pages. |
| **Backend** | **Node.js + Express + TypeScript** | Same language as frontend; fast to build REST API, JWT auth, RBAC middleware, and Buyer/Supplier scope helpers. |
| **Database** | **PostgreSQL** | Robust, fits relational model (suppliers, audits, findings, CARs, shipments); strong ecosystem. |
| **ORM / migrations** | **Prisma** | Type-safe schema, declarative migrations, clean API; integrates with Express and JWT (user/role in context). |
| **Auth** | **JWT (access token) + bcrypt** | Stateless; login returns JWT; password hashing with bcrypt. Optional: refresh token later. |

---

## Frontend details

- **React 18** — UI components, hooks.
- **Vite** — build tool and dev server (fast HMR).
- **TypeScript** — types for props, API responses, auth state.
- **React Router** — routes and route guards (by role).
- **Fetch or axios** — HTTP to backend; attach `Authorization: Bearer <token>`.
- **State:** React context (or Zustand) for auth user + role; no need for Redux for this scope.

---

## Backend details

- **Express** — REST API; `express.json()`; CORS configured.
- **TypeScript** — shared types with frontend where useful.
- **Prisma** — `prisma/schema.prisma` = single source of truth; `prisma migrate` for DB.
- **Auth:** `jsonwebtoken` (sign/verify), `bcrypt` (hash/compare). Middleware: decode JWT → attach `req.user` (id, email, role(s), buyerId/supplierId if any).
- **RBAC:** Helper e.g. `requireRole(['Admin','QualityEngineer'])`, `requirePageAccess(pageName)`; Buyer/Supplier scope in service layer (filter by `assignedSupplierIds` or `user.supplierId`).

---

## Deployment (outline)

- **Frontend:** `npm run build` → serve `dist/` (nginx or same host).
- **Backend:** `node dist/server.js` (or `ts-node` in dev); reverse proxy (nginx) to API.
- **PostgreSQL:** Single instance; connection string in env.
- Full deployment steps in Week 3.

---

## Environment variables

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Sign/verify access tokens |
| `PORT` | Backend port (e.g. 4000) |
| `NODE_ENV` | `development` / `production` |
| (Optional) | Email config for alerts (Week 3) |

No secrets in repo; use `.env` (and `.env.example` without values).

---

## Folder structure (to create in Day 2)

```
sentinel/
├── client/                 # React + Vite + TS
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── routes/
│   │   ├── context/         # e.g. AuthContext
│   │   └── api/
│   └── package.json
├── server/                  # Express + TS
│   ├── src/
│   │   ├── routes/
│   │   ├── middleware/      # auth, rbac, scope
│   │   ├── services/
│   │   └── index.ts
│   ├── prisma/
│   │   └── schema.prisma
│   └── package.json
└── .env.example
```

---

**Sign-off:** This stack is locked for the 3-week build. Tech stack complete for Day 1.
