# Global Vendors (Global Supply) — 4-Day Implementation Plan

**Product:** Sentinel SSA-Platform — *additional* module under **Global Vendors → Additional Products**  
**Source:** Client functional requirements (commodity / farmer–buyer workflows)  
**Explicitly out of scope for this plan:** **§1 Commodity Dashboard** (metrics, bar charts, pie charts) — implement in a later phase.  
**Calendar:** 4 working days (this document sequences work; adjust hours to your team size).

---

## 1. Goals and success criteria

| Goal | Success looks like |
|------|---------------------|
| **Single product, two areas** | Users pick **Global Vendors** on the Product Hub; inside that area they get a dedicated nav and routes under a clear URL prefix (e.g. `/global-vendors/...`). |
| **Farmer as system of record** | **Farmer Information** is the master entity; other pages **read** from it (Approved list, map, profiles, PO/Sample joins). |
| **Stable IDs** | Auto-generated human-readable codes: `FARM-00001`, `PO-00001`, `SAMP-00001`, `EXP-00001` (align with existing app ID patterns). |
| **Files** | Purchase orders (and later samples/notes) support **attachments** using the same storage approach as existing **Records** / uploads (reuse patterns; avoid a second storage system). |
| **Permissions** | New routes appear in **Admin → Permissions** (extend `PAGE_DEFINITIONS` / RBAC) and **Layout** nav for allowed roles only. |

**Non-goals for the 4-day window:** Commodity Dashboard analytics; full CMS polish rivaling external site builders; mobile-native apps; SSO changes.

---

## 2. Requirement inventory (excluding Commodity Dashboard)

Cross-check against the signed-off spec. Numbering follows the client document’s **major sections** (dashboard omitted).

| # | Module | Core behavior |
|---|--------|----------------|
| A | **Farms map** | Map uses **latitude / longitude** from farmer record; **red** markers; hover/tooltip: **Farm ID / name**. |
| B | **Farmer Information** | **Add Farmer** opens modal (minimum: Farm name, Farmer name, Country, City — extend to full field list); auto **Farm ID**; main **table** with all agreed columns (agronomy, processing, contact, etc.). |
| C | **Approved Farmers List** | Table: subset of columns **from Farmer Information** (Farm ID, Farm Name, Farm Category, Country, Region, Main Crop, Elevation, Production Style per spec). |
| D | **Relationship & Trust** | Table: columns from farmer **plus** First Contact Date, Last Visit Date, Visit Counts, Relationship Status (editable). |
| E | **Farmer Profile** | Farm ID lookup; header strip (Farm ID, Name, Main/Secondary crop, Country, Region, Elevation); detail table from farmer record; **Admin** can add **rich text + images** on the page. |
| F | **Processing & Quality** | Same shell as Farmer Profile; table focused on processing/quality fields; **secondary** block when secondary crop filled; Admin **images + text**. |
| G | **Purchase Orders** | Add PO; dropdown: open POs + **“New Purchase Order”**; new → auto **PO-00000**; wide table + **file** slots (Invoice, Certificates, Contracts, Notes files). |
| H | **Samples** | Add Sample modal: Buyer, Farm ID, Crop → **SAMP-0000**; table with buyer/contact/shipping + **Notes files**. |
| I | **Expenses** | Add Expense (Date, Description, Price) → **EXP-000**; table; **Total amount spent** summary. |

---

## 3. Alignment with the **current** codebase

### 3.1 Entry points already in place

- **Product Hub** (`/product-hub`): left = Sentinel Vendor Warranty; right should ultimately land in **Global Vendors** shell (replace placeholder `GlobalVendorsHome` with a **layout + outlet** or redirect to first GSV route).
- **Paths** today: `/global-vendors` is a placeholder — evolve into **either**:
  - **Option A (recommended):** `Layout` children under `global-vendors/*` with a **nested layout** (sub-sidebar or top tabs), **or**
  - **Option B:** Dedicated `GlobalVendorsLayout` route **outside** main `Layout` (matches “separate product” feel; more UI work).

