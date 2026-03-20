# Feedback Implementation Log

## 2026-03-19 - Risk Page lifecycle + quantified workflow

### Requirement summary
- Risk must be a managed entity with lifecycle: `Open -> Mitigated -> Closed`.
- Risk must be quantified with `Likelihood` and `Severity`.
- `Risk Level` must be derived automatically (not manually selected).
- One unified table for both `Risk` and `Opportunity`.
- Add form should feed the same table and refresh immediately after submit.
- Remove legacy `mitigated` as a `type` value.

### Implemented changes

#### 1) Data model
- Updated `server/prisma/schema.prisma`:
  - `Opportunity.type` from free text -> enum `RiskItemType` (`risk`, `opportunity`)
  - Added `status` enum field `RiskStatus` (`Open`, `Mitigated`, `Closed`)
  - Added `likelihood` enum field `RiskLikelihood` (`VeryUnlikely`, `Unlikely`, `Possible`, `Likely`, `VeryLikely`)
  - Added `severity` enum field `RiskSeverity` (`Negligible`, `Minor`, `Moderate`, `Significant`, `Severe`)
  - Added `riskLevel` (`Low`, `Medium`, `High`) derived field for risk rows
  - `description` is now required
- Added migration:
  - `server/prisma/migrations/20260330000000_day11_risk_workflow_model/migration.sql`
  - Handles old data conversion, including mapping legacy `type='mitigated'` into `status='Mitigated'`.

#### 2) Backend logic
- Reworked `server/src/routes/opportunities.ts`:
  - Added derived risk-level function using likelihood x severity matrix logic.
  - `POST /opportunities`:
    - supports only `risk|opportunity` types
    - sets `status='Open'` on create
    - requires likelihood+severity for `risk`
    - computes `riskLevel` for `risk`
  - `PATCH /opportunities/:id`:
    - supports status updates (`Open|Mitigated|Closed`)
    - supports editing description/type/likelihood/severity
    - recomputes `riskLevel` for risk rows
    - clears risk-only fields for opportunities
  - `GET /opportunities`:
    - unified list with optional filters: `supplierId`, `type`, `status`, `riskLevel`
  - Kept scope + RBAC enforcement aligned with platform rules.

#### 3) Risk page UI
- Reworked `client/src/pages/Risk.tsx`:
  - Single unified table for Risks + Opportunities
  - Columns now include:
    - Supplier, Type, Description, Likelihood, Severity, Risk Level, Status, Created Date, Actions
  - Add form is placed directly above the table and feeds it.
  - Add form behavior:
    - If `Type=Risk`: shows Likelihood + Severity
    - If `Type=Opportunity`: hides Likelihood + Severity
    - On submit: creates row, status open, refreshes table, resets form fields
  - Edit flow supports:
    - Description edits
    - Type changes
    - Status updates (`Open/Mitigated/Closed`)
    - Likelihood/Severity changes for risks
  - Added optional list filters for `Status` and `Risk Level`.
  - Removed UI references to legacy `mitigated` type.

### Verification
- Server type-check: `npx tsc --noEmit` -> PASS
- Client type-check: `npx tsc --noEmit` -> PASS
- Lint diagnostics on changed files -> PASS

### Notes
- `npx prisma generate` reported Windows file lock error:
  - `EPERM ... query_engine-windows.dll.node`
  - This is environment/file-lock related, not schema logic failure.
  - If needed, stop running Node processes and rerun `npx prisma generate`.

## 2026-03-19 - Risk page layout adjustment (form directly above table)

### Requirement summary
- Update Risk page UI to follow this order:
  1) Risks and Opportunities header
  2) Add Risk/Opportunity form
  3) Main unified table
- Keep behavior aligned with Day 11 lifecycle + quantified risk requirements.

### Implemented changes
- Updated `client/src/pages/Risk.tsx`:
  - Moved **Add risk/opportunity form** to appear before list/table content.
  - Moved unified list to primary section with title **All risks and opportunities**.
  - Kept analytics blocks (stats, supplier risk score table, distribution, top suppliers) below the main list to avoid breaking Day 11 functionality.

### Verification
- Client type-check: `npx tsc --noEmit` -> PASS
- Lint diagnostics on changed file -> PASS

## 2026-03-19 - Cancellation applied (layout adjustment reverted)

### Requirement update
- User requested to cancel the previous "form directly above table" layout change.

### Implemented action
- Reverted Risk page section order in `client/src/pages/Risk.tsx` back to prior arrangement:
  - Filters -> metrics/distribution -> add form -> main table.
