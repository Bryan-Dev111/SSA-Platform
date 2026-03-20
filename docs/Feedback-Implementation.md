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

## 2026-03-20 - Download button progress in Records/Documents + Documents download toast

### Requirement summary
- In Records and Documents tables:
  - While downloading, show progress bar inside the `Download` button (instead of text).
  - After finish, button returns to `Download`.
- In Documents page:
  - show success notification when download completes.

### Implemented changes
- Updated `client/src/utils/apiHelpers.ts`:
  - added `downloadWithAuthProgress(...)` helper using `XMLHttpRequest` download progress.

- Updated `client/src/pages/Records.tsx`:
  - added per-row downloading progress state.
  - download button now shows inline progress bar + percentage while active.
  - button disables during active download.
  - on completion, state clears and label returns to `Download`.

- Updated `client/src/pages/Documents.tsx`:
  - added per-row downloading progress state.
  - download button now shows inline progress bar + percentage while active.
  - button disables during active download.
  - added success toast: `Download completed`.
  - on completion, state clears and label returns to `Download`.

### Verification
- Client type-check: `npx tsc --noEmit` -> PASS
- Lint diagnostics on changed files -> PASS

## 2026-03-20 - Documents table pagination

### Requirement summary
- Add pagination in Documents table for comfortable viewing.

### Implemented changes
- Updated `client/src/pages/Documents.tsx`:
  - Added pagination state: `page`, `pageSize`
  - Added computed paging values and paginated row slice
  - Added auto-clamp when row count/page size changes
  - Added pagination footer with:
    - record range summary (`x–y of total`)
    - rows-per-page selector (`5/10/20/50`)
    - `Previous` / `Next` controls
    - page indicator (`Page X of Y`)

### Verification
- Client type-check: `npx tsc --noEmit` -> PASS
- Lint diagnostics on changed file -> PASS

## 2026-03-20 - Internal Management: Type + Note

### Requirement summary
- Rename `Category` -> `Type` in Internal Management form/table.
- Add optional `Note` field in form.
- Save and display note in table.
- Keep upload logic, file handling, and permissions unchanged.

### Implemented changes
- Updated `client/src/pages/InternalManagement.tsx`:
  - Added `note` to `InternalRow` type and form state.
  - Form labels/fields updated:
    - `Category` label renamed to `Type` (backed by existing `category` value for compatibility).
    - Added optional `Note` input under `Type`.
  - Create payload now sends `note` and resets it after successful save.
  - Table headers updated to:
    - `Name | Type | Note | View | Updated | Delete`
  - Table body now displays note value (`—` when empty).
- Updated `server/src/routes/internal-docs.ts`:
  - `POST /internal-docs` now accepts and stores `note`.
  - `PATCH /internal-docs/:id` now accepts and updates `note`.
  - No changes to upload or download file behavior.
- Updated schema and migration:
  - `server/prisma/schema.prisma`: added `InternalDoc.note String?`
  - Added migration `server/prisma/migrations/20260331010000_internal_doc_add_note/migration.sql`

### Verification
- Client type-check: `npx tsc --noEmit` -> PASS
- Server build: `npm run build` -> PASS
- Lint diagnostics on changed files -> PASS
- Note: `npm run db:generate` hit a Windows file-lock `EPERM` on Prisma engine rename (existing environment issue); code compile checks still pass.

## 2026-03-20 - Internal Management file/download UI parity

### Requirement summary
- Make Internal Management `File (optional)` form UI/behavior match Documents page.
- Make Internal Management table `Download` button UI/behavior match Documents page.

### Implemented changes
- Updated `client/src/pages/InternalManagement.tsx`:
  - Form `File (optional)` now uses the same pattern as Documents:
    - hidden native file input + `Choose File` button (`file-picker-btn`)
    - selected file name display
    - size and extension hint line
    - upload progress indicator (`<progress>` + percentage) shown during active upload
  - Kept existing upload logic (base64 JSON flow) and added file-read progress tracking via `FileReader.onprogress`.
  - Table `Download` button now matches Documents:
    - disabled while active
    - in-button progress bar + percentage during download
    - restores to `Download` after completion
    - success toast shown on completion
  - Download now uses `downloadWithAuthProgress` for real-time progress behavior consistent with Documents.

### Verification
- Client type-check: `npx tsc --noEmit` -> PASS
- Lint diagnostics on changed file -> PASS

## 2026-03-20 - Internal Management delete confirmation modal

