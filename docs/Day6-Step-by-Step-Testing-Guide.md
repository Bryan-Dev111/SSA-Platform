# Day 6 — Step-by-Step Testing Guide (Week 2 Day 1)

**Theme:** Audits and Findings CRUD  
**Use this guide to verify Day 6 is complete.** Run every section and check the expected results.

---

## Prerequisites

### 1. Database and seed

From the project root:

```powershell
cd E:\Sentinel-Supplier-Assurance-Platform\server
npx prisma migrate deploy
npx prisma db seed
```

You should see roles seeded and **Buyer assigned to SUP-TEST01**. Ensure `.env` in the project root has a valid `DATABASE_URL`.

### 2. Start backend and frontend

- **Terminal 1:** `cd E:\Sentinel-Supplier-Assurance-Platform\server` → `npm run dev`  
  - Expect: `Sentinel API listening on http://localhost:4000`
- **Terminal 2:** `cd E:\Sentinel-Supplier-Assurance-Platform\client` → `npm run dev`  
  - Expect: dev server on http://localhost:5173
- **Browser:** Open http://localhost:5173

### 3. Test users (from seed)

| Email                   | Password  | Role     | Notes                          |
|-------------------------|-----------|----------|--------------------------------|
| admin@sentinel.local    | Admin123! | Admin    | Full access; only role that can delete |
| viewer@sentinel.local   | Test123!  | Viewer   | View only; no set result / no create |
| qe@sentinel.local       | Test123!  | Quality Engineer | Can set audit result; can approve/reject findings |
| auditor@sentinel.local  | Test123!  | Auditor  | Can create findings; can view audits/findings |
| buyer@sentinel.local    | Test123!  | Buyer    | Sees only **SUP-TEST01** (assigned)  |
| supplier@sentinel.local | Test123!  | Supplier | Supplier portal only            |

---

## Part A — Audits

### A.1 Audits list and scope

| Step | Action | Expected |
|------|--------|----------|
| 1 | Log in as **admin@sentinel.local**. | Redirected to Dashboard (or default). |
| 2 | Click **Audits** in the sidebar. | Audits page loads. |
| 3 | Check the page. | You see: Supplier filter dropdown, “New audit” button, and a table with columns: Code, Supplier, Date, Type, Status, Result, Notes, Findings. If no audits yet, table shows “No audits in scope.” |
| 4 | Log in as **buyer@sentinel.local**. Open **Audits**. | Same layout. Supplier filter shows only **SUP-TEST01** (and “All”). If you create an audit for another supplier as Admin, that audit will **not** appear for Buyer. |
| 5 | Log in as **viewer@sentinel.local**. Open **Audits**. | Page loads; you can see the table. **No “New audit” button** is shown. **No Result dropdown** is available (read-only). |

**Pass / Fail:** _____

---

### A.2 Create an audit (Admin)

| Step | Action | Expected |
|------|--------|----------|
| 1 | Log in as **admin@sentinel.local**. Go to **Audits**. | — |
| 2 | Click **New audit**. | A form appears: Supplier *, Audit date *, Audit type, Notes. |
| 3 | Select **SUP-TEST01** (or any supplier), pick **today or a future date**, optionally select an audit type (if any exist), add a note. Click **Create audit**. | Form submits; new row appears in the table with Code **AUD-00001** (or next number), Status **Scheduled** or **In-Process** (if date = today), Result empty. |
| 4 | Create a second audit for the same or another supplier. | Second row with **AUD-00002**. |

**Pass / Fail:** _____

---

### A.3 Set audit result (Admin / QE only)

| Step | Action | Expected |
| 1 | On the Audits page as **Admin**, find an audit with no result (or Status “Overdue” / “In-Process”). | In the **Result** column you see a **dropdown** (—, Passed, Failed, Cancelled). |
| 2 | Select **Failed** (or Passed). | Row updates; **Status** becomes **Complete**; Result shows Failed (or Passed). |
| 3 | Log in as **qe@sentinel.local**. Open **Audits**. | You see the same dropdown and can set result on an audit. |
| 4 | Log in as **viewer@sentinel.local**. Open **Audits**. | The **Result** column is read-only (text only). If you try calling the API `PATCH /api/audits/:id` as Viewer, expect **403**. |
| 5 | As Admin, set one audit’s result to **Cancelled**. | Status shows **Cancelled**; result shows Cancelled. |

**Pass / Fail:** _____

---

### A.4 Derived status

| Step | Action | Expected |
|------|--------|----------|
| 1 | As Admin, create an audit with **date = today**. | Status = **In-Process** (until result is set). |
| 2 | Create an audit with **date in the past** and leave result empty. | Status = **Overdue**. |
| 3 | Create an audit with **date in the future**. | Status = **Scheduled**. |
| 4 | Set result to Passed or Failed. | Status = **Complete**. Set to Cancelled → **Cancelled**. |

**Pass / Fail:** _____

---

### A.5 Delete audit (Admin only)