- Restored table section title text to `Risks and opportunities`.

### Verification
- Client type-check: `npx tsc --noEmit` -> PASS
- Lint diagnostics on changed file -> PASS

## 2026-03-19 - Risk analytics order adjustment

### Requirement summary
- In Risk page, `Risk distribution` and `Top risk suppliers` should be directly under:
  - Risk score
  - Open risks
  - Mitigated risks
  - Open opportunities

### Implemented changes
- Updated `client/src/pages/Risk.tsx` section order:
  - Metrics cards
  - Risk distribution + Top risk suppliers
  - (then rest of Risk page sections)

### Verification
- Client type-check: `npx tsc --noEmit` -> PASS
- Lint diagnostics on changed file -> PASS

## 2026-03-19 - Swapped section locations on Risk page

### Requirement summary
- Switch location/order of `Risk scores by supplier` and `Risks and opportunities`.

### Implemented changes
- Updated `client/src/pages/Risk.tsx`:
  - `Risks and opportunities` now appears before `Risk scores by supplier`.
  - `Risk scores by supplier` moved below it.

### Verification
- Client type-check: `npx tsc --noEmit` -> PASS
- Lint diagnostics on changed file -> PASS

## 2026-03-19 - Smooth Risk CRUD UX (no disruptive page refresh)

### Requirement summary
- Risk page CRUD operations should not feel like a full page refresh while editing/viewing.

### Implemented changes
- Updated `client/src/pages/Risk.tsx`:
  - `load()` now supports non-blocking refresh mode (`showLoader=false`).
  - Create flow now updates table state directly from POST response.
  - Edit flow now updates the edited row in local state (or removes it if it no longer matches active filters).
  - Recalculate keeps a background refresh (`load(false)`) to avoid disruptive loading flicker.
  - Added active-filter matcher to keep table behavior correct with supplier/status/risk-level filters.

### Verification
- Client type-check: `npx tsc --noEmit` -> PASS
- Lint diagnostics on changed file -> PASS

## 2026-03-19 - Risk edit modal UX update

### Requirement summary
- In Risk and Opportunities table, clicking **Edit** should open an edit modal.
- Remove the old bottom-page inline edit form behavior.

### Implemented changes
- Updated `client/src/pages/Risk.tsx`:
  - Replaced inline bottom edit block with modal overlay dialog.
  - Modal includes all editable fields (type, description, risk inputs, status).
  - Save/Cancel actions remain intact.
  - Click-outside closes modal (except while saving).

### Verification
- Client type-check: `npx tsc --noEmit` -> PASS
- Lint diagnostics on changed file -> PASS

## 2026-03-20 - CAR Audit/Finding column deep links

### Requirement summary
- On the CAR table:
  - `Audit` value must be clickable and open the Audit detail page.
  - `Finding` value must be clickable and open the Finding detail page.

### Implemented changes
- Added `client/src/pages/AuditRecord.tsx` (read-only Audit detail view).
- Added route `/audit-record` in `client/src/App.tsx` (guarded with the same access as `/audits`).
- Updated `client/src/pages/CorrectiveActions.tsx`:
  - Made the **Audit** column clickable:
    - Links to `/audit-record?id=<auditId>`
  - Kept the **Finding** column clickable:
    - Links to `/findings-record?findingId=<findingCode>`

### Verification
- Client type-check: `npx tsc -p tsconfig.json --noEmit` -> PASS

## 2026-03-20 - Fix `/audit-record` route RBAC redirect

### Root cause
- `Layout` blocks access to any path not present in `PATH_ROLES`.
- `/audit-record` was missing, causing redirect (often to `/dashboard`).

### Implemented changes
- Updated `client/src/config/rolePageAccess.ts` to add:
  - `/audit-record` with the same roles as `/audits`.

### Verification
- Client type-check: `npx tsc -p tsconfig.json --noEmit` -> PASS

## 2026-03-20 - Remove "Change status" column from CAR list

### Requirement summary
- Remove the **Change Status** column from the Corrective Actions (CAR) table.

### Implemented changes
- Updated `client/src/pages/CorrectiveActions.tsx`:
  - Removed the `Change status` header.
  - Removed the per-row status-change `<select>` cell.
  - Adjusted the empty-state `colSpan` to match the new column count.
  - Removed now-unused status-action handler code to keep TypeScript strict mode clean.

### Verification
- Client type-check: `npx tsc -p tsconfig.json --noEmit` -> PASS