### Requirement summary
- In Internal Management table, clicking `Delete` must show a confirmation modal before deleting.

### Implemented changes
- Updated `client/src/pages/InternalManagement.tsx`:
  - Added `ConfirmDialog` integration for delete confirmation.
  - Replaced inline browser `confirm(...)` flow with modal-based flow:
    - click `Delete` -> open modal
    - confirm -> execute delete API
    - cancel -> close modal, no delete
  - Preserved existing delete behavior and button disable state while deleting.

### Verification
- Client type-check: `npx tsc --noEmit` -> PASS
- Lint diagnostics on changed file -> PASS

## 2026-03-20 - Fix stuck download progress (Records/Documents)

### Issue
- Download operation succeeds, but progress may appear stuck and not increase in some environments.

### Root cause
- Some browser/server combinations do not provide computable `onprogress` metadata (or emit sparse events), so pure event-driven percentage updates can stall visually.

### Implemented fix
- Updated `client/src/utils/apiHelpers.ts` (`downloadWithAuthProgress`):
  - Start fallback progress timer immediately when download begins.
  - Keep pulsing progress up to 95% if no computable progress is available.
  - If computable progress is available, use real byte-based percent.
  - Always set to 100% on successful completion.
  - Clear timers on completion/error.

### Verification
- Client type-check: `npx tsc --noEmit` -> PASS
- Lint diagnostics on related files -> PASS

## 2026-03-20 - Download button progress style aligned with upload progress UI

### Requirement summary
- In Records/Documents tables, download progress bar shown inside `Download` button should match upload progress style used in forms.

### Implemented changes
- Updated:
  - `client/src/pages/Records.tsx`
  - `client/src/pages/Documents.tsx`
- Standardized in-button download progress UI to match form upload style:
  - progress bar width `90`
  - same compact height
  - percentage text beside bar
  - consistent container width/spacing
  - button width reserved while active

### Verification
- Client type-check: `npx tsc --noEmit` -> PASS
- Lint diagnostics on changed files -> PASS

## 2026-03-20 - Real-time download progress reliability (Records/Documents)

### Requirement summary
- Ensure download button progress in Records/Documents updates in real-time.

### Implemented changes
- Updated `client/src/utils/apiHelpers.ts` (`downloadWithAuthProgress`):
  - Keeps normal percentage progress when `Content-Length` is available.
  - Added fallback real-time progress pulse for responses without computable length:
    - increments progress periodically up to 95% until completion.
  - Clears fallback timer on completion/error and sets 100% on success.

### Verification
- Client type-check: `npx tsc --noEmit` -> PASS
- Lint diagnostics on changed files -> PASS

## 2026-03-20 - Records progress behavior aligned with Documents form

### Requirement summary
- Ensure Records form progress bar behavior matches Documents form.

### Implemented changes
- Updated `client/src/pages/Records.tsx`:
  - On file selection, progress is no longer forced to `0%`.
  - Progress now appears/updates only during active upload (same lifecycle as Documents).
  - File info display remains visible on selection.

### Verification
- Client type-check: `npx tsc --noEmit` -> PASS
- Lint diagnostics on changed file -> PASS

## 2026-03-20 - Documents form upload progress bar (same behavior as Records)

### Requirement summary
- In Documents page form, show upload progress bar when selecting/uploading file, like Records page.

### Implemented changes
- Updated `client/src/pages/Documents.tsx`:
  - Added `uploadProgress` state.
  - Added `postDocumentWithProgress(...)` using `XMLHttpRequest` upload progress events.
  - Create submit now uses XHR multipart upload with real-time progress updates.
  - File helper row now shows:
    - file size + extension
    - progress bar + percentage while uploading.
  - Progress resets after success/failure.

### Verification
- Client type-check: `npx tsc --noEmit` -> PASS
- Lint diagnostics on changed file -> PASS

## 2026-03-20 - Documents file picker style parity + clearer picker buttons

### Requirement summary
- Make Documents `File (optional)` form style same as Records.
- Show file name, size, extension in file area.
- Improve visual clarity of file picker button shape/color in both pages.
- Ensure Documents form clears current values after successful create.

### Implemented changes
- Updated `client/src/pages/Documents.tsx`:
  - Replaced native visible file input with hidden input + custom `Choose File` button (same interaction pattern as Records).
  - Added file info display (`name`, `size`, `extension`) under picker area.
  - On successful create, form now resets:
    - `documentNumber`, `name`, `type`, `revision`, selected file, and native file input value.
