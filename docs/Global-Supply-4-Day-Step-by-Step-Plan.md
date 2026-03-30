# Global Vendors (Global Supply) — Step-by-Step 4-Day Plan

This document is a **sequenced, detailed checklist** for implementing the client’s **Global Supply / Global Vendors** requirements **inside the current Sentinel SSA-Platform codebase**.

| Item | Status |
|------|--------|
| **In scope** | Farms map, Farmer Information, Approved Farmers List, Relationship & Trust, Farmer Profile (+ admin text/images), Processing & Quality (+ admin text/images), Purchase Orders (+ files), Samples (+ files), Expenses (+ total), RBAC, Product Hub entry. |
| **Explicitly excluded** | **§1 Commodity Dashboard** (inventory metrics, bar charts, pie charts, revenue tiles) — schedule separately. |

**Companion doc:** High-level architecture and data model summary → `docs/Global-Supply-4-Day-Implementation-Plan.md`.

**Assumptions:** One developer (or pair); ~8 focused hours per day; PostgreSQL + existing server/client stack; you can run migrations against dev DB.

---

## Before Day 1 (prep — same calendar day or evening before)

1. [ ] Read the client Word spec once end-to-end; **highlight** every column for **Farmer Information** (this drives Prisma fields).
2. [ ] Export or screenshot the **final column list** into a spreadsheet (column name, type, required, notes).
3. [ ] Confirm with client: **roles** who use Global Vendors (e.g. Admin, Buyer only) — write the list down; you will mirror it in `PATH_ROLES` and `PAGE_DEFINITIONS`.
4. [ ] Create a git branch: `feature/global-vendors` (or similar).
5. [ ] Ensure local **server** and **client** run (`npm run dev` / `npm run build` clean).

---

# DAY 1 — Data foundation + Farmer Information + Approved list

**Theme:** *Database truth + first two user-visible pages.*

---

## Block 1.1 — Prisma schema for `Farm` (morning)

1. [ ] Open `server/prisma/schema.prisma`.
2. [ ] Add model **`Farm`** (or agreed name) with at minimum:
   - [ ] `id` (`String` `@id` `@default(cuid())`)
   - [ ] `code` (`String` `@unique`) — will store `FARM-00001` style
   - [ ] `farmName`, `farmerName`, `country`, `city` (modal MVP)
   - [ ] Add **nullable** fields you already know from spec for lat/long, region, category, crops, etc. (expand in same migration if list is ready; otherwise add `Json` field `extendedAttributes` as temporary — only if client agrees)
3. [ ] Add indexes you need early: e.g. `@@index([code])`, `@@index([country])`.
4. [ ] Run: `npx prisma migrate dev --name add_farm` (or `db push` in pure prototype — prefer migrate for traceability).
5. [ ] Run: `npx prisma generate`.
6. [ ] **Verify:** `npx prisma studio` — `Farm` table exists; insert one manual row optional.

---

## Block 1.2 — Server: code generator + `GET`/`POST` farms (morning)

1. [ ] Locate existing **numeric code** patterns (e.g. supplier code, finding code) in `server/src` — copy the **transaction / max+1 / pad** approach (or use a dedicated `FarmCodeSequence` table if you need concurrency safety).
2. [ ] Add `server/src/services/farmCode.ts` (or similar): `async function nextFarmCode(): Promise<string>`.
3. [ ] Add `server/src/routes/farms.ts` (new router):
   - [ ] `GET /farms` — `findMany`, `orderBy: { code: 'asc' }`, `select` fields needed for table.
   - [ ] `POST /farms` — validate body; assign `code = await nextFarmCode()`; `create`.
4. [ ] Register router in `server/src/index.ts` (or wherever routers mount) under prefix **`/farms`** or **`/global-vendors/farms`** — **pick one and keep it forever in this phase**.
5. [ ] Protect routes: `authMiddleware` + `requirePageAccess('GlobalSupplyFarmers')` (or the key name you add in §1.4).
6. [ ] **Verify:** `curl` or Thunder Client with Admin token — `POST` creates row with `FARM-…`; `GET` returns list.

---

## Block 1.3 — Permissions: server + client keys (morning / early afternoon)

1. [ ] In `server/src/lib/permissions.ts`:
   - [ ] Append to **`PAGE_DEFINITIONS`** at least: `{ key: 'GlobalSupplyFarmers', label: '…', path: '/global-vendors/farmers' }` (path must match client route).
   - [ ] Extend **`DEFAULT_PATH_ROLES`** and **`DEFAULT_API_PAGE_ROLES`** for that path with agreed roles.
