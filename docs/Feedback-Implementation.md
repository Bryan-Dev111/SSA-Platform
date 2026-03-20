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