- Updated `client/src/pages/Records.tsx`:
  - Improved helper text to include file extension with size.
  - Switched chooser button to shared clearer file-picker button style.
- Updated `client/src/index.css`:
  - Added reusable `.file-picker-btn` style for stronger visibility (clear border/shape/color on light backgrounds).

### Verification
- Client type-check: `npx tsc --noEmit` -> PASS
- Lint diagnostics on changed files -> PASS

## 2026-03-20 - Documents form row alignment with Records

### Requirement summary
- Ensure `File (optional)` aligns on the same horizontal row as:
  - `Document Number`, `Name`, `Type`, `Revision`, and `Create`
- Match alignment behavior of Records form.

### Implemented changes
- Updated `client/src/pages/Documents.tsx`:
  - Replaced auto-fill grid with explicit one-row column layout matching Records-style behavior.
  - Added bottom helper space to the row (`paddingBottom`) for file meta text.
  - File field container now uses `position: relative`.
  - File info helper row is absolutely positioned below the main row to avoid vertical row shift.

### Verification
- Client type-check: `npx tsc --noEmit` -> PASS
- Lint diagnostics on changed file -> PASS

## 2026-03-20 - Documents page terminology/order alignment (Number + Revision)

### Requirement summary
- Replace `#` with `Number`.
- Rename `Category` to `Revision`.
- Form order: `Document Number -> Name -> Type -> Revision -> File`.
- Table order/headers: `Number | Name | Type | Revision | View | Delete`.
- Keep manual document number input (no auto-generation).

### Implemented changes
- Updated `client/src/pages/Documents.tsx`:
  - Form label changed:
    - `Document #` -> `Document Number`
  - Table header changed:
    - `#` -> `Number`
  - Renamed form field/state from `category` to `revision` (UI terminology).
  - Reordered form fields to:
    - Document Number
    - Name
    - Type
    - Revision
    - File
  - Table now displays `Revision` column (mapped from API category data).
  - Kept manual document number entry behavior unchanged.

- Updated `server/src/routes/documents.ts`:
  - Accepts `revision` in POST/PATCH payload and maps it to existing DB field (`category`) for backward compatibility.
  - Still accepts legacy `category` payload as fallback.

### Verification
- Client type-check: `npx tsc --noEmit` -> PASS
- Server type-check: `npx tsc -p tsconfig.json --noEmit` -> PASS
- Lint diagnostics on changed files -> PASS

## 2026-03-20 - Documents upload/download aligned to Records flow

### Requirement summary
- Make Documents page upload/download function complete like Records page.

### Implemented changes
- **Server (`server/src/routes/documents.ts`)**
  - Added multipart upload handling with `multer` memory storage.
  - `POST /documents` now accepts `multipart/form-data` file uploads.
  - `PATCH /documents/:id` now also accepts multipart file updates.
  - Uploads document binary to Supabase Storage via signed SDK upload helper.
  - `GET /documents/:id/download` now first tries storage signed-url download flow.
  - Legacy local-file path download remains as fallback for old document rows.

- **Storage helper (`server/src/lib/supabaseStorage.ts`)**
  - Added `uploadDocumentToStorage(...)` for document bucket/object upload.

- **Client (`client/src/pages/Documents.tsx`)**
  - Switched create upload from base64 JSON to `FormData` multipart upload.
  - Increased client-side file size check to `150MB`.
  - Kept existing download button behavior (`/documents/:id/download`).

- **API client helper (`client/src/api/client.ts`)**
  - `apiFetch` no longer forces JSON content-type when body is `FormData`.

### Verification
- Server type-check: `npx tsc -p tsconfig.json --noEmit` -> PASS
- Client type-check: `npx tsc --noEmit` -> PASS
- Lint diagnostics on changed files -> PASS

## 2026-03-20 - Documents delete confirmation modal

### Requirement summary
- On Documents page, clicking `Delete` must open a decision modal before deletion.

### Implemented changes
- Updated `client/src/pages/Documents.tsx`:
  - Added `ConfirmDialog` integration for delete action.
  - `Delete` button now opens modal (`Delete document`).
  - Actual delete runs only after confirm.
  - Cancel closes modal without action.

### Verification
- Client type-check: `npx tsc --noEmit` -> PASS
- Lint diagnostics on changed file -> PASS

## 2026-03-20 - Records form row alignment + reject disable on rejected

### Requirement summary
- Keep `File (optional)` on the same horizontal row as Name/Source/Supplier/Submit.
- Disable `Reject` button when the row is already rejected (including after successful reject).

