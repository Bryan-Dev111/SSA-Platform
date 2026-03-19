# Requirement alignment checklist

Quick verification that the current codebase matches the stated requirements (Sentinel Implementation Plan and role matrix).

---

## Delete permissions (Admin only)

| Entity   | Server enforcement | Client (UI) |
|----------|--------------------|------------|
| Finding  | `findings.ts`: 403 if not Admin | Findings table: Delete column only when `isAdmin` |
| Audit    | `audits.ts`: 403 if not Admin | Audits table: Delete column only when `isAdmin` |
| CAR      | `cars.ts`: 403 if not Admin   | Corrective Actions table: Delete column only when `isAdmin` |
| Supplier | `suppliers.ts` `DELETE`: Admin only | Admin → Buyers & suppliers: Delete supplier |
| Opportunity | `opportunities.ts` `DELETE`: Admin only | (Risk UI placeholder; API ready) |
| Risk snapshot | `risk-snapshots.ts` `DELETE`: Admin only | (Risk UI placeholder; API ready) |

Only Admin can delete these entities where implemented; server rejects non-Admin; list UIs show Delete only for Admin where applicable.

---

## Corrective Actions (CAR)

- Pagination: page size (5/10/20/50), Previous/Next, “X–Y of total”.
- Status dropdown: Process / Reverse / Approve / Reject by status; only Admin, QE, Buyer (`canChangeCarStatus`).
- Delete: Admin only; ConfirmDialog; calls `DELETE /cars/:id`.
- Row color by status: `car-row--draft`, `waiting-disposition`, `waiting-approval`, `closed`, `follow-up`, `unknown`.
- **Day 7.4 charts:** Top defect codes (from `GET /cars` `defectCodeCounts`); **CARs by severity** horizontal bar chart (`severityCounts`).
- CAR Record / Findings Record: not in sidebar (removed from `MENU_ITEMS`); access via Corrective Actions (New CAR, CAR code link) and Findings (New finding, finding code link).

---

## Findings

- Pagination: same pattern as CAR.
- Status dropdown: Process / Reverse / Approve / Reject; Admin, QE, Auditor for change; Approve/Reject Admin, QE only.
- Delete: Admin only; ConfirmDialog; `DELETE /findings/:id`.
- Row color by status: `finding-row--draft`, `waiting-disposition`, `waiting-approval`, `closed`, `follow-up`, `unknown`.

---

## Audits

- Pagination: same pattern as CAR/Findings.
- Set result: Admin and Quality Engineer only (`canSetResult`); Passed / Failed / Cancelled.
- Create audit: Admin and QE (`canCreateAudit`).
- Delete: Admin only; ConfirmDialog; `DELETE /audits/:id`.
- Row color by derived status: `audit-row--scheduled`, `in-process`, `overdue`, `complete`, `cancelled`, `unknown`.
- Finding links: clickable codes → Findings Record.

---

## Navigation and access

- Sidebar: no “CAR Record” or “Findings Record” tabs; both removed from `MENU_ITEMS`.
- Routes: `/car-record` and `/findings-record` still exist; reachable via list pages and back links.
- Fallback path: `getDefaultPath` uses `/corrective-actions` when user has no Dashboard access (e.g. Auditor).
- Role–page access: `rolePageAccess.ts` and Layout filter by `canAccessPath`; Supplier limited to `SUPPLIER_PATHS`.

---

## CAR Record / Findings Record pages

- Back link: “← Back to Corrective Actions” and “← Back to Findings” always visible (including New CAR / New Finding).
- Viewer/Auditor: cannot create CAR (redirect to Corrective Actions); Findings Record create restricted by `canCreateNew`.

---

## Day 8 — Admin reference data & codes

| Area | Requirement | Implementation |
|------|-------------|----------------|
| 8.1 CAR workflow | Save DRAFT→RCCA; Process/Reverse; Approve/Reject; **no reverse to DRAFT** | `server/src/routes/cars.ts` (reverse rejects `prev === 'DRAFT'`); UI disables Reverse from RCCA |
| 8.2 CAR Record | Fields, link to Finding, status history, open by CAR # | `CARRecord.tsx`; Finding link; single-row status history |
| 8.3 Commodity types | CRUD; used for supplier classification | `GET/POST/PATCH/DELETE /commodity-types`; Admin UI; **Supplier List** (Admin) assigns `commodityTypeId` via `PATCH /suppliers/:id` |
| 8.4 Defect codes | CRUD; used in Findings and CARs | `defect-codes` routes; seed + Admin UI; `ReferenceCodeSelect` on Findings Record and CAR Record |
| 8.5 Disposition codes | CRUD; used in Findings workflow | `disposition-codes` routes; `Finding.dispositionCode`; dropdown on Findings Record |

