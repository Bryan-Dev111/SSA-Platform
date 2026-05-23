# 22 May 2026 — Client Feedback Completion Checklist

Source: `22MAY2026 Sentinel Feedback.docx`

| # | Requirement | Status | Implementation |
|---|-------------|--------|----------------|
| 1 | Delete Risk Intelligence page | **Done** | Removed Global Supply Risk Intelligence route, nav, permissions, and i18n keys |
| 2 | Supplier Profile: weekly quality score graph fills every week (carry-forward / flat line) | **Done** | `buildWeeklyRiskSeries()` in `client/src/pages/SupplierProfile.tsx` |
| 3 | CAR Record: title **Occurrence Root Cause**, remove placeholder text | **Done** | `client/src/pages/CARRecord.tsx` — label only, no placeholder |
| 4 | Admin → Employees: **Notes** + **Commodity** (dropdown) columns | **Done** | `AdminDay9Panels.tsx` (`usersOnlyEmployees`); `User.commodityTypeId` migration; `PATCH /users/:id` |
| 5 | CAR Record: **Closing Comments** (not Disposition Comments) | **Done** | `CARRecord.tsx` closing comments field |
| 6 | Finding Record: **Disposition Comments** (swap from Closing Comments) | **Done** | `FindingsRecord.tsx` — disposition comments label on closing field |
| 7 | Findings: remove Top Defect Codes hint text | **Done** | Hint removed from `Findings.tsx` UI |
| 8 | Records: remove approval % subtext from KPI widgets | **Done** | `Records.tsx` widgets show counts only |
| 9 | Supplier Profile: dates **MMM DD, YYYY** | **Done** | `formatProfileTableDate()` in `client/src/utils/formatDisplayDates.ts` |
| 10 | Supplier Profile: Audits **Type** shows name (not code number) | **Done** | `auditType?.name \|\| auditType?.code` |
| 11 | Supplier Profile: Passed = green, Failed = red | **Done** | `auditResultColor()` in `SupplierProfile.tsx` |
| 12 | Supplier Profile: sortable table headers | **Done** | `SortableTh` on all profile tables |
| 13 | Supplier Profile: **Corrective Actions** (no “(CARS)”) | **Done** | Uses `t('nav.correctiveActions')` |
| 14 | Supplier Profile: closed CAR rows greyed out | **Done** | `isCarClosed()` row styling |
| 15 | Supplier Profile + Dashboard: i18n (EN / ES / FR) | **Done** | `supplierProfile.*`, `dashboard.trend.*` keys; chart legend via `MonthlyTrendsLineChart` |
| 16 | Global Supply Admin: users list loads | **Done** | Fixed Prisma query (`select` + nested `select`, not `include`) in `server/src/routes/users.ts` |

## Additional platform work (same delivery window)

| Item | Status | Notes |
|------|--------|-------|
| Super user + database connect/disconnect | **Done** | Static Super account; `/global-vendors/database` |
| Super password change API | **Done** | `POST /api/super/database/change-password` |
| Part number dropdown UX (Supplier Profile) | **Done** | Hint below field; only disabled while loading |

## Deploy / verify

1. **Server:** restart API after pull (`npm run dev` in `server/`).
2. **Migrations:** `npx prisma migrate deploy` in `server/` (includes `User.commodityTypeId`).
3. **Client:** hard refresh browser (`Ctrl+Shift+R`).
4. **Smoke test:**
   - Global Supply → Admin → Users (table loads, no Prisma error toast).
   - Supplier Profile → French/Spanish flags (metrics + forms translate).
   - Admin → Employees → Notes + Commodity columns editable.
   - CAR Record / Finding Record → correct comment field labels.

## Type-check

Run before release:

```powershell
cd c:\Sentinel\SSA-Platform\client
npx tsc --noEmit

cd c:\Sentinel\SSA-Platform\server
npx tsc -p tsconfig.json --noEmit
```