### Implemented changes
- Updated `client/src/pages/Records.tsx`:
  - Upload grid columns changed to explicit per-role layouts so controls remain aligned on one row:
    - Non-supplier: Name | Source | Supplier | File | Submit
    - Supplier: Name | File | Submit
  - `Reject` button now disables when status is already `Rejected`.
  - Added tooltip/title for disabled rejected state.

### Verification
- Client type-check: `npx tsc --noEmit` -> PASS
- Lint diagnostics on changed file -> PASS

## 2026-03-20 - Records form: stable file chooser layout

### Requirement summary
- Keep Records upload form layout fixed when clicking/choosing file.

### Implemented changes
- Updated `client/src/pages/Records.tsx`:
  - Replaced visible native file input (which can resize/shift layout with long file names).
  - Added hidden file input + fixed `Choose File` button trigger.
  - Added fixed-width/truncated filename display beside the button.
  - Kept existing size/progress helper row below input area.

### Verification
- Client type-check: `npx tsc --noEmit` -> PASS
- Lint diagnostics on changed file -> PASS

## 2026-03-20 - Records upload form layout stability (file select)

### Requirement summary
- Keep upload form layout stable when selecting a file (no jump/shift).

### Implemented changes
- Updated `client/src/pages/Records.tsx` file input block:
  - Moved progress + size display into a fixed helper row below the file input.
  - Added reserved helper height (`minHeight`) so selecting a file does not change row alignment.
  - Kept size + progress visibility behavior intact.

### Verification
- Client type-check: `npx tsc --noEmit` -> PASS
- Lint diagnostics on changed file -> PASS

## 2026-03-20 - Records UX improvements (download toast, file size display, pagination)

### Requirement summary
- Show notification when file download finishes.
- In Upload form, show selected file size with upload progress area.
- Add pagination in Records table for comfortable viewing.

### Implemented changes
- Updated `client/src/pages/Records.tsx`:
  - `Download` flow now shows success toast after completion (`Download completed`).
  - Upload form now shows selected file size (`MB`) under `File (optional)` input while file is selected.
  - Added table pagination:
    - page state + page size state
    - paged row rendering
    - range summary (`x–y of total`)
    - rows-per-page selector
    - Previous/Next controls

### Verification
- Client type-check: `npx tsc --noEmit` -> PASS
- Lint diagnostics on changed file -> PASS

## 2026-03-20 - Records large-upload best approach (storage-based binary upload)

### Requirement summary
- Implement best large-file approach for Records uploads (avoid base64 JSON bottleneck).

### Implemented changes
- **Server dependencies**
  - Added `@supabase/supabase-js` and `multer` (+ `@types/multer`).

- **Supabase storage helper**
  - Added `server/src/lib/supabaseStorage.ts`:
    - storage client init from env:
      - `SUPABASE_URL`
      - `SUPABASE_SERVICE_ROLE_KEY`
      - `SUPABASE_STORAGE_BUCKET` (default: `records`)
    - upload helper for record files
    - signed URL helper for downloads
    - large file max constant (`150MB`)

- **Records upload path updated**
  - Updated `server/src/routes/records.ts`:
    - `POST /records` now accepts `multipart/form-data` (`multer` memory upload)
    - uploads binary file to Supabase Storage bucket
    - stores storage object path in `Record.filePath`
    - stores metadata (`fileName`, `fileMime`)
    - fallback: if storage config/upload fails, keeps DB-byte fallback (`fileData`) to avoid blocking uploads

- **Records download updated**
  - `GET /records/:id/download` now:
    - uses signed URL from storage for filePath-backed records
    - streams bytes back as downloadable response
    - falls back to DB-bytes / legacy local path when needed

- **Client upload path updated**
  - Updated `client/src/pages/Records.tsx`:
    - switched upload transport from base64 JSON to `FormData` binary upload
    - keeps real-time progress bar using `XMLHttpRequest` upload progress
    - keeps immediate file-size validation and toast behavior

### Verification
- Server type-check: `npx tsc -p tsconfig.json --noEmit` -> PASS
- Client type-check: `npx tsc --noEmit` -> PASS
- Lint diagnostics on changed files -> PASS

## 2026-03-20 - Records review UX: reject confirm + disable approve when approved

### Requirement summary
- On Records page, clicking `Reject` must show a decision confirmation modal.
- If a record is already `Approved`, `Approve` button should be inactive.