| Step | Action | Expected |
|------|--------|----------|
| 1 | As **Admin**, call DELETE on an audit. DevTools **Console**: `const t = JSON.parse(localStorage.getItem('sentinel_auth')).token; fetch('/api/audits/REPLACE_WITH_AUDIT_ID', { method: 'DELETE', headers: { 'Authorization': 'Bearer ' + t } }).then(r=>console.log(r.status))` — replace `REPLACE_WITH_AUDIT_ID` with the audit’s **id** (cuid from the list response), not the code (AUD-00001). | Status **204**; audit disappears from list on refresh. |
| 2 | Log in as **qe@sentinel.local**. Try the same DELETE with QE’s token. | Status **403** “Only Admin can delete an audit”. |

**Pass / Fail:** _____

---

### A.6 Finding links from Audits (after Part B)

After you have at least one finding linked to an audit (see Part B), return to Audits:

| Step | Action | Expected |
|------|--------|----------|
| 1 | As Admin, open **Audits**. | In the **Findings** column, the audit row shows one or more **finding codes** (e.g. FIN-00001). |
| 2 | Click a finding code (e.g. **FIN-00001**). | You are taken to **Findings Record** with that finding loaded (URL has `?findingId=FIN-00001` or similar). |

**Pass / Fail:** _____

---

## Part B — Findings list

### B.1 Findings list and stats

| Step | Action | Expected |
|------|--------|----------|
| 1 | Log in as **admin@sentinel.local**. Click **Findings** in the sidebar. | Findings page loads. |
| 2 | Check the top of the page. | You see three stat cards: **Total (Critical/Major)**, **Open (Critical/Major)**, **Findings Waiting Approval**. Values can be 0 initially. |
| 3 | Check below the stats. | A **Supplier filter** dropdown, then a **“Top defect codes”** section (if any findings have defect codes), then a **table** with columns: Code, Supplier, Audit, Severity, Status, Summary, Updated. If no findings past DRAFT, table shows “No findings in scope (or none past DRAFT yet).” |
| 4 | Log in as **buyer@sentinel.local**. Open **Findings**. | Same layout; supplier filter shows only **SUP-TEST01**. Only findings for assigned suppliers appear. |

**Pass / Fail:** _____

---

## Part C — Findings Record (create and workflow)

### C.1 Create a draft finding (Admin / QE / Auditor)

| Step | Action | Expected |
|------|--------|----------|
| 1 | Log in as **admin@sentinel.local**. Click **Findings**, then click **New finding** (or go directly to **Findings Record** with no id/code in the URL). | Page title: **New Finding**. A form appears: Supplier *, Audit *, Severity *, Summary *, Discrepancy *, Defect Code, etc. |
| 2 | Select **Supplier** = SUP-TEST01. | **Audit** dropdown populates with audits for that supplier (e.g. AUD-00001). |
| 3 | Select an **Audit**, set **Severity** = Major, enter **Summary** and **Discrepancy**. Click **Create draft**. | Draft is created; page shows the finding with **Status: DRAFT** and code like **FIN-DRAFT-...** (temporary until Save). Form shows all fields: Summary, Defect Code, Discrepancy, Containment, Occurrence Root Cause, Escape Root Cause, Corrective Action, Verification of Effectiveness, Closing Comments. |
| 4 | Log in as **auditor@sentinel.local**. Open **Findings** → **New finding**. | Auditor can open the “New finding” form and create a draft (Admin, QE, Auditor can initiate). |
| 5 | Log in as **viewer@sentinel.local** (or Buyer). Open **Findings**. | **Viewer does not see “New finding”** button (read-only). Viewer can still open existing findings from the list. |

**Pass / Fail:** _____

---

### C.2 Save (DRAFT → Waiting Disposition)

| Step | Action | Expected |
|------|--------|----------|
| 1 | Open a **DRAFT** finding as Admin (or QE / Auditor). Ensure **Summary** and **Discrepancy** are filled. | You see a **Save (DRAFT → Waiting Disposition)** button. |
| 2 | Click **Save (DRAFT → Waiting Disposition)**. | Status changes to **Waiting Disposition**; **Code** updates to **FIN-00001** (or next number). Finding now appears in the **Findings list** table. |
| 3 | Try **Save** again. | Button is no longer shown (only for DRAFT). |

**Pass / Fail:** _____

---

### C.3 Process and Reverse

| Step | Action | Expected |
|------|--------|----------|
| 1 | With a finding in **Waiting Disposition**, click **Process**. | Status becomes **Waiting Approval**. |
| 2 | Click **Reverse**. | Status goes back to **Waiting Disposition**. |
| 3 | Click **Process** again to get to **Waiting Approval**. | — |
| 4 | In **Waiting Approval**, check buttons. | **Process** is not available (or not shown). Only **Approve** and **Reject** move the finding. |
| 5 | Click **Reverse** (if shown). | If Reverse is shown from Waiting Approval, status goes back to Waiting Disposition. **Reverse must never go back to DRAFT.** |

**Pass / Fail:** _____

---

### C.4 Approve / Reject (Admin / QE only)