2. [ ] In `server/src/middleware/rbac.ts` — ensure `API_PAGE_ROLES` includes the same page key if used by `requirePageAccess`.
3. [ ] In `client/src/config/rolePageAccess.ts`:
   - [ ] Add `'/global-vendors/farmers': [...]` (and any parent path like `/global-vendors` if you guard it).
4. [ ] **Verify:** Log in as Admin → Admin → Permissions shows new column; toggles persist.

---

## Block 1.4 — Client: routes + Farmer Information page (afternoon)

1. [ ] Create folder `client/src/pages/globalVendors/` (name as you prefer).
2. [ ] Add `FarmersInformationPage.tsx`:
   - [ ] On mount: `GET /farms` with `apiJson` + `token`.
   - [ ] Render `<table>` with MVP columns (expand later).
   - [ ] **Add Farmer** button → modal with `farmName`, `farmerName`, `country`, `city` → `POST /farms` → refresh list → toast success/error.
3. [ ] In `client/src/App.tsx`:
   - [ ] Nest routes under `Layout`: e.g. `path="global-vendors/farmers"` → `ProtectedRoute path="/global-vendors/farmers"` → new page component.
4. [ ] **Verify:** Navigate to `/global-vendors/farmers` — table loads; modal creates farm.

---

## Block 1.5 — Approved Farmers List (afternoon)

1. [ ] Either:
   - [ ] **Option A:** `GET /farms` with same data + client-side column subset, **or**
   - [ ] **Option B:** `GET /farms/approved` server projection (fewer fields).
2. [ ] Add `ApprovedFarmersPage.tsx` — table columns per spec (Farm ID, Farm Name, Farm Category, Country, Region, Main Crop, Elevation, Production Style — use placeholders `—` until fields exist on `Farm`).
3. [ ] Register route `global-vendors/approved` and `PATH_ROLES` + `PAGE_DEFINITIONS` if separate permission desired (or reuse same key as farmers — product decision).
4. [ ] **Verify:** List matches farmers created in 1.4.

---

## Block 1.6 — Product Hub + Global Vendors entry (end of day)

1. [ ] Update `client/src/pages/ProductHub.tsx` (right panel navigation): `navigate('/global-vendors/farmers')` (or your home route).
2. [ ] Replace or redirect `GlobalVendorsHome.tsx`:
   - [ ] Either delete placeholder content and `<Navigate to="/global-vendors/farmers" replace />`, **or**
   - [ ] Keep a tiny landing with two links (Farmers / Approved).
3. [ ] In `Layout.tsx`, add **Global Vendors** subsection with links to **Farmer Information** and **Approved** (only paths user can access).
4. [ ] **Verify:** Login → Product Hub → right side → lands on GSV; sidebar shows links; no 403 for allowed role.

---

## Day 1 — End-of-day checklist

- [ ] Migration applied on dev DB; no pending broken state.
- [ ] At least **one** farm creatable from UI; appears in **Approved** list.
- [ ] Permissions row exists for new page(s).
- [ ] Commit: `git commit -m "feat(gv): Farm model, farms API, farmers + approved pages"` (message as you prefer).

---

# DAY 2 — Map + Relationship & Trust + column polish

**Theme:** *Geography + trust fields + RBAC hardening.*

---

## Block 2.1 — Farms map (morning)

1. [ ] Open `client/src/pages/SuppliersMap.tsx` — note **map library**, tile URL, marker component.
2. [ ] Ensure `Farm` has `latitude` / `longitude` as `Float?` (or `Decimal`) in Prisma; migrate if missing.
3. [ ] Add `GET /farms/map` returning `{ id, code, farmName, latitude, longitude }` where lat/lng **not null**.
4. [ ] Add `FarmsMapPage.tsx`:
   - [ ] Fetch map payload.
   - [ ] Render markers **red** (match spec); **tooltip** on hover: `code` + `farmName`.
   - [ ] Handle **empty** map (no coords) with user-friendly message.
5. [ ] Route: `global-vendors/map`; add to sidebar; add `PAGE_DEFINITIONS` + `PATH_ROLES` + server `DEFAULT_PATH_ROLES`.
6. [ ] **Verify:** Create farm with coords in DB → pin appears; farm without coords → not on map (or list separately — document behavior).

---

## Block 2.2 — Relationship & Trust (morning / afternoon)

1. [ ] Add fields to `Farm` or separate `FarmRelationship` model:
   - [ ] `firstContactDate`, `lastVisitDate`, `visitCount`, `relationshipStatus` (string or enum).
