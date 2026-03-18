# Day 7 — Step-by-Step Testing Guide (Week 2 Day 2)

**Theme:** Findings workflow and CAR CRUD  
**Use this guide to verify Day 7 is complete.** Run every section and check the expected results.

---

## Prerequisites

### 1. Database and seed

From the project root:

```powershell
cd server
npx prisma migrate deploy
npx prisma db seed
```

Ensure `.env` has a valid `DATABASE_URL`. You should have at least one supplier (e.g. SUP-TEST01), one audit, and optionally one finding past DRAFT for CAR creation.

### 2. Start backend and frontend

- **Terminal 1:** `cd server` → `npm run dev`  
  - Expect: `Sentinel API listening on http://localhost:4000`
- **Terminal 2:** `cd client` → `npm run dev`  
  - Expect: dev server on http://localhost:5173
- **Browser:** Open http://localhost:5173

### 3. Test users (from seed)

| Email                   | Password  | Role     | Notes |
|-------------------------|-----------|----------|--------|
| admin@sentinel.local    | Admin123! | Admin    | Full access; only role that can delete Finding/CAR |
| viewer@sentinel.local   | Test123!  | Viewer   | View only; no create/edit/approve |
| qe@sentinel.local       | Test123!  | Quality Engineer | Can approve/reject Findings and set audit result |
| auditor@sentinel.local  | Test123!  | Auditor  | Can create findings; cannot create CAR |
| buyer@sentinel.local    | Test123!  | Buyer    | Sees only **SUP-TEST01**; can create CAR and approve/reject CAR |
| supplier@sentinel.local | Test123!  | Supplier | Supplier portal only |

---

## Part A — Findings workflow and UI (7.1, 7.2)

### A.1 Findings workflow: buttons greyed out by state and role

| Step | Action | Expected |
|------|--------|----------|
| 1 | Log in as **admin@sentinel.local**. Go to **Findings**. | Findings page loads. |
| 2 | Click **New finding**. Create a draft (Supplier, Audit, Severity, Summary, Discrepancy) and submit. | Draft is created; status = DRAFT. |
| 3 | On the finding (modal or Findings Record), check buttons. | You see **Update draft** (if editable) and **Save (DRAFT → Waiting Disposition)**. You do **not** see Process, Reverse, Approve, Reject. |
| 4 | Click **Save (DRAFT → Waiting Disposition)**. | Status becomes **Waiting Disposition**; code becomes FIN-00001 (or next). Toast: "Finding saved" or similar. |
| 5 | Check buttons again. | **Save** is gone. You see **Process** (and possibly **Reverse** depending on UI). No Approve/Reject yet. |
| 6 | Click **Process**. | Status becomes **Waiting Approval**. |
| 7 | Check buttons. | **Process** is gone. You see **Approve** and **Reject** (and possibly **Reverse**). |
| 8 | Click **Reverse**. | Status goes back to **Waiting Disposition**. |
| 9 | Click **Process** again to get to **Waiting Approval**. Then click **Approve**. | Status becomes **Closed**. Approve/Reject/Process/Reverse disappear. |
| 10 | Open another finding in **Waiting Approval** (or create and move one there). Log in as **viewer@sentinel.local**. Open that finding. | **Approve** and **Reject** are **not** shown (Viewer cannot approve/reject). |
| 11 | Log in as **qe@sentinel.local**. Open the same finding (Waiting Approval). | **Approve** and **Reject** are shown; QE can approve or reject. |

**Pass / Fail:** _____

---

### A.2 Findings Record: Severity dropdown and link to audit

| Step | Action | Expected |
|------|--------|----------|
| 1 | As **Admin**, open any finding (from list or modal). Go to **Findings Record** (click **(Record)** next to the finding code on the Findings list, or open by URL `/findings-record?id=<findingId>`). | Findings Record page loads with the finding. |
| 2 | Check **Severity** field. | It is a **dropdown** with options **Critical**, **Major**, **Minor** (not free text). |
| 3 | Check **Audit #** field. | It is a **link** (e.g. to **Audits** page). Clicking it goes to `/audits`. |
| 4 | Check **Status history** section. | A table shows **Status**, **Created**, **Updated** with at least one row (current status). |

**Pass / Fail:** _____

---

### A.3 Open Findings Record from Findings list by Finding #

