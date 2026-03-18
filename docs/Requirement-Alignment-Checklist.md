# Requirement alignment checklist

Quick verification that the current codebase matches the stated requirements (Sentinel Implementation Plan and role matrix).

---

## Delete permissions (Admin only)

| Entity   | Server enforcement | Client (UI) |
|----------|--------------------|------------|
| Finding  | `audits.ts`: 403 if not Admin | Findings table: Delete column only when `isAdmin` |
| Audit    | `audits.ts`: 403 if not Admin | Audits table: Delete column only when `isAdmin` |
| CAR      | `cars.ts`: 403 if not Admin   | Corrective Actions table: Delete column only when `isAdmin` |

All three: only Admin can delete; server rejects non-Admin; UI shows Delete only for Admin.

---

## Corrective Actions (CAR)

- Pagination: page size (5/10/20/50), Previous/Next, “X–Y of total”.
- Status dropdown: Process / Reverse / Approve / Reject by status; only Admin, QE, Buyer (`canChangeCarStatus`).
- Delete: Admin only; ConfirmDialog; calls `DELETE /cars/:id`.
- Row color by status: `car-row--draft`, `waiting-disposition`, `waiting-approval`, `closed`, `follow-up`, `unknown`.
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

## Database

- App and Prisma use `DATABASE_URL` from `server/.env` (and root `.env` when loaded). Configured to client’s Supabase when provided.
- Migrations: `npx prisma migrate deploy` applies schema to the database pointed to by `DATABASE_URL`. Run once on client’s project if it is new/empty.

---

**Summary:** Delete (Audit, CAR, Finding) is Admin-only on server and UI; pagination, status colors, and status dropdowns are in place for CAR, Findings, and Audits; sidebar and back links match requirements; DB URL is set for client’s Supabase.
