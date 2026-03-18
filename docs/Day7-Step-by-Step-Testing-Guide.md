# Day 7 — Step-by-Step Testing Guide (Week 2 Day 2)

**Theme:** Findings workflow + CAR (Corrective Actions) CRUD

**Goal:** Verify that all Day 7 functions work correctly for all roles and all key workflow state transitions.

---

## Prerequisites

### Database & seed

From the project root:

```powershell
cd server
npx prisma migrate deploy
npx prisma db seed
```

Ensure seeded users and data exist (at least one supplier, one audit per supplier, and findings past DRAFT for CAR creation testing).

### Start backend and frontend

- Terminal 1: `cd server` → `npm run dev` (expect API on `http://localhost:4000`)
- Terminal 2: `cd client` → `npm run dev` (expect UI on `http://localhost:5173`)
- Browser: `http://localhost:5173`

---

## Notation

- **Finding states:** `DRAFT` → `WaitingDisposition` → `WaitingApproval` → `Closed`
- **CAR states:** `DRAFT` → `RCCA` → `WaitingApproval` → `FollowUp` → `Closed`

---

## Part A — Findings Workflow (UI + Permissions)

### A.0 Quick navigation sanity

1. As `viewer@sentinel.local`, open **Findings**.
   - Expect: You can view list/table/stats and supplier filter (buyer-scope respected).
   - Expect: You do **not** see **New finding**.
2. As `auditor@sentinel.local`, open **Findings**.
   - Expect: **New finding** is visible.
3. As `buyer@sentinel.local`, open **Findings**.
   - Expect: results are limited to assigned suppliers.

### A.1 Findings page — role-controlled controls

Verify each role sees/hides these items on the **Findings** table:

- **New finding button**
  - Visible: Admin, QE, Auditor
  - Hidden: Viewer, Buyer
- **Change status dropdown column**
  - Visible: Admin, QE, Auditor
  - Hidden: Viewer, Buyer
- **Delete column/button**
  - Visible: Admin only
  - Hidden: everyone else

### A.2 Findings list — state transition correctness (role + state)

Prepare at least one Finding in each state: `DRAFT`, `WaitingDisposition`, `WaitingApproval`, `Closed`.

#### A.2.1 DRAFT → Waiting Disposition (Save)

1. As Admin, create a new Finding draft via **Findings → New finding**.
2. On **Findings Record**, verify these buttons exist only for authorized roles:
   - `Update draft` (when status is `DRAFT`)
   - `Save (DRAFT → Waiting Disposition)`
3. Click `Save`.
   - Expect: status becomes `WaitingDisposition` and finding now appears in Findings list.

Repeat steps for:
- `qe@sentinel.local`
- `auditor@sentinel.local`

#### A.2.2 Waiting Disposition → Waiting Approval (Process)

For Admin, QE, Auditor:
1. Open a Finding in `WaitingDisposition`.
2. Verify:
   - `Process` visible
   - `Approve/Reject` not visible
3. Click `Process`.
   - Expect: `WaitingApproval`

For Viewer/Buyer:
- `Process` not visible.

#### A.2.3 Waiting Approval → Waiting Disposition (Reverse)

For Admin, QE, Auditor:
1. Open a Finding in `WaitingApproval`.
2. Verify:
   - `Reverse` visible
3. Click `Reverse`.
   - Expect: back to `WaitingDisposition`
4. Ensure Reverse never returns to `DRAFT`.

For Viewer/Buyer:
- Reverse not visible.

#### A.2.4 Waiting Approval → Closed (Approve)

For Admin and QE only:
1. Open Finding in `WaitingApproval`.
2. Verify: `Approve` and `Reject` visible.
3. Click `Approve`.
   - Expect: `Closed` and workflow controls disappear.

For Auditor:
- `Approve/Reject` must be hidden.

For Viewer/Buyer:
- `Approve/Reject` must be hidden.

#### A.2.5 Waiting Approval → Waiting Disposition (Reject)

For Admin and QE:
- Click `Reject` and expect `WaitingDisposition`.

For Auditor/Viewer/Buyer:
- Reject not shown.

### A.3 Required-field validations

On Finding Record create/save:

1. Attempt create with Summary empty.
   - Expect: blocked or server error; status unchanged.
2. Attempt create/save with Discrepancy empty.
   - Expect: blocked or server error; status unchanged.
3. Attempt create with Supplier empty.
4. Attempt create with Audit empty.
5. Attempt Save (DRAFT → WaitingDisposition) when not in DRAFT.
   - Expect: Save controls hidden and server rejects if manually called.

### A.4 UI edge cases

1. **Actioning lock**
   - Trigger Process/Reverse/Approve/Reject and ensure controls are disabled until response completes.
2. **Pagination clamp**
   - Use small page size. After status change/delete that reduces table rows, ensure current page clamps and table still renders correctly.
3. **Status badge colors**
   - Validate badge colors/classes for `DRAFT`, `WaitingDisposition`, `WaitingApproval`, `Closed`.

