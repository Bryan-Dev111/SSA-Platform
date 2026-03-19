# Day 8 — Acceptance test cases (full checklist)

**Purpose:** Manually verify every Day 8 requirement: CAR workflow/record (8.1–8.2), Commodity Types (8.3), Defect Codes (8.4), Disposition Codes (8.5), supplier classification, APIs, RBAC, and edge cases.

**References:** `Sentinel-Implementation-Plan.md` (Day 8), `docs/Requirement-Alignment-Checklist.md`, `docs/Day8-Step-by-Step-Testing-Guide.md`.

---

## How to use

1. Apply migration `20260325000000_day8_defect_disposition_codes` and run `npx prisma generate`.
2. (Recommended) Run `npx prisma db seed` for sample codes and commodity types.
3. Use tokens from **Admin**, **QualityEngineer**, **Buyer**, **Viewer**, **Auditor**, **Supplier** as noted per case.
4. Mark **Pass** only when behavior matches **Expected**.
5. Optional: duplicate API cases with **curl** or **REST Client** using `Authorization: Bearer <token>`.

**Suggested test users (from seed):**

| Role | Email (example) |
|------|------------------|
| Admin | admin@sentinel.local |
| QE | qe@sentinel.local |
| Buyer | buyer@sentinel.local |
| Viewer | viewer@sentinel.local |
| Auditor | auditor@sentinel.local |
| Supplier | supplier@sentinel.local |

---

## Section A — Database & migration (Day 8 schema)

| ID | Step | Expected | Pass? |
|----|------|----------|:-----:|
| A.1 | `npx prisma migrate status` (from `server/`) shows database up to date; Day 8 migration applied. | No pending migrations. | ☐ |
| A.2 | DB contains tables **`DefectCode`** and **`DispositionCode`**. | Tables exist. | ☐ |
| A.3 | DB table **`Finding`** has column **`dispositionCode`** (nullable text). | Column exists. | ☐ |
| A.4 | After seed, query or UI shows at least one **CommodityType**, **DefectCode**, **DispositionCode** (if you ran seed). | Seed data present when seed used. | ☐ |

---

## Section B — API: Commodity types (`/commodity-types`)

| ID | Role | Action | Expected | Pass? |
|----|------|--------|----------|:-----:|
| B.1 | None | `GET /commodity-types` without `Authorization`. | **401** Unauthorized. | ☐ |
| B.2 | Admin | `GET /commodity-types` with Bearer token. | **200**; JSON includes `list` array; each item has `id`, `name`. | ☐ |
| B.3 | Viewer (or QE / Buyer / Auditor) | `GET /commodity-types` with Bearer token. | **200**; `list` returned (same shape). | ☐ |
| B.4 | Supplier | `GET /commodity-types` with Supplier token. | **403** (not in allowed roles for this route). | ☐ |
| B.5 | Admin | `POST /commodity-types` body `{ "name": "TC-Commodity-A" }`. | **201**; returns created object with `id` and `name`. | ☐ |
| B.6 | Admin | `POST /commodity-types` body `{ "name": "" }` or missing `name`. | **400** validation error. | ☐ |
| B.7 | QE (or Buyer / Viewer) | `POST /commodity-types` with valid body. | **403** Insufficient permissions. | ☐ |
| B.8 | Admin | `PATCH /commodity-types/:id` with `{ "name": "TC-Commodity-A-Renamed" }` for valid `id`. | **200**; `name` updated. | ☐ |
| B.9 | Admin | `PATCH /commodity-types/:invalidId` with valid `name`. | **404** Commodity type not found. | ☐ |
| B.10 | Admin | `DELETE /commodity-types/:id` where **no** supplier has `commodityTypeId = :id`. | **204** No content. | ☐ |
| B.11 | Admin | `DELETE /commodity-types/:id` while **at least one** supplier still references that type. | **400**; message indicates suppliers still use it. | ☐ |
| B.12 | QE | `DELETE /commodity-types/:id` (valid unused id). | **403**. | ☐ |

---

## Section C — API: Defect codes (`/defect-codes`)