2. [ ] Migrate.
3. [ ] Add `PATCH /farms/:id/relationship` or include in `PATCH /farms/:id`.
4. [ ] `RelationshipTrustPage.tsx` — table + inline edit (or modal) saving **only** these fields.
5. [ ] Route + permissions + sidebar link.
6. [ ] **Verify:** Edit saves; refresh shows values.

---

## Block 2.3 — Farmer table: wide columns + UX (afternoon)

1. [ ] Add remaining **Farmer Information** columns to Prisma (batch migration if large).
2. [ ] Extend `PATCH /farms/:id` for full update; validate types.
3. [ ] Update `FarmersInformationPage` table:
   - [ ] Horizontal scroll wrapper (`table-wrap` class if exists).
   - [ ] Sticky header (CSS).
   - [ ] Optional: row **Edit** opens modal or drawer with all fields.
4. [ ] **Verify:** No console errors; performance OK with ~100 rows (seed test data if needed).

---

## Block 2.4 — QA + roles (end of day)

1. [ ] Create test user with **Buyer** (or client-approved role) — only GSV pages, no Admin.
2. [ ] Confirm **403** or redirect on forbidden routes.
3. [ ] **Regression:** Sentinel Vendor Warranty (`/dashboard`) still works; Product Hub left panel works.
4. [ ] Commit: `feat(gv): map, relationship fields, farmer table polish`.

---

## Day 2 — End-of-day checklist

- [ ] Map live with pins.
- [ ] Relationship fields persisted.
- [ ] Farmer master table usable for demo.

---

# DAY 3 — Purchase Orders + Samples + file attachments

**Theme:** *Transactions + uploads.*

---

## Block 3.1 — Purchase Order model + API (morning)

1. [ ] Prisma: `PurchaseOrder` model:
   - [ ] `id`, `code` unique (`PO-00001`), `farmId` FK, `poStatus`, buyer fields, dates, crop, qty, `pricePerKg`, `totalValue` (computed in server or DB), logistics fields per spec.
2. [ ] Migrate.
3. [ ] Implement `nextPoCode()` similar to farms.
4. [ ] `GET /purchase-orders` — list with `include: { farm: true }` optional.
5. [ ] `POST /purchase-orders` — body validation; create.
6. [ ] **Dropdown data:** `GET /purchase-orders/open` or filter `status` + `GET` farms for Farm ID column.
7. [ ] Protect with `requirePageAccess('GlobalSupplyPurchaseOrders')` (or grouped key — stay consistent).
8. [ ] **Verify:** Create PO via API; code unique.

---

## Block 3.2 — PO attachments (morning / afternoon)

1. [ ] Find existing **file upload** route (Records/Documents) — copy `multer` config, storage path, `maxFileSize`.
2. [ ] Prisma: `PurchaseOrderAttachment` — `purchaseOrderId`, `kind` enum (`Invoice` | `Certificate` | `Contract` | `NoteFile`), `fileName`, `storageKey`, `mimeType`, `size`.
3. [ ] `POST /purchase-orders/:id/attachments` — multipart; `kind` in field or query.
4. [ ] `GET` PO detail returns attachment metadata + download URL pattern.
5. [ ] **Verify:** Upload one file per kind; DB rows correct; download opens file.

---

## Block 3.3 — Purchase Orders UI (afternoon)

1. [ ] `PurchaseOrdersPage.tsx`:
   - [ ] **Add PO** button; dropdown: existing **open** POs + **“New Purchase Order”**; new → call `POST` then select new row.
   - [ ] Table with all columns (horizontal scroll).
   - [ ] **Total Value** = `quantity * pricePerKg` (client display + server truth on save).
   - [ ] Per-row file inputs or modal for Invoice / Certificates / Contracts / Notes.
2. [ ] Route `global-vendors/purchase-orders`; permissions; sidebar.
3. [ ] **Verify:** End-to-end create PO + attach file.

---

## Block 3.4 — Samples (afternoon)

1. [ ] Prisma: `Sample` — `code` (`SAMP-0001`), `buyerName`, `buyerEmail`, `farmId`, `crop`, `dateSent`, `deliveryAddress`, etc.
2. [ ] `nextSampleCode()`; `GET/POST /samples`.
3. [ ] Add Sample modal: `Buyer`, `Farm ID` (dropdown from farms), `Crop` → POST.
4. [ ] **Notes files:** reuse attachment pattern (`SampleAttachment` or generic `Attachment` with polymorphic parent — choose simplest).
5. [ ] `SamplesPage.tsx` + route + permissions.
6. [ ] **Verify:** Create sample; list shows; file attaches.