For a 4-day sprint, **Option A** is usually faster: one app shell, new menu section **“Global Vendors”** with links only when `pathname.startsWith('/global-vendors')` **or** always show the section for roles that have any GSV page.

### 3.2 Patterns to reuse (do not reinvent)

| Concern | Where to look in repo |
|--------|------------------------|
| **Auth + `pathRoles`** | `server/src/lib/permissions.ts`, `client/src/config/rolePageAccess.ts`, login payload `pathRoles` merge. |
| **RBAC on routes** | `requirePageAccess` in server; `ProtectedRoute path="..."` on client. |
| **ID generation** | Existing `*-00001` patterns (e.g. suppliers, findings) — mirror in a small `lib/ids.ts` service. |
| **File upload + storage** | Records / documents flows (`server` multer/S3 or local, `prisma` file metadata). |
| **Maps** | `SuppliersMap.tsx` + risk/geo patterns — reuse map library and tile setup for **farm** pins. |
| **Admin CRUD tables** | `AdminDay9Panels`, `InternalManagement` tabs — match table/form patterns. |

### 3.3 Naming and schema discipline

- Use **`Farm` / `Farmer`** (or a single `Farm` model with `farmerName`) — **do not** overload `Supplier`.
- New Prisma models live in **`schema.prisma`** with clear relation names; migrations committed per day or batched end of Day 1 after model freeze.

---

## 4. Data model (first pass)

Implement the **minimum** set of tables that unlock the most screens. Start normalized; add JSON columns **only** if the client accepts “flexible attributes” for low-priority fields to save time.

### 4.1 Core

- **`Farm`** (master)
  - `id`, `code` (unique, `FARM-00001`), `farmName`, `farmerName`, `farmCategory`, `country`, `region`, `city`, `latitude`, `longitude`, `elevationM`, `totalFarmSizeHa`, main/secondary crop fields, varieties, areas, annual outputs, harvest months, processing fields (main + secondary), quality scores, language, samples flag, farmer email/mobile, notes, `createdAt`, `updatedAt`.
- **`FarmRelationship`** (or columns on `Farm` if you want fewer joins)
  - `firstContactDate`, `lastVisitDate`, `visitCount`, `relationshipStatus`.

### 4.2 Transactions

- **`PurchaseOrder`**: header + link `farmId`; fields per spec (buyer, emails, dates, crop, qty, price/kg, computed total, logistics, etc.).
- **`PurchaseOrderAttachment`**: `kind` enum (`Invoice` | `Certificate` | `Contract` | `NoteFile`), file URL/key, metadata.
- **`Sample`**: buyer, farm, crop, `code` `SAMP-…`, dates, delivery address, notes attachments.
- **`Expense`**: `code` `EXP-…`, date, description, amount; optionally `farmId` or global org scope (clarify with client — **default:** link to farm if PO flow is farm-centric).

### 4.3 Rich content (Farmer Profile / Processing pages)

- **`FarmProfileContent`**: `farmId`, `section` (`Profile` | `Processing`), `bodyHtml` or markdown, `updatedAt`, `updatedById`.
- **`FarmProfileImage`**: `farmId`, `section`, `storageKey`, `sortOrder`, `caption`.

*(If time-critical: Day 1–2 can use a single `Json` field for “admin blocks”; refactor to relational images in week 2.)*

---

## 5. API surface (REST, parallel to existing style)

