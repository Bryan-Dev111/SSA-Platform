# Day 8 — Step-by-step testing guide

**Theme:** CAR workflow (verify), Admin reference data (commodity, defect, disposition), Findings/CAR dropdowns, supplier commodity assignment.

**Full checklist:** For exhaustive pass/fail cases (API + UI + RBAC + edge cases), use **[Day8-Acceptance-Test-Cases.md](./Day8-Acceptance-Test-Cases.md)**.

## Prerequisites

- `npx prisma migrate deploy` (from `server/`) applies migration `20260325000000_day8_defect_disposition_codes`.
- `npx prisma generate` (if the client was out of date).
- `npx prisma db seed` (optional): seeds commodity types, defect codes, disposition codes, assigns SUP-TEST01 → Electronics.

---

## 8.1–8.2 CAR workflow & record (regression)

1. Log in as Admin, QE, or Buyer.
2. **Corrective Actions:** open a CAR or create New CAR; complete required fields; **Save (DRAFT → RCCA)**.
3. **Process / Reverse:** Reverse must **not** move status to DRAFT (from RCCA, Reverse is disabled in UI; API returns error if prev would be DRAFT).
4. Advance to **Waiting Approval**; **Approve** (→ Closed) or **Reject** (→ RCCA).
5. **CAR Record:** Finding # links to Findings Record; **Defect Code** is a dropdown from Admin-managed codes (legacy values show as “not in list”).
6. **Viewer / Auditor:** cannot create a new CAR (redirect from empty `/car-record`).

---

## 8.3 Commodity types (Admin)

1. Log in as **Admin** → **Admin** page → **Commodity types**.
2. Add a type (e.g. “Test Commodity”); confirm it appears in the table.
3. **Edit** name → **Save**.
4. **Supplier List:** as Admin, open **Commodity type** column; assign a supplier to the new type (PATCH `/suppliers/:id`).
5. **Delete** a commodity type that has **no** suppliers; confirm success.
6. Try **Delete** on a type still in use → expect error message (suppliers must be reassigned first).

---

## 8.4 Defect codes (Admin + UI)

1. **Admin** → **Defect codes** → Add `code` + optional description.
2. **Edit** / **Deactivate** / **Activate** / **Delete** (delete removes row; existing Finding/CAR strings may still show as legacy in dropdowns).
3. **Findings Record** (draft): **Defect Code** dropdown lists **active** codes only.
4. **CAR Record** (draft): same for defect codes.

---

## 8.5 Disposition codes (Admin + Findings)

1. **Admin** → **Disposition codes** → Add / edit / activate / deactivate / delete (same patterns as defect codes).
2. **Findings Record** (draft): **Disposition Code** dropdown uses active disposition codes.
3. Save finding; reload record → disposition value persists (`Finding.dispositionCode`).

---

## API quick checks (optional)

| Method | Path | Notes |
|--------|------|--------|
| GET | `/commodity-types` | Auth: app roles (not Supplier) |
| POST/PATCH/DELETE | `/commodity-types`… | Admin only |
| GET | `/defect-codes` | Active only; `?all=1` + Admin = include inactive |
| GET | `/disposition-codes` | Same as defect |
| PATCH | `/suppliers/:id` | Admin only; body `{ "commodityTypeId": "<id>" \| null }` |

---

## Done when

- Migration applied; seed (if used) runs without error.
- Admin CRUD works for all three tabs; supplier commodity assignment works for Admin.
- Findings and CAR forms use defect/disposition dropdowns; no TypeScript errors (`npx tsc --noEmit` in `client/` and `server/`).