| ID | Role | Action | Expected | Pass? |
|----|------|--------|----------|:-----:|
| C.1 | None | `GET /defect-codes` without token. | **401**. | ☐ |
| C.2 | Admin | `GET /defect-codes` (no query). | **200**; `list` contains only rows with **`active: true`**. | ☐ |
| C.3 | Buyer | `GET /defect-codes` (no query). | **200**; only **active** codes in `list`. | ☐ |
| C.4 | Admin | `GET /defect-codes?all=1`. | **200**; `list` includes **inactive** codes (if any exist). | ☐ |
| C.5 | Buyer | `GET /defect-codes?all=1`. | **200**; `list` is still **active-only** (only Admin may expand with `?all=1`). | ☐ |
| C.6 | Admin | `POST /defect-codes` `{ "code": "TC-DC-01", "name": "Test defect", "active": true }`. | **201**; unique `code`. | ☐ |
| C.7 | Admin | `POST /defect-codes` with **duplicate** `code` as existing row. | **400** duplicate / invalid data. | ☐ |
| C.8 | Admin | `POST /defect-codes` missing `code`. | **400**. | ☐ |
| C.9 | QE | `POST /defect-codes` valid body. | **403**. | ☐ |
| C.10 | Admin | `PATCH /defect-codes/:id` `{ "name": "Updated desc", "active": false }`. | **200**; fields updated. | ☐ |
| C.11 | Admin | `PATCH /defect-codes/:id` with empty `code` string. | **400** code cannot be empty. | ☐ |
| C.12 | Admin | `DELETE /defect-codes/:id` for existing id. | **204**. | ☐ |
| C.13 | Admin | `DELETE /defect-codes/:nonexistent`. | **404**. | ☐ |
| C.14 | Buyer | `DELETE /defect-codes/:id`. | **403**. | ☐ |

---

## Section D — API: Disposition codes (`/disposition-codes`)

| ID | Role | Action | Expected | Pass? |
|----|------|--------|----------|:-----:|
| D.1 | None | `GET /disposition-codes` without token. | **401**. | ☐ |
| D.2 | QE | `GET /disposition-codes` (no query). | **200**; **active** codes only in `list`. | ☐ |
| D.3 | Admin | `GET /disposition-codes?all=1`. | **200**; includes inactive if present. | ☐ |
| D.4 | Admin | `POST /disposition-codes` `{ "code": "TC-DSP-01", "name": "Test disp" }`. | **201**. | ☐ |
| D.5 | Admin | `POST` duplicate `code`. | **400**. | ☐ |
| D.6 | Admin | `PATCH /disposition-codes/:id` toggle `active`. | **200**. | ☐ |
| D.7 | Admin | `DELETE /disposition-codes/:id`. | **204** or **404** for bad id. | ☐ |
| D.8 | Viewer | `POST /disposition-codes` | **403**. | ☐ |

---

## Section E — API: Supplier commodity (`PATCH /suppliers/:id`)

| ID | Role | Action | Expected | Pass? |
|----|------|--------|----------|:-----:|
| E.1 | None | `PATCH /suppliers/:id` without token. | **401**. | ☐ |
| E.2 | Admin | `PATCH /suppliers/:validSupplierId` body `{ "commodityTypeId": "<validCommodityTypeId>" }`. | **200**; response includes `commodityTypeId` and nested `commodityType` with `name`. | ☐ |
| E.3 | Admin | `PATCH /suppliers/:validSupplierId` body `{ "commodityTypeId": null }`. | **200**; classification cleared. | ☐ |
| E.4 | Admin | `PATCH /suppliers/:validSupplierId` body `{ "commodityTypeId": "fake-id-123" }`. | **400** invalid commodity type. | ☐ |
| E.5 | Admin | `PATCH /suppliers/:validSupplierId` body `{}` (missing `commodityTypeId`). | **400** commodityTypeId required. | ☐ |
| E.6 | Buyer | `PATCH /suppliers/:id` with valid body. | **403**. | ☐ |
| E.7 | Admin | `GET /suppliers` after patch. | Supplier row includes `commodityTypeId` and `commodityType { id, name }` when set. | ☐ |

---

## Section F — UI: Admin page (three tabs)