### Implemented changes
- Updated `client/src/pages/Records.tsx`:
  - Added `ConfirmDialog` for reject action.
  - `Reject` click now opens modal; action runs only after confirm.
  - `Approve` button now disables when row status is already `Approved`.
  - Added tooltip/title for inactive approve state.

### Verification
- Client type-check: `npx tsc --noEmit` -> PASS
- Lint diagnostics on changed file -> PASS

## 2026-03-20 - Records page workflow/data fixes (optional supplier, cloud-safe download, override)

### Requirement summary
- Supplier in upload form should be optional (`None` allowed).
- Reorder upload fields to `Name -> Source -> Supplier`.
- Show uploader full name (not email) in `Uploaded by`.
- Increase upload limit for large files.
- Fix file download reliability (no local-only dependency).
- Allow Admin/QE to override status any time (`Approve`/`Reject` always visible).

### Implemented changes
- **Database**
  - Updated `server/prisma/schema.prisma` (`Record` model):
    - `supplierId` changed to nullable (`String?`)
    - relation changed to optional `supplier Supplier?` with `onDelete: SetNull`
    - added `fileName String?`, `fileMime String?`, `fileData Bytes?`
  - Added migration:
    - `server/prisma/migrations/20260331009000_records_optional_supplier_cloud_file/migration.sql`

- **Backend API**
  - Updated `server/src/app.ts`:
    - JSON body limit increased to `100mb`.
  - Updated `server/src/routes/records.ts`:
    - create now allows `supplierId = null` (except Supplier role, which still requires own supplier)
    - upload size cap raised to `100MB`
    - stores uploaded file bytes in DB (`fileData`) with metadata (`fileName`, `fileMime`)
    - download endpoint now serves DB-stored file bytes first (cloud DB-backed, no local path dependency)
    - legacy `filePath` download kept as fallback for old records
    - review patch remains status update and supports repeated overrides
    - list/filter supports `supplierId=none` for null-supplier rows in admin scope

- **Client UI**
  - Updated `client/src/pages/Records.tsx`:
    - form order changed to `Name -> Source -> Supplier`
    - supplier field no longer required; includes `None` option
    - submit sends `supplierId: null` when `None` selected
    - upload size check raised to `100MB`
    - sends `fileMime` with upload payload
    - `Uploaded by` column now shows full name (`uploadedBy.name`) only
    - review actions `Approve` and `Reject` are always visible for Admin/QE rows (status override enabled anytime)

### Verification
- DB migration deploy: `npx prisma migrate deploy` -> PASS
- Prisma client generate: `npx prisma generate` -> PASS
- Client type-check: `npx tsc --noEmit` -> PASS
- Server type-check: `npx tsc -p tsconfig.json --noEmit` -> PASS
- Lint diagnostics on changed files -> PASS

## 2026-03-20 - Records upload UX: progress + immediate file-size validation

### Requirement summary
- Show upload progress bar next to `File (optional)` while uploading.
- On file selection, immediately alert when file exceeds current limit.

### Implemented changes
- Updated `client/src/pages/Records.tsx`:
  - Added upload limit constant for current practical transport limit:
    - `MAX_UPLOAD_BYTES = 75MB`
  - Added immediate file selection validation:
    - if selected file exceeds 75MB, toast error shown and file is not accepted
  - Added upload progress state (`uploadProgress`)
  - Added progress UI next to `File (optional)` label:
    - HTML `<progress>` bar + percent text
  - Implemented `postRecordWithProgress(...)` using `XMLHttpRequest` upload progress events for `/records` POST.
  - Existing submission flow and backend payload are preserved.

### Verification
- Client type-check: `npx tsc --noEmit` -> PASS
- Lint diagnostics on changed file -> PASS

## 2026-03-20 - Supplier List page title rename

### Requirement summary
- Change Supplier List page title from `Supplier List` to `Approved Supplier List`.

### Implemented changes
- Updated `client/src/pages/SupplierList.tsx`:
  - Replaced all page-title occurrences in loading/error/main states:
    - `Supplier List` -> `Approved Supplier List`

### Verification
- Client type-check: `npx tsc --noEmit` -> PASS
- Lint diagnostics on changed file -> PASS

## 2026-03-20 - Audits page: add Auditor + status badge color mapping

### Requirement summary
- Add `Auditor` input field in `Schedule new audit` form.
- Save auditor value to DB and display it in Audits table.
- Add `Auditor` table column with placement:
  - `Code | Supplier | Date | Type | Auditor | Status | Result | Notes | Findings | Delete`