- **GET** lists for codes: active only by default; **Admin** may use `?all=1` for inactive rows on Admin page.
- **Data migration:** `prisma/migrations/20260325000000_day8_defect_disposition_codes`.

---

## Day 9 — Permissions & delete (9.4)

| Topic | Implementation |
|-------|----------------|
| Who sees which pages (client) | `client/src/config/rolePageAccess.ts` (`PATH_ROLES`); **Admin → Permissions** shows this table. |
| Who sees which API routes (server) | `server/src/middleware/rbac.ts` **`API_PAGE_ROLES`**; **Findings** use `requirePageAccess('Findings')` (includes **Auditor**, matches client `/findings`). |
| Live matrix for Admins | **`GET /users/permission-matrix`** returns `apiPageRoles` + **`adminOnlyDeletes`** list. |
| Admin-only delete | **Finding** `DELETE /findings/:id`; **Audit** `DELETE /audits/:id`; **CAR** `DELETE /cars/:id`; **Risk snapshot** `DELETE /risk-snapshots/:id`; **Opportunity** `DELETE /opportunities/:id`; **Supplier** `DELETE /suppliers/:idOrCode` — all return **403** if not Admin (plus scope checks where applicable). |
| Client delete UI | Findings / Audits / CARs: Delete column only when `isAdmin`; Supplier delete in Admin → Buyers & suppliers. |

---

## Day 9.5 — Supplier Profile (supplier view)

| Topic | Implementation |
|-------|----------------|
| Portal data | **`GET /me/supplier-portal`** (Supplier only): supplier info, assigned buyers, audits, findings (non-DRAFT), CARs (non-DRAFT), risk snapshots, records, shipments, metrics. |
| Client | **`SupplierProfile.tsx`**: metric tiles (buyers, open CARs, audits, findings, **records**, **shipments**); tables; **Upload record** (name + optional file via `fileBase64`); **Request shipment inspection** (PO, Part #, Qty, inspection date → `POST /shipments`). |
| Record files | **`POST /records`**: optional `fileBase64` + `fileName`; saved under `server/uploads/records/`; `filePath` stored (relative `records/...`). **Supplier** cannot set arbitrary `filePath` (staff may pass `filePath` for internal metadata). |
| Unlinked Supplier user | Portal **404**; **`getAllowedSupplierIds`** returns **`[]`** for Supplier role without linked supplier (no global supplier list). |

---

## Day 10 — Shipments, Records, Documents, Internal Management

| Topic | Implementation |
|-------|----------------|
| Shipments API | **`GET/PATCH /shipments`**, **`GET /shipments/metrics`** (OTD vs schedule, FPY, counts); **`PATCH /shipments/:id`** with `{ result: Passed \| Failed }` — **Admin, QE** only. |
| Shipment schedule | **`/shipment-schedule`**: **GET** (scoped); **POST/PATCH/DELETE** — **Admin** only. |
| Shipments UI | **`Shipments.tsx`**: metrics, inspection requests table, schedule table, Pass/Fail, admin add/delete schedule. |
| Records API | **`PATCH /records/:id`** approve/reject (**Admin, QE**); **`GET /records/:id/download`** (scoped). |
| Records UI | **`Records.tsx`**: filter, upload (role-gated), table, Approve/Reject, Download. |
| Documents | **`/documents`**: full CRUD (**POST/PATCH/DELETE** — **Admin, QE**); **GET** + download for **Documents** roles; types match Prisma **`DocumentType`**. |
| Internal Management | **`/internal-docs`**: **Admin** only; list, upload, download, delete. |
| Files | **`server/src/lib/uploads.ts`** — `uploads/records`, `uploads/documents`, `uploads/internal` under `server/uploads/`. |

---

## Database

- App and Prisma use `DATABASE_URL` from `server/.env` (and root `.env` when loaded). Configured to client’s Supabase when provided.
- Migrations: `npx prisma migrate deploy` applies schema to the database pointed to by `DATABASE_URL`. Run once on client’s project if it is new/empty.

---

**Summary:** Through **Day 10**, Shipments (requests + schedule + metrics), Records (review + download), Documents, and Internal Management are implemented per plan; Risk **page** UI remains for **Day 11** while weights/snapshots APIs exist.