### A.5 Navigation links

1. Click **New finding**:
   - Expect navigation to `/findings-record` (create mode).
2. Click a Finding Code in Findings table:
   - Expect navigation to `/findings-record?id=<findingId>`.
3. On Findings Record, click Audit #:
   - Expect navigation to `/audits`.
4. Back to Findings should return you to the Findings list.

---

## Part B — CAR CRUD + Workflow (UI + Permissions)

### B.0 Redirect / permission loop sanity (Auditor case)

1. As `auditor@sentinel.local`, open `/car-record` with no id/carId.
   - Expect: no redirect loop.
   - Expect: redirect to an accessible page.

### B.1 Corrective Actions page (7.4)

For each role:

1. Verify **New CAR** button visibility:
   - Visible: Admin, QE, Buyer
   - Hidden: Viewer, Auditor
2. Verify supplier filter scope for Buyer:
   - “All” still restricts to assigned suppliers.
3. Verify table rows:
   - Code links open CAR Record (`/car-record?id=<id>`)
   - Finding links open Findings Record (`/findings-record?id=<findingId>`)
4. Verify status badge colors for CAR states.

### B.2 CAR Record — Create Draft (7.5)

Admin/QE/Buyer:
1. Open **Corrective Actions → New CAR**.
2. Select a Finding #.
   - Expect: Audit # and Severity pre-fill from selected finding.
3. Fill Summary and Discrepancy.
4. Click **Create draft**.
   - Expect: CAR created and navigated to its CAR Record page.

Viewer/Auditor:
- Expect no access to create mode (either redirect away or controls hidden).

### B.3 CAR Record — form fields and status history

1. Open an existing CAR and verify all expected fields are present:
   - Supplier, Audit #, Finding #, Severity, CAR Owner, Target Completion Date,
   - Summary, Defect Code, Discrepancy, Containment,
   - Occurrence Root Cause, Escape Root Cause, Corrective Action,
   - Verification of Effectiveness, Closing Comments.
2. Verify **Status history** table exists.

### B.4 CAR workflow transitions (state rules)

Create or locate CARs in each state: `DRAFT`, `RCCA`, `WaitingApproval`, `FollowUp`, `Closed`.

#### B.4.1 Save (DRAFT → RCCA)
1. In `DRAFT`, ensure `Save (DRAFT → RCCA)` visible for Admin/QE/Buyer.
2. Click Save.
   - Expect: status becomes `RCCA`.

#### B.4.2 Process (RCCA → WaitingApproval)
1. In `RCCA`, click Process.
   - Expect: `WaitingApproval`.

#### B.4.3 Reverse (WaitingApproval/FollowUp)
1. In `WaitingApproval`, click Reverse.
   - Expect: `RCCA`.
2. In `FollowUp`, click Reverse.
   - Expect: `WaitingApproval`.
3. Ensure Reverse never returns to `DRAFT`.

#### B.4.4 Approve / Reject (WaitingApproval)
1. In `WaitingApproval`, for Admin/QE/Buyer:
   - Approve → `Closed`
   - Reject → `RCCA`
2. For Viewer: Approve/Reject must not be shown.

### B.5 CAR API checks (if you want to test via console)

Findings:
- `GET /findings` should exclude DRAFT
- Save/Process/Approve/Reject should enforce status + roles

CAR:
- `GET /cars` should exclude DRAFT
- `POST /cars` creates DRAFT with required fields
- `PATCH /cars/:id` allowed for DRAFT only
- `POST /cars/:id/save` DRAFT → RCCA
- `POST /cars/:id/process` moves forward one status
- `POST /cars/:id/reverse` moves back one status (never to DRAFT)
- `POST /cars/:id/approve` and `/reject` allowed only in WaitingApproval and correct roles
- `DELETE /cars/:id` Admin only

---

## Final Sign-off Checklist (Day 7)

Tick when verified:

- [ ] Viewer cannot see New/Workflow controls on Findings and Findings Record
- [ ] Buyer cannot see workflow controls on Findings and Findings Record
- [ ] Auditor can create/edit/process/reverse Findings but cannot approve/reject
- [ ] Admin/QE approve/reject Findings in WaitingApproval
- [ ] Findings state transitions correct + no reverse to DRAFT
- [ ] Findings required-field validation works
- [ ] Pagination and actioning lock work
- [ ] Findings navigation (New finding → Findings Record; code → Findings Record by id)

- [ ] Viewer cannot see New CAR or CAR workflow actions
- [ ] Auditor has no redirect loop opening CAR Record
- [ ] Admin/QE/Buyer can create CAR drafts and run Save/Process/Reverse/Approve/Reject per state
- [ ] CAR state transitions correct (DRAFT→RCCA→WaitingApproval→FollowUp→Closed; no reverse to DRAFT)
- [ ] Buyer scope enforced on Corrective Actions list and direct URL access
- [ ] CAR delete enforced as Admin-only at API level
- [ ] CAR navigation and cross-links to Findings Record work

**Day 7 Testing Complete:** ___________"