| ID | Step | Expected | Pass? |
|----|------|----------|:-----:|
| F.1 | Login as **Admin** → open **Admin** from sidebar. | Page loads (not placeholder); tabs visible. | ☐ |
| F.2 | **Commodity types** tab: enter new name → **Add**. | Row appears in table. | ☐ |
| F.3 | **Commodity types**: **Edit** → change name → **Save**. | Table shows new name. | ☐ |
| F.4 | **Commodity types**: **Delete** on type **not** used by any supplier → confirm. | Row removed; toast success. | ☐ |
| F.5 | **Commodity types**: **Delete** on type **in use** by a supplier. | Error toast / message; row remains. | ☐ |
| F.6 | **Defect codes** tab: add **Code** + optional description → **Add**. | New row; **Active** shows Yes. | ☐ |
| F.7 | **Defect codes**: **Edit** code/description/active → **Save**. | Row updates. | ☐ |
| F.8 | **Defect codes**: **Deactivate** then **Activate**. | **Active** column toggles; GET without `all=1` reflects active-only on forms. | ☐ |
| F.9 | **Defect codes**: **Delete** → confirm. | Row removed. | ☐ |
| F.10 | **Disposition codes** tab: repeat add / edit / deactivate / activate / delete. | Same behaviors as defect tab. | ☐ |
| F.11 | Non-Admin user navigates to `/admin` (if URL forced). | Blocked by app RBAC / redirect / no access (per `rolePageAccess`). | ☐ |

---

## Section G — UI: Supplier List (commodity classification)

| ID | Role | Step | Expected | Pass? |
|----|------|------|----------|:-----:|
| G.1 | Admin | Open **Supplier List**. | **Commodity type** column visible with dropdown per row. | ☐ |
| G.2 | Admin | Select a commodity for a supplier → blur/change fires save. | Toast success; refresh page; value persists. | ☐ |
| G.3 | Admin | Set commodity to **— None —**. | `commodityTypeId` cleared; persists after refresh. | ☐ |
| G.4 | Buyer | Open **Supplier List**. | **No** commodity column (or no edit control); only list in scope. | ☐ |
| G.5 | Viewer | Open **Supplier List**. | Same as Buyer — no Admin commodity editor. | ☐ |

---

## Section H — UI: Findings Record (defect + disposition + API alignment)

| ID | Step | Expected | Pass? |
|----|------|----------|:-----:|
| H.1 | Admin/QE/Auditor: **New Finding** draft. | **Defect Code** and **Disposition Code** are **dropdowns** (not plain text fields). | ☐ |
| H.2 | Select active defect + disposition from lists → **Save** (create draft via form submit). | Finding created; navigate to record with id. | ☐ |
| H.3 | **Update draft** (PATCH) after changing defect/disposition. | Values saved; toast/info. | ☐ |
| H.4 | **Save (DRAFT → Waiting Disposition)**. | Status advances; finding code finalized (FIN-…). | ☐ |
| H.5 | Reload finding after save. | **Disposition** and **defect** values still shown (including dropdown selection). | ☐ |
| H.6 | In Admin, **deactivate** a defect code that is **not** selected on this finding; open draft. | Deactivated code **hidden** from dropdown; other options visible. | ☐ |
| H.7 | Finding has defect/disposition string **not** in current active list (legacy). | Dropdown shows extra option **“(not in list)”** for current value. | ☐ |
| H.8 | Viewer opens existing finding (read-only). | Can view; **cannot** edit draft fields (per existing rules). | ☐ |
| H.9 | Buyer on **New Finding** URL. | Redirect to Findings list (cannot create). | ☐ |

---

## Section I — UI: CAR Record (defect codes) + links

| ID | Step | Expected | Pass? |
|----|------|----------|:-----:|
| I.1 | Admin/QE/Buyer: **New CAR** draft form. | **Defect Code** is **dropdown** from active defect codes. | ☐ |
| I.2 | Create CAR with defect selected → open same CAR. | Defect value matches; dropdown shows selection. | ☐ |
| I.3 | **Finding #** link on CAR record. | Navigates to **Findings Record** for linked finding. | ☐ |
| I.4 | CAR has legacy defect string not in list. | **(not in list)** option behavior same as Findings. | ☐ |
| I.5 | **Viewer** or **Auditor** opens `/car-record` without `id`/`carId`. | Redirect to **Corrective Actions** (cannot create CAR). | ☐ |
| I.6 | **Back to Corrective Actions** link on CAR record. | Always visible; navigates correctly. | ☐ |

---

## Section J — CAR workflow (8.1) — full status path

**Precondition:** User can create/edit CAR (Admin, QE, or Buyer). Use one CAR through the flow.