| Step | Action | Expected |
|------|--------|----------|
| 1 | As **Admin**, go to **Findings**. Ensure at least one finding exists in the table (past DRAFT). | Table shows rows with **Code** (e.g. FIN-00001). |
| 2 | Next to the code, find the **(Record)** link. Click **(Record)**. | Browser navigates to **Findings Record** with URL `/findings-record?id=<cuid>`. The same finding loads. |
| 3 | Alternatively, click the finding **Code** (e.g. FIN-00001). | Modal opens with the finding (existing behaviour). |

**Pass / Fail:** _____

---

## Part B — Corrective Actions list (7.4)

### B.1 Corrective Actions page: stats, filter, table

| Step | Action | Expected |
|------|--------|----------|
| 1 | Log in as **admin@sentinel.local**. Click **Corrective Actions** in the sidebar. | Corrective Actions page loads. |
| 2 | Check the top of the page. | You see **four stat cards**: **Open CARs**, **Overdue**, **Waiting Approval**, **AVG Closure (days)**. Values may be 0. |
| 3 | Check below the stats. | A **Supplier filter** dropdown (All + list of suppliers), then a **table** with columns: **Code**, **Supplier**, **Audit**, **Finding**, **Severity**, **Status**, **Summary**, **Updated**. |
| 4 | If no CARs past DRAFT exist. | Table shows "No CARs in scope (or none past DRAFT yet)." |
| 5 | Log in as **buyer@sentinel.local**. Open **Corrective Actions**. | Same layout; supplier filter shows only suppliers assigned to the Buyer (e.g. SUP-TEST01). |

**Pass / Fail:** _____

---

### B.2 New CAR button and link to CAR Record

| Step | Action | Expected |
|------|--------|----------|
| 1 | As **Admin**, on **Corrective Actions** page. | You see a **New CAR** button. |
| 2 | Click **New CAR**. | Navigate to **CAR Record** with title "New CAR" and a create-draft form. |
| 3 | Log in as **viewer@sentinel.local**. Open **Corrective Actions**. | **New CAR** button is **not** shown. |
| 4 | As **Admin**, create at least one CAR and Save so it appears in the list (see Part D). Return to **Corrective Actions**. | Table has a row with a **Code** (e.g. CAR-00001). |
| 5 | Click the **Code** (e.g. CAR-00001). | Navigate to **CAR Record** with URL `/car-record?id=<cuid>`. That CAR loads. |
| 6 | In the table, click the **Finding** code (e.g. FIN-00001) in the Finding column. | Navigate to **Findings Record** for that finding. |

**Pass / Fail:** _____

---

## Part C — CAR Record: create draft (7.5)

### C.1 Create draft CAR (Admin / QE / Buyer)

| Step | Action | Expected |
|------|--------|----------|
| 1 | Log in as **admin@sentinel.local**. Go to **Corrective Actions** → **New CAR** (or open `/car-record` with no id). | Page title: **New CAR**. Form: **Finding #** * (dropdown), **Audit #** (read-only), **Severity** *, **CAR Owner**, **Target Completion Date**, **Summary** *, **Discrepancy** *, **Defect Code**, and **Create draft** button. |
| 2 | Ensure at least one **finding** exists in the list (GET /findings returns non-DRAFT findings). Select **Finding #** = e.g. FIN-00001. | **Audit #** and **Severity** auto-fill from the selected finding. |
| 3 | Enter **Summary** and **Discrepancy**. Optionally set CAR Owner, Target Completion Date, Defect Code. Click **Create draft**. | CAR is created; page navigates to CAR Record for that CAR. Status = **DRAFT**; code like CAR-DRAFT-... or already CAR-00001 depending on implementation. Toast: "CAR created". |
| 4 | Log in as **buyer@sentinel.local**. Open **New CAR**. | Buyer can open the form and create a draft (Admin, QE, Buyer can initiate). |
| 5 | Log in as **viewer@sentinel.local**. Try to open `/car-record` with no id. | Redirect to **Corrective Actions** (Viewer cannot create CAR). |
| 6 | Log in as **auditor@sentinel.local**. Open **Corrective Actions**. | **New CAR** is not shown (Auditor cannot create CAR). |

**Pass / Fail:** _____

---

### C.2 CAR Record form: all fields and status history