## 2026-03-20 - Add "Creation Date" column to CAR table

### Requirement summary
- Add one new column in CAR table: **Creation Date**.
- Place it immediately before **Updated**.

### Implemented changes
- Updated `client/src/pages/CorrectiveActions.tsx`:
  - Added `createdAt` to the `CAR` interface.
  - Added table header `Creation Date` before `Updated`.
  - Rendered each row's creation date using `new Date(c.createdAt).toLocaleDateString()`.

### Verification
- Client type-check: `npx tsc -p tsconfig.json --noEmit` -> PASS

## 2026-03-20 - CAR analytics: status pie + age distribution

### Requirement summary
- Add a **pie chart** for CAR status distribution using statuses:
  - `RCCA`, `WaitingApproval`, `FollowUp`, `Closed`
- Add a **bar chart** for CAR age distribution with buckets:
  - `0-30 days`, `31-60 days`, `61-90 days`, `90+ days`
- Place both charts in the top analytics section.
- Do not change table/workflow logic.

### Implemented changes
- Updated `client/src/pages/CorrectiveActions.tsx`:
  - Added status counts from existing CAR list and rendered a pie chart using `conic-gradient`.
  - Added age calculation (`today - createdAt`) and bucketed counts for the four required age ranges.
  - Rendered age distribution as horizontal bars in a new analytics card.
  - Added both new cards alongside the existing top analytics cards/charts section.

### Verification
- Client type-check: `npx tsc -p tsconfig.json --noEmit` -> PASS
- Lint diagnostics on changed file -> PASS

## 2026-03-20 - Match CAR age chart visual style

### Requirement summary
- Update the current CAR age bar chart to match the provided visual style attachment.

### Implemented changes
- Updated `client/src/pages/CorrectiveActions.tsx` (age chart presentation only):
  - Switched age chart from horizontal bars to vertical bars.
  - Added left-side axis label (`Number of CARs`).
  - Kept X-axis bucket labels as:
    - `0-30 days`, `31-60 days`, `61-90 days`, `90+ days`
  - Applied purple bar styling and chart grid background for closer visual match.
- Kept all age calculation and bucket logic unchanged.

### Verification
- Client type-check: `npx tsc -p tsconfig.json --noEmit` -> PASS
- Lint diagnostics on changed file -> PASS

## 2026-03-20 - Fix CAR age bar chart splitting

### Requirement summary
- CAR page age bar chart is visually splitting; fix layout/rendering.

### Implemented changes
- Updated `client/src/pages/CorrectiveActions.tsx` age chart layout:
  - Reworked chart plot area to a stable single horizontal bar-group container.
  - Moved X-axis labels into a dedicated axis row below the bars.
  - Added horizontal overflow safety to avoid bar/label wrapping or split on smaller widths.
  - Kept age bucket logic and counts unchanged.
- Also corrected empty-table `colSpan` for current CAR table columns.

### Verification
- Client type-check: `npx tsc -p tsconfig.json --noEmit` -> PASS
- Lint diagnostics on changed file -> PASS

## 2026-03-20 - Show full CAR age chart without scroll/pagination

### Requirement summary
- Display the entire CAR age bar chart in one view (no pagination/scroll behavior).

### Implemented changes
- Updated `client/src/pages/CorrectiveActions.tsx`:
  - Removed horizontal overflow behavior from the age chart container.
  - Removed fixed `minWidth` that forced partial/off-screen rendering.
  - Made bar and label widths responsive so all four buckets render within the card.

### Verification
- Client type-check: `npx tsc -p tsconfig.json --noEmit` -> PASS
- Lint diagnostics on changed file -> PASS

## 2026-03-20 - CAR optional Finding (`None / N/A`)

### Requirement summary
- In New CAR form, add `None / N/A` option for Finding.
- Allow creating CAR without linking a finding.
- Store no-finding as `NULL`.
- Show `None` in CAR table when finding is not linked.

### Implemented changes
- **Database model**
  - Updated `server/prisma/schema.prisma`:
    - `CorrectiveAction.findingId` -> nullable (`String?`)
    - `CorrectiveAction.finding` -> optional relation with `onDelete: SetNull`
  - Added migration:
    - `server/prisma/migrations/20260331000000_car_optional_finding/migration.sql`
    - Drops NOT NULL on `findingId` and recreates FK as `ON DELETE SET NULL`.

