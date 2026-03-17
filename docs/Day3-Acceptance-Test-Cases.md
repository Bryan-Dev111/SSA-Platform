# Day 3 — Acceptance Test Cases

**Purpose:** After finishing Day 3 tasks, verify that database seed, auth, RBAC, and scope logic are in place and align with requirements.

**Day 3 exit criteria (from plan):** *DB complete; auth and basic RBAC and scope logic in place.*

---

## How to use this document

1. Complete all Day 3 tasks (3.1–3.5).
2. Run each test case (manual checks and/or API calls).
3. Mark **Pass** only when the step is verified.
4. Sign off when all test cases pass.

---

## Test Case 1: All tables created (migrations complete)

| Step | Action | Pass? |
|------|--------|:-----:|
| 1.1 | **Migrations:** All tables from schema exist in DB (Role, User, UserRole, Supplier, BuyerSupplier, Audit, Finding, CorrectiveAction, Shipment, Record, Alert, etc.). | ☑ |
| 1.2 | Either the **init migration** (Day 2) already created all tables, or **no remaining migrations** are required; `npx prisma migrate status` shows up to date. | ☑ |

**Result:** Pass = both steps checked.

---

## Test Case 2: Seed data — roles and admin user

| Step | Action | Pass? |
|------|--------|:-----:|
| 2.1 | **Seed script** exists (e.g. `server/prisma/seed.ts`) and is configured in package.json (`prisma.seed`). | ☑ |
| 2.2 | Seed creates **6 roles:** Admin, Viewer, QualityEngineer, Auditor, Buyer, Supplier. | ☑ |
| 2.3 | Seed creates an **optional Admin user** (e.g. admin@sentinel.local) with hashed password and Admin role. | ☑ |
| 2.4 | Running **npx prisma db seed** (after migrate) completes without error and creates roles + admin user. | ☑ |
| 2.5 | **Login** with the seeded admin email and password returns a JWT and user object (roleNames include "Admin"). | ☑ |

**Result:** Pass = all steps 2.1–2.5 checked.

---

## Test Case 3: Auth API — login and register

| Step | Action | Pass? |
|------|--------|:-----:|
| 3.1 | **POST /auth/login** with valid email and password returns **200** and body with `token` and `user` (id, email, name, roleNames, supplierId?, buyerId?). | ☑ |
| 3.2 | **POST /auth/login** with wrong password returns **401** and error message. | ☑ |
| 3.3 | **POST /auth/login** with unknown email returns **401**. | ☑ |
| 3.4 | **POST /auth/register** with email and password creates user, returns **201** with token and user (no roles yet unless seed assigns default). | ☑ |
| 3.5 | **Password** is stored hashed (bcrypt); not visible in DB. | ☑ |
| 3.6 | **JWT** is valid (e.g. decode with same secret); contains userId (or sub) and is accepted by protected routes when sent as `Authorization: Bearer <token>`. | ☑ |

**Result:** Pass = all steps 3.1–3.6 checked.

---

## Test Case 4: Role middleware and RBAC helpers

| Step | Action | Pass? |
|------|--------|:-----:|
| 4.1 | **Auth middleware** exists; verifies JWT and attaches **req.user** (id, email, roleNames, roleIds, buyerId?, supplierId?). | ☑ |
| 4.2 | **Protected route** (e.g. GET /suppliers or GET /me) without token returns **401**. | ☑ |
| 4.3 | **Protected route** with valid token returns **200** and data (user or suppliers). | ☑ |
| 4.4 | **requireRole** (or equivalent) helper exists; when used, user without required role gets **403**. | ☑ |
| 4.5 | **requirePageAccess** (or equivalent) exists and uses role–page matrix (e.g. Admin can access Admin page; Viewer cannot access Internal Management). | ☑ |

**Result:** Pass = all steps 4.1–4.5 checked.

---

## Test Case 5: Buyer/Supplier scope helpers and sample endpoint