Prefix all routes with **`/global-vendors`** or **`/farms`** (pick one; stay consistent).

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/farms` | List/search farms (pagination, filters). |
| POST | `/farms` | Create (modal fields + server-side code gen). |
| GET/PATCH/DELETE | `/farms/:id` | CRUD. |
| GET | `/farms/map` | Lightweight list for map (id, code, name, lat, lng). |
| GET | `/farms/approved` | Approved list projection. |
| GET/PATCH | `/farms/:id/relationship` | Relationship & Trust fields. |
| GET/PATCH | `/farms/:id/profile-content` | Rich content. |
| POST | `/farms/:id/profile-images` | Upload image. |
| GET/POST | `/purchase-orders` | List + create. |
| POST | `/purchase-orders/:id/attachments` | Multipart upload by kind. |
| GET/POST | `/samples` | Samples. |
| GET/POST | `/expenses` | Expenses + aggregate total. |

**Scope middleware:** reuse `getAllowedSupplierIds` only if farms are tied to suppliers; otherwise **`requirePageAccess('GlobalSupplyFarmers')`** style checks per route.

---

## 6. Client routes and navigation

Suggested route map (under main `Layout`):

| Path | Page |
|------|------|
| `/global-vendors` | Landing: redirect to `/global-vendors/farmers` or a small dashboard stub (not the Commodity Dashboard). |
| `/global-vendors/farmers` | Farmer Information (master table + add modal). |
| `/global-vendors/map` | Farms map. |
| `/global-vendors/approved` | Approved Farmers List. |
| `/global-vendors/relationships` | Relationship & Trust. |
| `/global-vendors/farmers/:farmId/profile` | Farmer Profile. |
| `/global-vendors/farmers/:farmId/processing` | Processing & Quality. |
| `/global-vendors/purchase-orders` | Purchase Orders. |
| `/global-vendors/samples` | Samples. |
| `/global-vendors/expenses` | Expenses. |

**Layout.tsx:** Add a **Global Vendors** group in the sidebar (or a collapsible section) — only render items the user can access.

**Product Hub:** Change right panel target from placeholder to **`/global-vendors/farmers`** (or your chosen home).

---

## 7. RBAC and Admin matrix

1. Add **`PAGE_DEFINITIONS`** entries for each new `path` (server `server/src/lib/permissions.ts`).
2. Add matching keys to **`API_PAGE_ROLES`** in `rbac.ts` if APIs use `requirePageAccess`.
3. Add **`PATH_ROLES`** on client (`rolePageAccess.ts`) — default role sets per client policy (often **Admin + Buyer** for commodity buyers).
4. Run **seed / Admin UI** to toggle permissions for pilot roles.
5. Document default role mapping in this file’s appendix after client sign-off.

---

## 8. Four-day execution plan

> **Reality check:** The full specification is **larger than 4 days** for one developer at production quality. This plan front-loads **schema + Farmer master + map + one list**, then **PO / Samples / Expenses**, then **profiles + CMS**. If slip occurs, cut **F** (Processing page duplicate of **E**) or defer **rich media** to day 5.

### Day 1 — Foundation + Farmer master + Approved list

**Morning**

- [ ] Freeze field list for **`Farm`** (compare Word doc column-by-column).
- [ ] Prisma: `Farm` model + migration; unique `code` with server-side generator (`FARM-` + zero-padded sequence — same pattern as existing entities).
- [ ] `GET/POST /farms`, `GET/PATCH /farms/:id`.
- [ ] Seed 3–5 demo farms (optional).

**Afternoon**

- [ ] Client: folder `client/src/pages/globalVendors/` (or `gv/`).
- [ ] **Farmer Information** page: table + **Add Farmer** modal (start with required fields; rest can be “edit row” or full form Day 2).
- [ ] **Approved Farmers List** read-only table (reuse API with `select` projection or dedicated endpoint).
- [ ] Wire **Global Vendors** home redirect; update **Product Hub** right panel navigation target.

**EOD checkpoint:** Create/list/edit farmers; approved list visible; no map yet OK.

---

### Day 2 — Map + Relationship & Trust + RBAC wiring

**Morning**

- [ ] `GET /farms/map` + client **Farms map** (pins, tooltip Farm ID + name; handle missing lat/lng gracefully).
- [ ] Register all new paths in **permissions** (server + client); sidebar entries.
- [ ] Verify **Product hub → Global Vendors** and **Layout** guards for a Buyer test user.

**Afternoon**

- [ ] **Relationship & Trust**: extend `Farm` or `FarmRelationship` fields; table with inline edit or edit modal; persist counts/dates/status.
- [ ] Polish **Farmer Information** table columns to match spec (scrollable wide table; sticky header).

**EOD checkpoint:** Map live; relationship page updating DB; RBAC visible in Admin matrix.

---

### Day 3 — Purchase Orders + Samples + file attachments

**Morning**

- [ ] `PurchaseOrder` model + migration; PO line items if spec requires (**if spec is single-line PO, keep one row per PO first**).
- [ ] “New PO” vs “existing open PO” dropdown; generate `PO-` code.
- [ ] Attachments: reuse upload middleware; store metadata rows; download links in UI.

**Afternoon**

- [ ] **Samples**: `Sample` model, modal (Buyer, Farm ID, Crop), list table, `SAMP-` code.
- [ ] Notes file upload on Sample (same attachment helper).

**EOD checkpoint:** Create PO + upload files; create sample + optional file; list/filter basics.

---

### Day 4 — Expenses + Farmer Profile / Processing + CMS-lite + hardening

**Morning**

- [ ] **Expenses**: model, `EXP-` code, add form, table, **sum** header (client-side sum + server aggregate for verification).
- [ ] **Farmer Profile** page: farm selector + read-only sections from `Farm`; **Admin**-only editor for **rich text** (minimal: `<textarea>` + markdown preview **or** simple WYSIWYG if already in project).
- [ ] **Image upload** for profile: 1–N images, reorder (drag optional — stretch).

**Afternoon**

- [ ] **Processing & Quality** page: same shell as profile, different field subset + second “secondary” block when applicable.
- [ ] Cross-page QA: permissions, validation, empty states, mobile width for wide tables.
- [ ] Update **`GlobalVendorsHome`** redirect or remove; ensure no dead links from Product Hub.
- [ ] Short **internal test checklist** (see §10).

**EOD checkpoint:** Expenses + totals; profile + processing pages with CMS-lite; smoke test passes.

---

## 9. Testing checklist (minimum)

- [ ] User **without** GSV permission cannot see nav or hit API (403 / redirect).
- [ ] User **with** permission: full CRUD happy paths for Farm, PO, Sample, Expense.
- [ ] Map: farm with null coords **excluded** or shown in “fix coords” list — behavior documented.
- [ ] File uploads: size limit, type allowlist, virus scan policy (if any) documented.
- [ ] Concurrent code generation: no duplicate `FARM-` / `PO-` codes (DB unique constraint + retry on conflict).
- [ ] **Regression:** Sentinel Vendor Warranty routes unchanged; `pathRoles` merge still includes `/product-hub` and `/global-vendors`.

---

## 10. Risks and mitigations

| Risk | Mitigation |
|------|------------|
| Spec wider than timeline | Time-box **MVP fields**; track “phase 2 columns” in a spreadsheet. |
| Wide tables unusable on mobile | Horizontal scroll + **column chooser** later; Day 2 sticky header + `max-width` cards on small screens. |
| File storage differences envs | One abstraction `storeBuffer(key, buf)`; env-driven local vs S3. |
| Client changes copy/fields | Version the spec date in migration comments; avoid silent renames. |

---

## 11. Post–4-day backlog (when Commodity Dashboard returns)

- **Commodity Dashboard** metrics (inventory kg/$ , shipments, revenue, charts — per original §1).
- **Advanced CMS** (WYSIWYG, image gallery templates, versioning).
- **Reporting / exports** (CSV, PDF PO pack).
- **Notifications** (sample shipped, PO status change).

---

## 12. Appendix — Client deliverables checklist

Use this table to sign off with the stakeholder.

| Item | Done | Notes |
|------|------|-------|
| Commodity Dashboard excluded | ☐ | Separate phase |
| Farms map | ☐ | |
| Farmer Information | ☐ | |
| Approved Farmers List | ☐ | |
| Relationship & Trust | ☐ | |
| Farmer Profile + admin content | ☐ | |
| Processing & Quality + admin content | ☐ | |
| Purchase Orders + files | ☐ | |
| Samples + files | ☐ | |
| Expenses + total | ☐ | |
| RBAC + Admin permissions | ☐ | |
| Product Hub integration | ☐ | |

---

*Document version: 1.0 — aligned with Sentinel SSA-Platform repo layout and Global Supply requirements (28 Mar 2026), **excluding Commodity Dashboard**.*