| Step | Action | Expected |
|------|--------|----------|
| 1 | Open any CAR (e.g. from Corrective Actions by clicking Code). | CAR Record loads. |
| 2 | Scroll the form. | All fields present: **Supplier**, **Audit #**, **Finding #**, **Severity**, **CAR Owner**, **Target Completion Date**, **Summary**, **Defect Code**, **Discrepancy**, **Containment**, **Occurrence Root Cause**, **Escape Root Cause**, **Corrective Action**, **Verification of Effectiveness**, **Closing Comments**. |
| 3 | Check **Audit #** and **Finding #**. | They are **links** (to Audits and to Findings Record). |
| 4 | Scroll to **Status history**. | A table shows **Status**, **Created**, **Updated** with one row (current status). |

**Pass / Fail:** _____

---

## Part D — CAR workflow: Save, Process, Reverse, Approve, Reject (7.3, 7.5)

### D.1 Save (DRAFT → RCCA)

| Step | Action | Expected |
|------|--------|----------|
| 1 | Open a **DRAFT** CAR as Admin (or QE / Buyer). Ensure **Summary** and **Discrepancy** are filled. | You see **Update draft** and **Save (DRAFT → RCCA)**. |
| 2 | Click **Save (DRAFT → RCCA)**. | Status changes to **RCCA**; **Code** updates to **CAR-00001** (or next). Toast: "CAR saved" or similar. CAR now appears in **Corrective Actions** table. |
| 3 | Try **Save** again. | Button is no longer shown (only for DRAFT). |

**Pass / Fail:** _____

---

### D.2 Process and Reverse

| Step | Action | Expected |
|------|--------|----------|
| 1 | With a CAR in **RCCA**, click **Process**. | Status becomes **Waiting Approval** (or next step per flow). |
| 2 | Click **Reverse**. | Status goes back to **RCCA**. |
| 3 | Click **Process** again. | Status = **Waiting Approval**. |
| 4 | In **Waiting Approval**, check buttons. | **Process** may still be available to move to **Follow-Up** (or only **Approve**/ **Reject** move the CAR). **Reverse** (if shown) goes back; must **never** go back to DRAFT. |
| 5 | If your flow has **Follow-Up**, Process from Waiting Approval. | Status = **Follow-Up**. Then Process again → **Closed** (or similar). |

**Pass / Fail:** _____

---

### D.3 Approve / Reject (Admin / Buyer / QE only)

| Step | Action | Expected |
|------|--------|----------|
| 1 | With a CAR in **Waiting Approval**, log in as **admin@sentinel.local**. | You see **Approve** and **Reject**. |
| 2 | Click **Approve**. | Status becomes **Closed**. Approve/Reject disappear. |
| 3 | Open another CAR and move it to **Waiting Approval**. Log in as **qe@sentinel.local**. | QE sees **Approve** and **Reject** and can approve or reject. |
| 4 | Same CAR in **Waiting Approval**; log in as **buyer@sentinel.local** (if Buyer is in scope for that supplier). | Buyer sees **Approve** and **Reject** and can approve or reject. |
| 5 | Log in as **viewer@sentinel.local**. Open the same CAR (Waiting Approval). | **Approve** and **Reject** are **not** shown. |
| 6 | With a CAR in **Waiting Approval**, click **Reject**. | Status goes back to **RCCA**. |

**Pass / Fail:** _____

---

### D.4 Open CAR Record by id and by code

| Step | Action | Expected |
|------|--------|----------|
| 1 | On **Corrective Actions**, click a CAR **Code** (e.g. CAR-00001). | URL is `/car-record?id=<cuid>`; CAR Record loads that CAR. |
| 2 | In the browser, change URL to `/car-record?carId=CAR-00001` (use the actual code). | CAR Record loads the same CAR by code. |

**Pass / Fail:** _____

---

## Part E — Delete and scope (7.3)

### E.1 Delete CAR (Admin only)

| Step | Action | Expected |
|------|--------|----------|
| 1 | As **Admin**, delete a CAR (if UI has Delete). Or in DevTools Console: `const t = JSON.parse(localStorage.getItem('sentinel_auth')).token; fetch('/api/cars/CAR_ID', { method: 'DELETE', headers: { 'Authorization': 'Bearer ' + t } }).then(r=>console.log(r.status))` — replace CAR_ID with the CAR’s **id** (cuid). | **204**; CAR no longer appears in list on refresh. |
| 2 | As **QE** or **Buyer**, same DELETE. | **403** "Only Admin can delete a CAR" (or similar). |

**Pass / Fail:** _____

---

### E.2 Buyer scope: Corrective Actions and CAR Record