- Update audit status colors:
  - Scheduled = Blue
  - Complete = Gray
  - In Process = Yellow
  - Overdue = Red

### Implemented changes
- **Database**
  - Updated `server/prisma/schema.prisma`:
    - Added `Audit.auditor String?`
  - Added migration:
    - `server/prisma/migrations/20260331008000_audit_add_auditor/migration.sql`

- **Server API (`server/src/routes/audits.ts`)**
  - Added `auditor` handling in `POST /audits` (create).
  - Added `auditor` handling in `PATCH /audits/:id` (update payload support).
  - Included `auditor` in list response mapping.
  - Updated derived status display text from `In-Process` to `In Process` (display label only; workflow unchanged).

- **Client UI (`client/src/pages/Audits.tsx`)**
  - Extended `Audit` type with `auditor`.
  - Extended create form state with `auditor`.
  - Added `Auditor` text input in `Schedule new audit` form (same style as Notes).
  - Submit payload now sends `auditor`.
  - Added `Auditor` column before `Status`.
  - Status cell now renders badge element with status-specific class.
  - Updated empty-table `colSpan` for new column.

- **Client styling (`client/src/index.css`)**
  - Added `audit-status-badge` styles and status variants:
    - `--scheduled` (blue)
    - `--in-process` (yellow)
    - `--overdue` (red)
    - `--complete` (gray)
  - Kept cancelled/unknown with neutral mapping.
  - Updated complete row background to gray tint for consistency.

### Verification
- DB migration deploy: `npx prisma migrate deploy` -> PASS
- Client type-check: `npx tsc --noEmit` -> PASS
- Server type-check: `npx tsc -p tsconfig.json --noEmit` -> PASS
- Lint diagnostics on changed files -> PASS
- Note: `npx prisma generate` still intermittently reports Windows `EBUSY` lock in this environment.

## 2026-03-20 - Unify status badge shape across product

### Requirement summary
- Make all current product status badges use the same shape as the Findings table status badge.

### Implemented changes
- Updated `client/src/index.css` to use one shared base style for:
  - `.finding-status-badge` (CAR table status badges)
  - `.findings-status-badge` (Findings table status badges)
  - `.audit-status-badge` (Audits table status badges)
- Standardized badge shape properties to Findings-table style:
  - `display: inline-block`
  - `padding: var(--space-1) var(--space-3)`
  - `border-radius: var(--radius-md)`
  - same text sizing/weight and nowrap behavior
- Kept existing per-status color mappings unchanged.

### Verification
- Client type-check: `npx tsc --noEmit` -> PASS
- Lint diagnostics on affected files -> PASS

## 2026-03-20 - Supplier Profile: supplier filter for Admin/Buyer/QE

### Requirement summary
- Add a supplier filter dropdown on Supplier Profile page.
- Supplier role: no dropdown, always own profile.
- Admin/Buyer/QualityEngineer: dropdown visible, can pick supplier and view full profile data.
- Replace non-supplier empty notice with selectable profile viewing.
- Backend should provide selected-supplier profile data.

### Implemented changes
- **Backend**
  - Added endpoint: `GET /suppliers/:id/profile` in `server/src/routes/suppliers.ts`.
  - Endpoint returns supplier profile payload with related:
    - supplier details
    - assigned buyers
    - audits
    - findings
    - CARs
    - risk snapshots
    - records
    - shipments
    - metrics summary
  - Scope enforced through existing `getAllowedSupplierIds` (Admin all, Buyer assigned, Supplier own).

- **Client (`client/src/pages/SupplierProfile.tsx`)**
  - Added supplier dropdown state + options for non-supplier roles.
  - For `Admin` / `Buyer` / `QualityEngineer`:
    - show `Supplier filter` at top
    - load selected supplier profile via `GET /suppliers/:id/profile`
    - show default empty message when no supplier selected
  - For `Supplier` role:
    - hide dropdown
    - continue loading own profile via `GET /me/supplier-portal`
  - Preserved existing profile layout/tables and data presentation.
  - Kept supplier-only submission forms (`Upload record`, `Request shipment inspection`) visible only for Supplier role.

### Verification
- Client type-check: `npx tsc --noEmit` -> PASS
- Server type-check: `npx tsc -p tsconfig.json --noEmit` -> PASS
- Lint diagnostics on changed files -> PASS

## 2026-03-20 - Sidebar label update