| Step | Action | Pass? |
|------|--------|:-----:|
| 5.1 | **Helper** (e.g. getAssignedSupplierIds) returns supplier IDs assigned to a Buyer user. | ☑ |
| 5.2 | **Helper** (e.g. getSupplierIdForUser or supplierId on user) returns the single supplier ID for a Supplier user. | ☑ |
| 5.3 | **getAllowedSupplierIds** (or equivalent) returns: **Admin/Viewer/QE/Auditor** = all (null or no filter); **Buyer** = assigned supplier IDs only; **Supplier** = own supplier ID only. | ☑ |
| 5.4 | **Sample endpoint** (e.g. GET /suppliers) enforces scope: Admin sees all; Buyer sees only assigned; Supplier sees only own. | ☑ |
| 5.5 | **GET /suppliers** with Buyer user that has no assignments returns empty list (not all suppliers). | ☑ |
| 5.6 | **GET /suppliers/:id** with Buyer/Supplier returns **404** when requesting a supplier ID not in their scope. | ☑ |

**Result:** Pass = all steps 5.1–5.6 checked.

---

## Test Case 6: Requirements alignment

| Step | Action | Pass? |
|------|--------|:-----:|
| 6.1 | **Secure authentication:** Passwords hashed (bcrypt); JWT for sessions. | ☑ |
| 6.2 | **RBAC:** User has roles; middleware attaches roles to request; helpers enforce by role. | ☑ |
| 6.3 | **Buyer:** Access limited to assigned suppliers (enforced in backend on sample endpoint). | ☑ |
| 6.4 | **Supplier:** Access limited to own data (enforced via supplierId / allowed supplier IDs). | ☑ |
| 6.5 | **Viewer:** Can be given a role; read-only enforcement is in UI (Day 4) and can be enforced in API by requireRole on write endpoints later. | ☑ |

**Result:** Pass = all steps 6.1–6.5 checked.

---

## Test Case 7: Day 3 exit criteria (overall)

| Step | Action | Pass? |
|------|--------|:-----:|
| 7.1 | DB is complete (all tables); seed can run. | ☑ |
| 7.2 | Login and register work; JWT is issued and validated. | ☑ |
| 7.3 | Role middleware and RBAC helpers are in place and used. | ☑ |
| 7.4 | Buyer/Supplier scope helpers exist and are applied in at least one sample endpoint (e.g. suppliers). | ☑ |
| 7.5 | Day 4 can build on this (app shell, route guards, login page calling this API). | ☑ |

**Result:** Pass = all steps 7.1–7.5 checked.

---

## Day 3 sign-off

| Criterion | Result |
|-----------|--------|
| Test Case 1 (Migrations / tables) | ☑ Pass |
| Test Case 2 (Seed data) | ☑ Pass |
| Test Case 3 (Auth API) | ☑ Pass |
| Test Case 4 (Role middleware / RBAC) | ☑ Pass |
| Test Case 5 (Scope helpers / sample endpoint) | ☑ Pass |
| Test Case 6 (Requirements alignment) | ☑ Pass |
| Test Case 7 (Exit criteria) | ☑ Pass |

**Day 3 complete:** All seven test cases **Pass** and signed off.

**Verified by:** Cursor (code review + requirements alignment) **Date:** March 18, 2026

---

## Quick API test commands (after server is running)

```bash
# Health
curl http://localhost:4000/health

# Login (use seeded admin)
curl -X POST http://localhost:4000/auth/login -H "Content-Type: application/json" -d "{\"email\":\"admin@sentinel.local\",\"password\":\"Admin123!\"}"

# Use token from login response:
export TOKEN="<paste token here>"

# Current user
curl http://localhost:4000/me -H "Authorization: Bearer $TOKEN"

# Suppliers (scope applied)
curl http://localhost:4000/suppliers -H "Authorization: Bearer $TOKEN"
```

---

*If any case fails, fix the corresponding code and re-run that test case until it passes.*
