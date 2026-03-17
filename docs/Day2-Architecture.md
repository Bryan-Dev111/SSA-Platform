# Day 2 Deliverable 2.1 — Architecture Document

**Project:** Sentinel Supplier Assurance Platform  
**Date:** March 17, 2026

High-level architecture: frontend, backend, database layer, and deployment outline.

---

## 1. System overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CLIENT (Browser)                               │
│  React 18 + Vite + TypeScript                                            │
│  • Pages (16) per role matrix                                            │
│  • Components (layout, guards, forms, tables)                            │
│  • React Router + route guards by role                                   │
│  • Auth context (user, roles, token)                                     │
│  • API client (fetch/axios + Bearer token)                               │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ HTTPS / HTTP
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           SERVER (Node.js)                               │
│  Express + TypeScript                                                    │
│  • REST API (JSON)                                                       │
│  • Auth middleware (JWT verify → req.user)                               │
│  • RBAC middleware (requireRole, requirePageAccess)                     │
│  • Scope helpers (assignedSupplierIds for Buyer, supplierId for Supplier)│
│  • Routes: /auth, /users, /suppliers, /audits, /findings, /cars, ...    │
│  • Workflow logic (Finding/CAR status transitions, approval)             │
│  • Risk service (compute score from weights + data)                     │
│  • Alert service (create alerts; respect user preferences)              │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ Prisma
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           DATABASE                                       │
│  PostgreSQL                                                              │
│  • All tables per schema (users, roles, suppliers, audits, findings,    │
│    corrective_actions, shipments, records, documents, alerts, etc.)      │
│  • Migrations via Prisma                                                 │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Frontend architecture

| Layer | Content |
|-------|---------|
| **Pages** | One (or more) per app page: Dashboard, Risk, Corrective Actions, CAR Record, Findings, Findings Record, Audits, Supplier Profile, Supplier List, Suppliers Map, Records, Shipments, Documents, Internal Management, Admin, Login. |
| **Components** | Layout (sidebar, header), protected route wrapper, role-based menu, reusable form/table components, Sentinel logo. |
| **Routes** | React Router; routes defined; protected routes check auth and (optionally) role/page access; redirect Supplier to Profile (and own Records/Shipments). |
| **State** | Auth context: user, roles, token; set on login; clear on logout. No global store required for Week 1–3. |
| **API** | Base URL from env; attach `Authorization: Bearer <token>`; handle 401 (redirect to login). |

---

## 3. Backend architecture

| Layer | Content |
|-------|---------|
| **API** | REST; JSON; status codes (200, 201, 400, 401, 403, 404, 500). |
| **Auth** | POST /auth/login, POST /auth/register (optional); JWT sign on login; middleware verifies JWT and attaches `req.user` (id, email, roleNames, buyerId if Buyer, supplierId if Supplier). |
| **RBAC** | Middleware/helpers: `requireRole(['Admin','QualityEngineer'])`, `requirePageAccess(pageName)`; used on route handlers. |
| **Scope** | Helpers: `getAssignedSupplierIds(userId)` for Buyer; `getSupplierId(userId)` for Supplier. All supplier-scoped queries filter by these. |
| **Workflow** | Finding: status transitions (Draft → Waiting Disposition → …); CAR: same. Validation of required fields on Save; only approvers can Approve/Reject in Waiting Approval. |
| **Risk service** | Read weight config; aggregate quality/audit/delivery/CAR/documentation metrics per supplier; compute score; return Low/Medium/High. |
| **Alerts** | On events (overdue audit, new finding, etc.) create Alert records; when serving user, filter by UserAlertPreferences (on/off per category). |

---

## 4. Database layer

| Item | Content |
|------|---------|
| **ORM** | Prisma. Single `schema.prisma`; migrations applied via `prisma migrate deploy` (prod) or `prisma migrate dev` (dev). |
| **Tables** | users, roles, user_roles, suppliers, buyer_suppliers, audit_types, audits, findings, corrective_actions, shipments, shipment_schedule, records, documents, internal_docs, risk_snapshots, risk_weight_config, opportunities, alerts, user_alert_preferences. |
| **IDs** | Internal: cuid or uuid. Display codes: SUP-00001, AUD-00001, TYP-00, FIN-00001, CAR-00001 generated in app or DB (see ID format spec). |

---

## 5. Deployment outline

| Component | How |
|-----------|-----|
| **Frontend** | `npm run build` in client → static files in `client/dist`. Serve via nginx or same host. |
| **Backend** | `npm run build` in server → run `node dist/index.js` (or ts-node in dev). Listen on PORT. |
| **Database** | PostgreSQL instance (e.g. cloud or VM). Connection string in env (`DATABASE_URL`). |
| **Reverse proxy** | nginx: / → frontend; /api → backend. Or frontend and backend on different ports in dev. |
| **Secrets** | All in env (DATABASE_URL, JWT_SECRET). No secrets in repo. |

---

## 6. Folder structure (implemented)

```
E:\MVP\
├── client/                    # React + Vite + TypeScript
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── routes/
│   │   ├── context/
│   │   └── api/
│   ├── index.html
│   ├── package.json
│   └── vite.config.ts
├── server/                    # Express + TypeScript
│   ├── prisma/
│   │   └── schema.prisma
│   ├── src/
│   │   ├── routes/
│   │   ├── middleware/
│   │   ├── services/
│   │   └── index.ts
│   ├── package.json
│   └── tsconfig.json
├── docs/
├── .env.example
└── .gitignore
```

---

**Sign-off:** Architecture documented; sufficient for Day 3–4 implementation.
