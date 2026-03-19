# Days 1–10 — Main workflow test guide

Use this after `npm run dev` (client) + API running with migrated DB and **seed** (`admin@sentinel.local` / `Admin123!`, test users **`Test123!`**).

---

## 1. Auth & roles (Days 1–4)

| # | Workflow | Steps | Expect |
|---|----------|-------|--------|
| 1.1 | Login | Log in as **Admin** | Dashboard or default path loads |
| 1.2 | Logout / session | Refresh page | Still authenticated |
| 1.3 | Supplier landing | **supplier@sentinel.local** | Redirect to **Supplier Profile**; menu: Profile, Records, Shipments only |
| 1.4 | Buyer menu | **buyer@sentinel.local** | No Admin, Documents, Internal Management |
| 1.5 | Auditor menu | **auditor@sentinel.local** | No Dashboard, Risk, Shipments (per matrix) |
| 1.6 | Deep link guard | Open a URL your role cannot access | Redirect to allowed default |

---

## 2. Suppliers & buyers (Days 5–9)

| # | Workflow | Steps | Expect |
|---|----------|-------|--------|
| 2.1 | Supplier list scope | **Buyer** → Supplier List | Only **assigned** suppliers (e.g. SUP-TEST01) |
| 2.2 | Supplier list scope | **Admin** → Supplier List | All suppliers |
| 2.3 | Commodity type | **Admin** → Supplier List → set commodity on a row | PATCH succeeds |
| 2.4 | Admin buyers/suppliers | **Admin** → tab **Buyers & suppliers** | Assign buyer ↔ supplier |

---

## 3. Quality objects (Days 6–8)

| # | Workflow | Steps | Expect |
|---|----------|-------|--------|
| 3.1 | Findings | Create/list findings; open **Findings Record** | Data loads; role-appropriate actions |
| 3.2 | CARs | **Corrective Actions** + **CAR Record** | Status rules per plan |
| 3.3 | Audits | **Audits** page | List, filters, links |
| 3.4 | Reference data | **Admin** → defect/disposition/commodity/audit types | CRUD where implemented |

---

## 4. Admin config (Day 9)

| # | Workflow | Steps | Expect |
|---|----------|-------|--------|
| 4.1 | Risk weights | **Admin** → Risk weights | Save loads back |
| 4.2 | Permissions | **Admin** → Permissions | Matrix matches app |
| 4.3 | Admin-only delete | Non-admin tries delete API | **403**; Admin **200**/**204** |

---

## 5. Supplier portal (Day 9.5)

| # | Workflow | Steps | Expect |
|---|----------|-------|--------|
| 5.1 | Portal | **Supplier** → **Supplier Profile** | Metrics + tables (audits, findings, CARs, risk, records, shipments) |
| 5.2 | Record upload | Submit record (+ optional file) | Row in **Records** (pending) |
| 5.3 | Shipment request | Submit inspection (PO, Part, Qty, date) | Row on **Shipments** (Waiting) |

---

## 6. Day 10 — Shipments end-to-end

| # | Workflow | Steps | Expect |
|---|----------|-------|--------|
| 6.1 | Schedule | **Admin** → **Shipments** → add **schedule** row (supplier, PO, Part #, **scheduled date**) | Row in schedule table |
| 6.2 | Request | **Supplier** (or Admin) creates **inspection request** with **same PO/Part** and inspection date | Row in requests table |
| 6.3 | Result | **Admin** or **QE** → **Pass** or **Fail** | Status updates; metrics (**FPY**, **OTD**) change when matches exist |
| 6.4 | Metrics | Change filter supplier | Metrics and tables scope correctly |
| 6.5 | Buyer | **Buyer** sees only assigned suppliers’ rows | No leakage |

---

## 7. Day 10 — Records end-to-end

| # | Workflow | Steps | Expect |
|---|----------|-------|--------|
| 7.1 | Upload | **Auditor** or **Buyer** (assigned) or **QE** uploads internal/supplier record | **PENDING** |
| 7.2 | Review | **Admin** or **QE** → **Approve** / **Reject** | Status updates |
| 7.3 | Download | Click **Download** on row with file | File saves |
| 7.4 | Buyer boundary | **Buyer** uploads for supplier **not** assigned | Blocked (**403**) |

---

## 8. Day 10 — Documents & internal

| # | Workflow | Steps | Expect |
|---|----------|-------|--------|
| 8.1 | Documents | **QE** creates document (+ optional file) | Appears in library |
| 8.2 | View | **Viewer** opens **Documents** | List + download; **no** create |
| 8.3 | Internal | **Admin** → **Internal Management** | Upload, list, download, delete |
| 8.4 | Internal guard | **QE** navigates to **/internal-management** | Redirect to default path |

---

## 9. Regression smoke (full stack)

| # | Check | |
|----|--------|---|
| 9.1 | `GET /health` | `{ "status": "ok" }` |
| 9.2 | Prisma migrate + seed | No errors |
| 9.3 | Client `npx tsc --noEmit` | Clean |
| 9.4 | Server `npx tsc --noEmit` | Clean |

---

**Tip:** Run **Day10-Acceptance-Test-Cases.md** for API-level checks; use this guide for end-user flows across **Days 1–10**.
