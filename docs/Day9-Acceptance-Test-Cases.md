# Day 9 — Acceptance test cases (full checklist)

**Purpose:** Verify Admin config (9.1–9.4), Supplier Profile portal (9.5), new APIs, RBAC, and delete rules.

**Plan reference:** `Sentinel-Implementation-Plan.md` Day 9.

---

## How to use

1. Run `npx prisma db seed` (optional) to ensure `RiskWeightConfig` row exists.
2. Use JWTs for **Admin**, **Buyer**, **Supplier**, **Viewer**, **QE** as indicated.
3. Mark **Pass** when **Expected** is met.

---

## Section A — Audit types (`/audit-types`)

| ID | Role | Action | Expected | Pass? |
|----|------|--------|----------|:-----:|
| A.1 | None | `GET /audit-types` without token | **401** | ☐ |
| A.2 | Admin | `GET /audit-types` | **200**; `{ list: [...] }` with `id`, `code`, `name` | ☐ |
| A.3 | QE | `GET /audit-types` | **200** | ☐ |
| A.4 | Supplier | `GET /audit-types` | **403** | ☐ |
| A.5 | Admin | `POST /audit-types` `{ "name": "Process" }` (no code) | **201**; auto `TYP-xx` code | ☐ |
| A.6 | Admin | `POST /audit-types` `{ "code": "TYP-99", "name": "Custom" }` | **201** | ☐ |
| A.7 | Admin | `POST` duplicate `code` | **400** | ☐ |
| A.8 | Buyer | `POST /audit-types` | **403** | ☐ |
| A.9 | Admin | `PATCH /audit-types/:id` change `code` / `name` | **200** | ☐ |
| A.10 | Admin | `DELETE /audit-types/:id` while audits still reference it | **400** (in use) | ☐ |
| A.11 | Admin | `DELETE /audit-types/:id` unused type | **204** | ☐ |
| A.12 | UI | **Admin → Audit types** tab: add, edit, delete (unused) | Matches API | ☐ |
| A.13 | UI | **Audits** page: **New audit** still loads types (`GET /audits/types` or `/audit-types`) | Dropdown works | ☐ |
| A.14 | API | `PATCH /audits/:id` with `auditTypeId` (valid id or null) | Audit updated; type reflected in GET | ☐ |

---

## Section B — Risk weights (`/risk-weights`)

| ID | Role | Action | Expected | Pass? |
|----|------|--------|----------|:-----:|
| B.1 | None | `GET /risk-weights` | **401** | ☐ |
| B.2 | Admin | `GET /risk-weights` | **200**; five percent fields + `id` | ☐ |
| B.3 | Viewer | `GET /risk-weights` | **200** | ☐ |
| B.4 | Supplier | `GET /risk-weights` | **403** (not in route roles) | ☐ |
| B.5 | Admin | `PUT /risk-weights` body five numbers summing to **99** | **400** (must sum to 100) | ☐ |
| B.6 | Admin | `PUT` valid `{ qualityPercent:25, auditPercent:25, deliveryPercent:20, carClosurePercent:15, documentationPercent:15 }` | **200** | ☐ |
| B.7 | QE | `PUT /risk-weights` | **403** | ☐ |
| B.8 | UI | **Admin → Risk weights**: edit fields; sum indicator; **Save** when sum = 100 | Persists after reload | ☐ |
| B.9 | Seed | Fresh DB + seed creates `RiskWeightConfig` if missing | Row exists | ☐ |

---

## Section C — Buyers & suppliers

| ID | Role | Action | Expected | Pass? |
|----|------|--------|----------|:-----:|
| C.1 | Admin | `POST /users` `{ email, password, roleNames: ["Buyer"] }` | **201** | ☐ |
| C.2 | Admin | `POST /users` duplicate email | **400** | ☐ |
| C.3 | Admin | `POST /users` `roleNames: ["InvalidRole"]` | **400** | ☐ |
| C.4 | Buyer | `POST /users` | **403** | ☐ |
| C.5 | Admin | `POST /suppliers` `{ name: "ACME" }` | **201**; auto `SUP-xxxxx` | ☐ |
| C.6 | Admin | `PATCH /suppliers/:id` `{ name, city, country }` (subset) | **200** | ☐ |
| C.7 | Admin | `PATCH /suppliers/:id` `{}` | **400** (no fields) | ☐ |
| C.8 | Buyer | `PATCH /suppliers/:id` | **403** | ☐ |
| C.9 | Admin | `POST /buyer-suppliers` `{ buyerId, supplierId }` | **201** | ☐ |
| C.10 | Admin | `POST /buyer-suppliers` non-buyer user as `buyerId` | **400** | ☐ |
| C.11 | Admin | `DELETE /buyer-suppliers/:buyerId/:supplierId` | **204** | ☐ |
| C.12 | Admin | `DELETE /suppliers/:id` | **204**; cascades (or clears `userId` first) | ☐ |
| C.13 | UI | **Admin → Buyers & suppliers**: create user (Buyer/Viewer), create supplier, assign, remove, edit supplier, delete supplier | All succeed | ☐ |
| C.14 | Buyer | After assignment, `GET /suppliers` | Sees assigned supplier only | ☐ |