---

## Day 3 — End-of-day checklist

- [ ] PO + at least one attachment kind working.
- [ ] Sample created with generated `SAMP-` code.
- [ ] Commit: `feat(gv): purchase orders, samples, attachments`.

---

# DAY 4 — Expenses + Farmer Profile + Processing + CMS-lite + hardening

**Theme:** *Money + marketing pages + ship quality.*

---

## Block 4.1 — Expenses (morning)

1. [ ] Prisma: `Expense` — `code` (`EXP-0001`), `expenseDate`, `description`, `amount` (Decimal), optional `farmId`.
2. [ ] `nextExpenseCode()`; `GET /expenses` (sum: `aggregate` `_sum.amount`).
3. [ ] `POST /expenses`.
4. [ ] `ExpensesPage.tsx`:
   - [ ] Add form (date, description, price).
   - [ ] Table listing all.
   - [ ] **Total amount spent** at top (`useMemo` from list or server `total`).
5. [ ] Route + permissions + sidebar.
6. [ ] **Verify:** Total matches sum of rows.

---

## Block 4.2 — Farmer Profile page (morning / afternoon)

1. [ ] `FarmProfilePage.tsx` — query param or route `global-vendors/farmers/:farmId/profile`.
2. [ ] Top strip: Farm ID, Farm Name, Main/Secondary crop, Country, Region, Elevation (from `Farm`).
3. [ ] Below: read-only table of **detail fields** from farmer record.
4. [ ] **Admin-only** section:
   - [ ] **Option A:** `textarea` for markdown/HTML stored in `FarmProfileContent` (or `Farm.profileHtml`).
   - [ ] **Image upload:** `POST /farms/:id/profile-images` — store files; `GET` returns list; render `<img>` in grid.
5. [ ] **Verify:** Non-admin cannot edit (hide or disable save).

---

## Block 4.3 — Processing & Quality page (afternoon)

1. [ ] Duplicate shell from `FarmProfilePage` or shared layout component `FarmDetailShell`.
2. [ ] Route `global-vendors/farmers/:farmId/processing`.
3. [ ] Show **main** processing + quality fields; **if** secondary crop filled, show **secondary** block (conditional render).
4. [ ] **Separate** `section` in `FarmProfileContent` or `FarmProcessingHtml` — same image upload pattern with `section=Processing`.
5. [ ] **Verify:** Data matches spec; empty secondary hidden.

---

## Block 4.4 — Hardening + docs (afternoon)

1. [ ] **404:** Farm ID invalid → friendly message + link back to list.
2. [ ] **Loading / error** states on all new pages (spinner + `alert` or toast).
3. [ ] **Mobile:** spot-check Product Hub + one GSV table on narrow width.
4. [ ] **README** or `docs/` one-pager: env vars, new routes, how to seed demo.
5. [ ] Run `npm run build` in **client** and **server** — fix all TS errors.
6. [ ] **Manual regression:** Login → Product Hub → both sides → Admin → Permissions shows new keys.

---

## Day 4 — End-of-day checklist

- [ ] Expenses + total correct.
- [ ] Farmer Profile + Processing pages demo-ready.
- [ ] Admin can add text + at least one image per page.
- [ ] Build green; ready for client demo.

---

## Final commit (end of Day 4)

1. [ ] Squash or merge branch per team policy.
2. [ ] Tag release: `gv-mvp-v0.1` (optional).
3. [ ] Handoff checklist to client (appendix in `Global-Supply-4-Day-Implementation-Plan.md`).

---

## If you fall behind — cut order (do not skip silently)

1. **First:** Drop **secondary** crop UI block on Processing page; show single primary block only.
2. **Second:** Defer **multiple images** — one hero image only.
3. **Third:** **Samples** file notes → plain text `notes` field instead of files.
4. **Fourth:** **PO** file types — start with **Invoice** only; add others next week.

---

## Explicitly NOT in these 4 days

- [ ] **Commodity Dashboard** (metrics, charts, inventory KPIs).
- [ ] Full **WYSIWYG** editor (use textarea + markdown unless library already in project).
- [ ] **Email notifications** for PO/Sample status.
- [ ] **Bulk import** CSV of farms.

---

*Document: step-by-step 4-day plan. Keep in sync with `docs/Global-Supply-4-Day-Implementation-Plan.md`.*