- **Server API**
  - Updated `server/src/routes/cars.ts` (`POST /cars`):
    - Finding is no longer required.
    - `auditId`, `supplierId`, `severity`, `summary`, `discrepancy` remain required.
    - If finding is provided, validates it matches audit/supplier.
    - If finding is omitted/None, CAR is created without `findingId` (DB stores NULL).
  - Updated save-required-fields message to remove `Finding #`.

- **New CAR UI**
  - Updated `client/src/pages/CARRecord.tsx`:
    - Added `None / N/A` option in Finding dropdown.
    - Removed required validation for finding.
    - Added Supplier and Audit selectors in New CAR form so user can create CAR when no finding is selected.
    - Auto-fill from finding still works when a real finding is selected.
    - Existing CAR view now shows `None` for finding when no linked finding exists.

- **CAR list table**
  - Updated `client/src/pages/CorrectiveActions.tsx`:
    - Finding column now displays `None` when CAR has no linked finding.

### Verification
- Client type-check: `npx tsc -p tsconfig.json --noEmit` -> PASS
- Server type-check: `npx tsc -p tsconfig.json --noEmit` -> PASS
- Lint diagnostics on changed files -> PASS

### Environment note
- `npx prisma generate` hit Windows file-lock (`EPERM` on `query_engine-windows.dll.node`).
- If needed for local runtime schema sync, stop active Node processes and rerun Prisma generate/migrate.

## 2026-03-20 - CAR Record workflow/UI rework

### Requirement summary
- Move core action buttons to top area and include: `Save`, `Edit`, `Process`, `Reverse`.
- Show CAR number/status at top.
- Use status lifecycle in UI: `RCCA`, `Waiting Approval`, `Follow Up`, `Closed` (no Draft after Save).
- Add approval block with `Approve` / `Reject` + comment input.
- Add approval log table with columns: `User`, `Action`, `Comment`, `Date/Time`.

### Implemented changes
- **Server**
  - Updated `server/src/routes/cars.ts`:
    - Added reusable `carInclude` containing supplier/audit/finding + approval logs (with user and timestamp).
    - Changed approve transition to:
      - `WaitingApproval -> FollowUp`
    - Reject remains:
      - `WaitingApproval -> RCCA`
    - Approve/Reject endpoints now accept optional `comment` in body and append log entries.
  - Updated Prisma schema:
    - Added `CarApprovalLog` model and relation from `CorrectiveAction`.
  - Added migration:
    - `server/prisma/migrations/20260331002000_car_approval_logs/migration.sql`

- **Client**
  - Updated `client/src/pages/CARRecord.tsx`:
    - Top action row now presents `Save`, `Edit`, `Process`, `Reverse`.
    - Removed bottom `Update draft` action area (replaced by top actions).
    - Added top metadata fields including:
      - `CAR #`
      - `Status` (displayed within the required 4-status set)
      - `Supplier`, `Audit`, `Finding`, `Severity`, `Owner`
    - Added approval block:
      - `Approval Comment` input
      - `Approve` and `Reject` buttons
    - Added `Approval Log` table:
      - `User`, `Action`, `Comment`, `Date/Time`
      - Populated from server logs created on approve/reject.

### Verification
- Client type-check: `npx tsc -p tsconfig.json --noEmit` -> PASS
- Server type-check: `npx tsc -p tsconfig.json --noEmit` -> PASS
- Lint diagnostics on changed files -> PASS

## 2026-03-20 - Fix Prisma relation validation (CarApprovalLog.user)

### Issue
- `prisma migrate dev` failed with:
  - `P1012`
  - missing opposite relation field on `User` for `CarApprovalLog.user`

### Implemented fix
- Updated `server/prisma/schema.prisma`:
  - Added back relation on `User`:
    - `carApprovalLogs CarApprovalLog[]`

### Verification
- `npx prisma validate` -> PASS
- `npx tsc -p tsconfig.json --noEmit` (server) -> PASS

## 2026-03-20 - CAR Draft Edit button visual feedback

### Requirement summary
- In CAR Draft page, when clicking `Edit`, user should clearly see whether edit mode is active.

### Implemented changes
- Updated `client/src/pages/CARRecord.tsx`:
  - Edit button now changes label:
    - `Edit` -> `Editing` when toggled on.
  - Edit button now changes style in active mode (primary-colored background/text) for clear visual state.

### Verification
- Client type-check: `npx tsc -p tsconfig.json --noEmit` -> PASS
- Lint diagnostics on changed file -> PASS

## 2026-03-20 - Fix CAR Draft edit/save/process data loss

### Issue observed
- In CAR Draft flow, after editing fields, clicking Save and then Process could show old data (edited values appeared lost).