### Requirement summary
- Change sidebar menu label from `Supplier List` to `Approved Supplier List`.

### Implemented changes
- Updated `client/src/components/Layout.tsx`:
  - `MENU_ITEMS` entry label for `/supplier-list` changed to `Approved Supplier List`.

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

## 2026-03-20 - CAR table row colors mapped by status

### Requirement summary
- In CAR table, set row colors by status:
  - `Closed` -> gray
  - `WaitingApproval` -> red
  - `RCCA` -> yellow
  - `FollowUp` -> green

### Implemented changes
- Updated `client/src/index.css` CAR row classes:
  - `.car-row--waiting-disposition` (RCCA slug) -> yellow tint
  - `.car-row--waiting-approval` -> red tint
  - `.car-row--follow-up` -> green tint
  - `.car-row--closed` -> gray tint

### Verification
- Client type-check: `npx tsc -p tsconfig.json --noEmit` -> PASS
- Lint diagnostics on changed files -> PASS

## 2026-03-20 - Findings create: optional Audit (`None / N/A`)

### Requirement summary
- Add `None / N/A` option to Findings `Audit` field.
- Make `Audit` optional for create.
- Store `auditId = null` when no audit selected.
- Keep `Supplier` required.
- Display `Audit = None` when missing.

### Implemented changes
- **Database**
  - Updated `server/prisma/schema.prisma`:
    - `Finding.auditId` -> nullable (`String?`)
    - `Finding.audit` -> optional relation (`onDelete: SetNull`)
  - Added migration:
    - `server/prisma/migrations/20260331004000_finding_optional_audit/migration.sql`

- **Server API**
  - Updated `server/src/routes/findings.ts` (`POST /findings`):
    - `auditId` is no longer required.
    - If provided, validates audit belongs to selected supplier.
    - If omitted/None, finding is created with null audit link.
  - Updated Save validation message text to remove required `Audit #`.

- **Client UI**
  - Updated `client/src/pages/FindingsRecord.tsx`:
    - New finding form `Audit` field now includes `None / N/A`.
    - Audit is optional (removed required flag).
    - Submit sends `auditId: null` when none selected.
    - Supplier remains required (unchanged).
    - In existing finding detail, audit displays `None` when missing.
  - Updated `client/src/pages/Findings.tsx`:
    - Audit column shows `None` when a finding has no audit.

### Verification
- Client type-check: `npx tsc -p tsconfig.json --noEmit` -> PASS
- Server type-check: `npx tsc -p tsconfig.json --noEmit` -> PASS
- Lint diagnostics on changed files -> PASS

## 2026-03-20 - Fix runtime P2011 (`Finding.auditId` null constraint)

### Issue
- Runtime error when creating finding with `None / N/A` audit:
  - `P2011 Null constraint violation on fields: (auditId)`

### Root cause
- Database migration for optional `Finding.auditId` had not been applied yet.

### Implemented fix
- Applied migrations to database:
  - `npx prisma migrate deploy`
  - Included migration: `20260331004000_finding_optional_audit`
- Also fixed an older migration script to be idempotent in shadow DB:
  - `20260320114846_/migration.sql`
  - `DROP INDEX` -> `DROP INDEX IF EXISTS`

### Verification
- Server type-check: `npx tsc -p tsconfig.json --noEmit` -> PASS
- Prisma schema validation: `npx prisma validate` -> PASS

## 2026-03-20 - Findings Record workflow/status rewrite (remove CAR block)

### Requirement summary
- Remove CAR management section from Finding Record detail page.
- Make `Disposition Code` the focus in finding detail.
- Remove `Update Draft`, keep `Save`, add `Process` as primary top actions.
- Replace Draft concept with statuses: `New`, `WaitingDisposition`, `WaitingApproval`, `Closed`.
- Ensure save result stays `New` and Process moves to `WaitingApproval`.
- Ensure finding code format is `FIN-12345` (no `FIN-DRAFT-*`).

### Implemented changes
- **Finding detail page (`client/src/pages/FindingsRecord.tsx`)**
  - Removed the full `Corrective actions (CAR)` block, including:
    - `+ New CAR for this finding`
    - linked CAR list in this page
  - Updated top header actions:
    - kept `Save`
    - added/kept `Process`
    - removed `Update draft` action from the form body
  - `Save` now persists edited form content (PATCH) and then calls `/findings/:id/save`.
  - Status label now renders `DRAFT` legacy records as `New` in UI.