| Step | Action | Expected |
|------|--------|----------|
| 1 | As **Admin**, create an audit and a finding for **SUP-TEST02** (if it exists). Create a CAR for that finding and Save. | CAR exists for SUP-TEST02. |
| 2 | Log in as **buyer@sentinel.local** (assigned only to SUP-TEST01). Open **Corrective Actions**. Set supplier filter to **All**. | Only CARs for **SUP-TEST01** appear. CAR for SUP-TEST02 does **not** appear. |
| 3 | As Buyer, try to open the CAR for SUP-TEST02 by ID in URL (if you know it): `/car-record?id=<cuid>`. | **404** or "CAR not found" (scope enforced in API). |

**Pass / Fail:** _____

---

## Part F — Optional API checks (Console)

Use a valid Bearer token in `Authorization` for all requests. Replace `API_BASE` with your API base (e.g. `http://localhost:4000` or `/api` if proxied).

### Findings (7.1, 7.2)

| Test | Request | Expected |
|------|---------|----------|
| Findings list | `GET /findings` | 200; `{ list, stats, defectCodeCounts }`; list only non-DRAFT. |
| Finding by id | `GET /findings/:id` | 200; single finding. |
| Finding by code | `GET /findings/by-code/FIN-00001` | 200 with finding; 404 if not found. |
| Save finding | `POST /findings/:id/save` | 200; status = WaitingDisposition; code = FIN-00001 (or next). |
| Process | `POST /findings/:id/process` | 200; status moves forward. |
| Approve | `POST /findings/:id/approve` | 200 as Admin/QE when status = WaitingApproval; 403 as Viewer. |

### CARs (7.3)

| Test | Request | Expected |
|------|---------|----------|
| CARs list | `GET /cars` | 200; `{ list, stats }`; list only non-DRAFT; stats: open, overdue, waitingApproval, avgClosureDays. |
| CARs list filtered | `GET /cars?supplierId=SUP_ID` | 200; only CARs for that supplier (or empty if out of scope). |
| CAR by id | `GET /cars/:id` | 200; single CAR with supplier, audit, finding. |
| CAR by code | `GET /cars/by-code/CAR-00001` | 200 with CAR; 404 if not found. |
| Create CAR | `POST /cars` body: `{ "findingId", "auditId", "supplierId", "severity", "summary", "discrepancy" }` | 201; created CAR with code CAR-DRAFT-... and status DRAFT. |
| Update CAR (DRAFT) | `PATCH /cars/:id` body: `{ "summary": "Updated" }` | 200 as Admin/QE/Buyer; 403 as Viewer. |
| Save CAR | `POST /cars/:id/save` | 200; status = RCCA; code = CAR-00001 (or next). |
| Process CAR | `POST /cars/:id/process` | 200; status moves forward. |
| Reverse CAR | `POST /cars/:id/reverse` | 200; status moves back; never to DRAFT. |
| Approve CAR | `POST /cars/:id/approve` | 200 as Admin/QE/Buyer when status = WaitingApproval; 403 as Viewer. |
| Reject CAR | `POST /cars/:id/reject` | 200; status = RCCA. |
| Delete CAR | `DELETE /cars/:id` | 204 as Admin; 403 as QE/Buyer. |

---

## Sign-off checklist

- [ ] **A.1** Findings workflow: buttons greyed by state/role; Save, Process, Reverse, Approve, Reject behave correctly; Viewer cannot approve/reject.
- [ ] **A.2** Findings Record: Severity dropdown; Audit # link; Status history table.
- [ ] **A.3** Open Findings Record from list via **(Record)** link.
- [ ] **B.1** Corrective Actions: four stats, supplier filter, table.
- [ ] **B.2** New CAR button (Admin/QE/Buyer); link from Code to CAR Record; link from Finding to Findings Record.
- [ ] **C.1** Create draft CAR: Finding # dropdown; Audit # and Severity auto from Finding; only Admin/QE/Buyer can create.
- [ ] **C.2** CAR Record: all form fields; Audit # and Finding # links; Status history.
- [ ] **D.1–D.4** CAR workflow: Save (DRAFT→RCCA), Process, Reverse, Approve, Reject; open by id and by code.
- [ ] **E.1** Delete CAR: Admin only (204); QE/Buyer get 403.
- [ ] **E.2** Buyer sees only CARs for assigned suppliers.
- [ ] **F** Optional API checks (if run).

**Day 7 (Week 2 Day 2) complete:** _________________  Date: ___________