---

## Section D — Permissions & delete (9.4)

| ID | Step | Expected | Pass? |
|----|------|----------|:-----:|
| D.1 | **Admin → Permissions** tab | Table lists paths vs roles from `PATH_ROLES` | ☐ |
| D.2 | Non-Admin open `/admin` | Blocked by client guard / server | ☐ |
| D.3 | `DELETE /findings/:id` as QE | **403** | ☐ |
| D.4 | `DELETE /opportunities/:id` as Admin | **204** (if id exists) | ☐ |
| D.5 | `DELETE /opportunities/:id` as Buyer | **403** | ☐ |
| D.6 | `DELETE /risk-snapshots/:id` as Admin | **204** | ☐ |
| D.7 | `GET /opportunities` as Buyer (has Risk access) | **200** scoped list | ☐ |
| D.8 | `GET /risk-snapshots` as Viewer | **200** scoped | ☐ |

---

## Section E — Records (`/records`)

| ID | Role | Action | Expected | Pass? |
|----|------|--------|----------|:-----:|
| E.1 | None | `GET /records` | **401** | ☐ |
| E.2 | Supplier | `GET /records` | **200**; only own supplier’s records | ☐ |
| E.3 | Supplier | `POST /records` `{ name, supplierId: own, internalOrSupplier: "supplier" }` | **201** `PENDING` | ☐ |
| E.4 | Supplier | `POST /records` with **another** supplier’s id | **403** | ☐ |
| E.5 | Supplier | `POST /records` `internalOrSupplier: "internal"` | **403** | ☐ |
| E.6 | Admin | `POST /records` for any in-scope supplier | **201** (if allowed) | ☐ |

---

## Section F — Shipments (`/shipments`)

| ID | Role | Action | Expected | Pass? |
|----|------|--------|----------|:-----:|
| F.1 | Supplier | `GET /shipments` | **200**; own supplier rows | ☐ |
| F.2 | Supplier | `POST /shipments` `{ supplierId: own, inspectionDate: "2026-04-01", purchaseOrder, partNumber, qty }` | **201** `WaitingInspection` | ☐ |
| F.3 | Supplier | `POST /shipments` wrong `supplierId` | **403** | ☐ |
| F.4 | Supplier | `POST /shipments` missing `inspectionDate` | **400** | ☐ |
| F.5 | Admin | `POST /shipments` for any supplier | **201** | ☐ |
| F.6 | Viewer | `POST /shipments` | **403** | ☐ |

---

## Section G — Supplier Profile (9.5)

| ID | Role | Step | Expected | Pass? |
|----|------|------|----------|:-----:|
| G.1 | Supplier | Open **Supplier Profile** | Loads `GET /me/supplier-portal` | ☐ |
| G.2 | Supplier | Metrics show **Assigned buyers**, **Open CARs**, **Audits**, **Findings**, **Records**, **Shipment requests** | Numbers match data | ☐ |
| G.3 | Supplier | Tables: Audits, Findings, CARs, Risk, Records, Shipments | Rows render; links to records work | ☐ |
| G.4 | Supplier | **Submit record** (name; optional file ≤8MB) | Creates record; **File** column Yes if uploaded; file on disk under `server/uploads/records/` | ☐ |
| G.5 | Supplier | **Request shipment inspection** form | Creates shipment row | ☐ |
| G.6 | Buyer | Open **Supplier Profile** | Message: not supplier dashboard; link to Supplier List | ☐ |
| G.7 | Supplier | No linked supplier user (`userId` on Supplier) | **404** from API / error UI | ☐ |

---

## Section H — Regression

| ID | Step | Expected | Pass? |
|----|------|----------|:-----:|
| H.1 | **Supplier List** (Admin): commodity dropdown still works (`PATCH` with `commodityTypeId` only) | **200** | ☐ |
| H.2 | Existing **login** / **JWT** for all roles | No breakage | ☐ |

---

## Sign-off

| Block | IDs | All pass? |
|-------|-----|:---------:|
| Audit types | A.1–A.14 | ☐ |
| Risk weights | B.1–B.9 | ☐ |
| Buyers/suppliers | C.1–C.14 | ☐ |
| Permissions & delete | D.1–D.8 | ☐ |
| Records | E.1–E.6 | ☐ |
| Shipments | F.1–F.6 | ☐ |
| Supplier Profile | G.1–G.7 | ☐ |
| Regression | H.1–H.2 | ☐ |

**Tester:** _______________ **Date:** _______________