| ID | Step | Expected | Pass? |
|----|------|----------|:-----:|
| J.1 | Create **DRAFT** CAR with all **required** fields; click **Save (DRAFT → RCCA)**. | Status **RCCA**; no 400 for validation. | ☐ |
| J.2 | Try **Save (DRAFT → RCCA)** with missing required fields (e.g. empty summary on new draft). | **400** or UI validation; remains **DRAFT**. | ☐ |
| J.3 | From **RCCA**, observe **Reverse** button. | **Reverse** disabled (cannot go back to **DRAFT**). | ☐ |
| J.4 | From **RCCA**, **Process** until **Waiting Approval** (via **Follow-Up** if applicable per your flow). | Status advances per order: DRAFT → RCCA → WaitingApproval → FollowUp → Closed. | ☐ |
| J.5 | From **Waiting Approval**, **Approve**. | Status **Closed** (per implementation). | ☐ |
| J.6 | New CAR in **Waiting Approval**, **Reject**. | Status returns to **RCCA** (per implementation). | ☐ |
| J.7 | From a status where **Reverse** is allowed (e.g. **Follow-Up**), click **Reverse**. | Moves to **previous** status in chain, **never** to **DRAFT**. | ☐ |
| J.8 | API: `POST /cars/:id/reverse` when current status is **RCCA** (if server would compute prev = DRAFT). | **400** “Cannot reverse to DRAFT”. | ☐ |
| J.9 | **Viewer** on Corrective Actions: status dropdown / process actions. | Cannot change status beyond allowed (per role). | ☐ |
| J.10 | **Admin** **Delete** CAR from list. | CAR removed; non-Admin has no Delete column. | ☐ |

---

## Section K — Findings workflow touch (disposition context)

| ID | Step | Expected | Pass? |
|----|------|----------|:-----:|
| K.1 | Finding in **Waiting Disposition**: disposition chosen in draft is **visible** (read-only or as stored). | Field visible consistent with status. | ☐ |
| K.2 | **Process** / **Reverse** / **Approve** / **Reject** still behave per Day 6/7 rules. | No regression. | ☐ |

---

## Section L — Corrective Actions list & charts (Day 7 + Day 8 data)

| ID | Step | Expected | Pass? |
|----|------|----------|:-----:|
| L.1 | CARs use defect codes from dropdowns; open **Corrective Actions**. | **Top defect codes** chart counts reflect stored `defectCode` strings. | ☐ |
| L.2 | Pagination / filters still work. | No regression. | ☐ |

---

## Section M — Negative & security (quick sweep)

| ID | Step | Expected | Pass? |
|----|------|----------|:-----:|
| M.1 | Tamper: call `POST /commodity-types` as Buyer with stolen-looking token (use real Buyer JWT). | **403**. | ☐ |
| M.2 | Expired or invalid JWT on `GET /defect-codes`. | **401**. | ☐ |
| M.3 | XSS sanity: commodity name with `<script>` in Admin form. | Stored escaped or plain text in UI (no script execution). | ☐ |

---

## Section N — Regression: navigation & RBAC pages

| ID | Step | Expected | Pass? |
|----|------|----------|:-----:|
| N.1 | **CAR Record** / **Findings Record** not in main sidebar; reachable from lists/links. | Matches requirement. | ☐ |
| N.2 | **Supplier** role: cannot access **Admin** page. | Blocked. | ☐ |
| N.3 | **Auditor** default landing / corrective-actions access. | Per `rolePageAccess` (no broken routes for new APIs on pages Auditor uses). | ☐ |

---

## Sign-off

| Area | Test sections | All pass? |
|------|----------------|:---------:|
| DB / migration | A | ☐ |
| Commodity API + UI + supplier | B, E, F (partial), G | ☐ |
| Defect codes API + UI + CAR/Findings | C, F (partial), H, I, L | ☐ |
| Disposition API + UI + Findings | D, F (partial), H, K | ☐ |
| CAR workflow & security | J, M, N | ☐ |

**Tester:** _______________ **Date:** _______________ **Build / commit:** _______________

---

## Notes

- **C.5:** Server should ignore `?all=1` for non-Admins; Buyer must still receive active-only codes.
- **J.4 / J.5 / J.6:** Exact intermediate statuses depend on how many **Process** clicks are needed; adjust steps to match your UI labels.
- Total **checklist items:** count IDs A.1–N.3 (use Pass? column for coverage reporting).