| Step | Action | Expected |
|------|--------|----------|
| 1 | With a finding in **Waiting Approval**, log in as **admin@sentinel.local**. | You see **Approve** and **Reject** buttons. |
| 2 | Click **Approve**. | Status becomes **Closed**. Approve/Reject buttons disappear. |
| 3 | Open another finding and move it to **Waiting Approval** (Process from Waiting Disposition). Log in as **qe@sentinel.local**. | QE also sees **Approve** and **Reject** and can approve or reject. |
| 4 | Log in as **viewer@sentinel.local**. Open the same finding (in Waiting Approval). | **Approve** and **Reject** are **not** shown (Viewer cannot approve/reject). |
| 5 | With a finding in **Waiting Approval**, click **Reject**. | Status goes back to **Waiting Disposition**. |

**Pass / Fail:** _____

---

### C.5 Open Findings Record from list and from Audits

| Step | Action | Expected |
|------|--------|----------|
| 1 | On **Findings** list, click a finding **Code** (e.g. FIN-00001). | URL is `/findings-record?id=<cuid>`; Findings Record loads that finding. |
| 2 | On **Audits** page, in the **Findings** column click a finding code (e.g. FIN-00001). | URL is `/findings-record?findingId=FIN-00001`; same finding loads by code. |

**Pass / Fail:** _____

---

### C.6 Status history and form fields

| Step | Action | Expected |
|------|--------|----------|
| 1 | Open any finding. Scroll to **Status history**. | A table shows **Status**, **Created**, **Updated**. |
| 2 | Check the full form. | All fields present: Supplier, Audit #, Severity, Summary, Defect Code, Discrepancy, Containment, Occurrence Root Cause, Escape Root Cause, Corrective Action, Verification of Effectiveness, Closing Comments. For non-DRAFT, fields may be read-only except where allowed. |

**Pass / Fail:** _____

---

### C.7 Delete finding (Admin only)

| Step | Action | Expected |
|------|--------|----------|
| 1 | As **Admin**, in DevTools: `const t = JSON.parse(localStorage.getItem('sentinel_auth')).token; fetch('/api/findings/FINDING_ID', { method: 'DELETE', headers: { 'Authorization': 'Bearer ' + t } }).then(r=>console.log(r.status))` (replace FINDING_ID). | **204**; finding no longer appears in list. |
| 2 | As **QE**, same DELETE. | **403** “Only Admin can delete a finding”. |

**Pass / Fail:** _____

---

## Part D — Supplier filter and scope (Buyer)

| Step | Action | Expected |
|------|--------|----------|
| 1 | As **Admin**, create an audit for **SUP-TEST02** (if it exists in seed). Create a finding for that audit and Save so it appears in the list. | Audit and finding exist. |
| 2 | Log in as **buyer@sentinel.local**. Open **Audits**. Set supplier filter to **All**. | Only audits for **SUP-TEST01** appear (Buyer is assigned only to SUP-TEST01). Audit for SUP-TEST02 does **not** appear. |
| 3 | Open **Findings**. | Only findings for SUP-TEST01 appear. Stats and defect codes only reflect those findings. |
| 4 | As Buyer, try to open a finding for SUP-TEST02 by ID/code (if you know it). | **404** or “Finding not found” (scope enforced in API). |

**Pass / Fail:** _____

---

## Part E — Optional API checks (Console)

Use a valid Bearer token in `Authorization` for all requests.

| Test | Request | Expected |
|------|---------|----------|
| Audits list | `GET /api/audits` | 200; JSON array; each item has code, supplierId, auditDate, result, derivedStatus, findingCodes. |
| Audits list filtered | `GET /api/audits?supplierId=SUP_ID` | 200; only audits for that supplier (or 403/empty if out of scope). |
| Audit types | `GET /api/audits/types` | 200; JSON array of { id, code, name }. |
| Create audit | `POST /api/audits` body: `{ "supplierId": "...", "auditDate": "2026-03-25", "notes": "Test" }` | 201; created audit with code AUD-xxxxx. |
| Set result | `PATCH /api/audits/:id` body: `{ "result": "Passed" }` | 200 as Admin/QE; 403 as Viewer. |
| Findings list | `GET /api/findings` | 200; `{ list, stats, defectCodeCounts }`; list only non-DRAFT. |
| Finding by code | `GET /api/findings/by-code/FIN-00001` | 200 with finding; 404 if not found or out of scope. |
| Save finding | `POST /api/findings/:id/save` | 200; status = WaitingDisposition; code = FIN-00001 (or next). |
| Process | `POST /api/findings/:id/process` | 200; status moves forward. |
| Approve | `POST /api/findings/:id/approve` | 200 as Admin/QE when status = WaitingApproval; 403 as Viewer. |

---

## Sign-off checklist

- [ ] A.1–A.6 Audits: list, create, set result (Admin/QE), derived status, delete (Admin), finding links
- [ ] B.1 Findings list: stats, filter, table (and defect codes when present)
- [ ] C.1–C.7 Findings Record: create draft, Save, Process, Reverse, Approve/Reject, open by id/code, status history, delete (Admin)
- [ ] D Buyer scope: only assigned suppliers on Audits and Findings
- [ ] E Optional API checks (if run)

**Day 6 (Week 2 Day 1) complete:** _________________  Date: ___________