- **Finding statuses and transitions (server)**
  - Updated `server/prisma/schema.prisma`:
    - `Finding.status` default changed to `New`
    - `FindingStatus` enum now includes `New` (legacy `DRAFT` retained for compatibility)
  - Added migration:
    - `server/prisma/migrations/20260331006000_findings_new_status/migration.sql`
    - adds enum value `New`
    - sets DB default to `New`
    - normalizes legacy rows `DRAFT -> New`
  - Updated `server/src/routes/findings.ts`:
    - Create now generates real code with `getNextCode('FIN')` and status `New`.
    - PATCH/Save now allow `New` (and legacy `DRAFT`) editing.
    - Save keeps status as `New` and ensures code is normalized to `FIN-#####`.
    - Process now routes `New`/`WaitingDisposition` -> `WaitingApproval`.
    - Findings list filters exclude `New` (and legacy `DRAFT`) records.

- **Findings list styling/text**
  - Updated `client/src/pages/Findings.tsx`:
    - text changed from `past DRAFT` -> `past New`
    - status slug mapping treats `new`/`draft` as `new`
  - Updated `client/src/index.css`:
    - added `.findings-status-badge--new` style mapping
    - added `.finding-row--new` row style mapping

### Verification
- Client type-check: `npx tsc --noEmit` -> PASS
- Server type-check: `npx tsc -p tsconfig.json --noEmit` -> PASS
- Lint diagnostics on edited files -> PASS
- Note: `npx prisma generate` still intermittently fails with Windows `EBUSY` lock due active file handle; code/type checks pass.

## 2026-03-20 - Fix Prisma P3018 enum migration (`FindingStatus.New`)

### Issue
- `npx prisma migrate deploy` failed on migration `20260331006000_findings_new_status`.
- PostgreSQL error `55P04`: `unsafe use of new value "New" of enum type "FindingStatus"`.

### Root cause
- The migration both added enum value `New` and used it (default/update) in the same migration transaction.
- PostgreSQL requires the new enum value to be committed before it can be used.

### Implemented fix
- Updated `server/prisma/migrations/20260331006000_findings_new_status/migration.sql`
  - Kept only enum value creation (`ALTER TYPE ... ADD VALUE 'New'`).
- Added new migration:
  - `server/prisma/migrations/20260331007000_findings_new_status_finalize/migration.sql`
  - Sets `Finding.status` default to `New`
  - Converts legacy `DRAFT` rows to `New`
- Recovered failed migration state and redeployed:
  - `npx prisma migrate resolve --rolled-back 20260331006000_findings_new_status`
  - `npx prisma migrate deploy`

### Verification
- Migration deploy: PASS (both migrations applied successfully)
- Prisma schema validation: `npx prisma validate` -> PASS
- Server type-check: `npx tsc -p tsconfig.json --noEmit` -> PASS

## 2026-03-20 - Findings workflow alignment: restore approval actions

### Requirement summary
- Keep previous Finding workflow capability (including approval stage) while preserving newly applied client feedback changes.
- Specifically, bring back approval actions so workflow is complete after `Process`.

### Implemented changes
- Updated `client/src/pages/FindingsRecord.tsx`:
  - Restored `Reverse` action handler and top action button.
  - Restored `Approve` and `Reject` handlers and top action buttons.
  - `Approve/Reject` are shown only when status is `WaitingApproval` and role is `Admin` or `QualityEngineer`.
  - `Reverse` is available for permitted editable states via existing backend endpoint.
- Kept previously delivered feedback changes intact:
  - CAR section remains removed from Finding Record detail.
  - `Save` and `Process` remain in top action area.
  - No `Update draft` button.
  - New-style status baseline (`New`) and non-draft code format remain unchanged.

### Verification
- Client type-check: `npx tsc --noEmit` -> PASS
- Server type-check: `npx tsc -p tsconfig.json --noEmit` -> PASS
- Lint diagnostics on changed file -> PASS

## 2026-03-20 - Findings Record back link style alignment

### Requirement summary
- In New Finding / Finding Record page, make `← Back to Findings` match the visual style used in the related workflow pages (same link look/color behavior instead of ghost button style).

### Implemented changes
- Updated `client/src/pages/FindingsRecord.tsx`:
  - Replaced the header back control from a `btn btn-ghost` button to a plain `<Link>` with `textDecoration: 'none'`.
  - This aligns visual behavior with the existing page-link pattern used in record pages.

### Verification
- Client type-check: `npx tsc --noEmit` -> PASS
- Lint diagnostics on changed file -> PASS