### Root cause
- Save transitioned status (`/cars/:id/save`) without first persisting the latest draft form data.
- Process/approval actions only partially synced local form fields from API response.

### Implemented fix
- Updated `client/src/pages/CARRecord.tsx`:
  - Added `syncFormFromCar()` helper to keep full form state aligned with backend payload.
  - `handleSave()` now:
    1) PATCHes current edits to persist draft fields
    2) then calls `/cars/:id/save` to transition to RCCA
  - `runAction()` and `runApprovalAction()` now sync full form using `syncFormFromCar()` after server response.
  - Save exits edit mode after successful transition.

### Verification
- Client type-check: `npx tsc -p tsconfig.json --noEmit` -> PASS
- Lint diagnostics on changed file -> PASS

## 2026-03-20 - CAR Record workflow re-check + remove lower Save

### Requirement summary
- Re-check CAR workflow alignment and remove the extra `Save` button under `Closing Comments`.
- Keep `Save` button only in the top action area.

### Implemented changes
- Updated `client/src/pages/CARRecord.tsx`:
  - Removed the lower `Save` button block beneath `Closing Comments`.
  - Removed now-unused `handlePatch` function after button removal.

### Workflow check result
- Confirmed implemented path remains:
  - `Draft -> Save -> RCCA -> Process -> WaitingApproval -> Approve -> FollowUp -> Process -> Closed`

### Verification
- Client type-check: `npx tsc -p tsconfig.json --noEmit` -> PASS

## 2026-03-20 - Add Owner column in Corrective Actions table

### Requirement summary
- Add `Owner` column in CAR table.
- Place it after `Summary`.
- Keep `Updated` and all existing columns.

### Implemented changes
- Updated `client/src/pages/CorrectiveActions.tsx`:
  - Added table header `Owner` immediately after `Summary`.
  - Rendered owner value from `carOwner`.
  - Shows `—` when owner is empty/null.
  - Updated empty-row `colSpan` to match the new column count.

### Verification
- Client type-check: `npx tsc -p tsconfig.json --noEmit` -> PASS
- Lint diagnostics on changed file -> PASS

## 2026-03-20 - Findings page: defect-code bar chart + status color mapping

### Requirement summary
- Convert `Top defect codes` into a bar chart in the same section.
- Update Findings status colors only:
  - `Closed` -> Gray
  - `Waiting Approval` -> Red
  - `Waiting Disposition` -> Yellow
- Apply these colors in Findings table status column badges.

### Implemented changes
- Updated `client/src/pages/Findings.tsx`:
  - Replaced top defect-code chips with a bar chart:
    - X-axis = defect codes
    - Y-axis = finding count (bar height)
  - Kept chart in the same `Top defect codes` card area.
  - Switched Findings table status badge class to page-specific class:
    - `findings-status-badge ...`
- Updated `client/src/index.css`:
  - Added Findings-only badge styles:
    - `.findings-status-badge--closed` -> gray
    - `.findings-status-badge--waiting-approval` -> red
    - `.findings-status-badge--waiting-disposition` -> yellow
  - Added default fallback styles for other Findings states.

### Verification
- Client type-check: `npx tsc -p tsconfig.json --noEmit` -> PASS
- Lint diagnostics on changed files -> PASS

## 2026-03-20 - Findings table row colors aligned to status

### Requirement summary
- Apply row colors based on Findings status (not only status badge colors).

### Implemented changes
- Updated `client/src/index.css` row classes for Findings:
  - `.finding-row--waiting-disposition` -> yellow tint (kept)
  - `.finding-row--waiting-approval` -> red tint
  - `.finding-row--closed` -> gray tint

### Verification
- Client type-check: `npx tsc -p tsconfig.json --noEmit` -> PASS
- Lint diagnostics on changed files -> PASS

## 2026-03-20 - Findings top defect chart: non-splitting responsive layout

### Requirement summary
- Top defect codes bar chart must not split by screen/window size and should remain flexible.

### Implemented changes
- Updated `client/src/pages/Findings.tsx`:
  - Switched bar chart layout from flexible row widths to a fixed single chart grid.
  - Uses `gridTemplateColumns: repeat(n, minmax(0, 1fr))` for top defect codes.
  - Removed fixed/min bar widths that caused split/overflow behavior.
  - Keeps labels truncated safely within each column.

### Verification
- Client type-check: `npx tsc -p tsconfig.json --noEmit` -> PASS
- Lint diagnostics on changed file -> PASS
