# Day 1 — Acceptance Test Cases

**Purpose:** After finishing Day 1 tasks, use this document to verify that Day 1 is complete and aligned with the requirements.

**Day 1 exit criteria (from plan):** *Requirements and workflows agreed; data model and tech stack documented.*

---

## How to use this document

1. Complete all Day 1 tasks (1.1–1.5) and produce the five deliverables.
2. Run through each test case below.
3. For each case: **Pass** = requirement met; **Fail** = fix before signing off Day 1.
4. Sign off only when all test cases pass.

---

## Test Case 1: Requirement traceability checklist exists and is complete

| Step | Action | Pass? |
|------|--------|:-----:|
| 1.1 | Deliverable **Requirement Traceability Checklist** exists (e.g. `Day1-Requirement-Traceability-Checklist.md` or equivalent). | ☑ |
| 1.2 | Checklist lists **all 16 pages** by name (Dashboard, Risk, Corrective Actions, CAR Record, Findings, Findings Record, Audits, Supplier Profile, Supplier List, Suppliers Map, Records, Shipments, Documents, Internal Management, Admin, Log in). | ☑ |
| 1.3 | Checklist lists **all 6 roles** (Admin, Viewer, Quality Engineer, Auditor, Buyer, Supplier) with data scope and edit rules. | ☑ |
| 1.4 | **Findings Record** section includes all fields: Supplier, Audit #, Severity, Summary, Defect Code, Discrepancy, Containment, Occurrence Root Cause, Escape Root Cause, Corrective Action, Verification of Effectiveness, Closing Comments, approval/status history. | ☑ |
| 1.5 | **CAR Record** section includes all fields: Supplier, Audit #, Finding #, Severity, CAR Owner, Target Completion Date, Summary, Defect Code, Discrepancy, Containment, Occurrence Root Cause, Escape Root Cause, Corrective Action, Verification of Effectiveness, Closing Comments, approval/status history. | ☑ |
| 1.6 | **Findings workflow** rules are listed: status flow, required fields for Save, who initiates (Admin, QE, Auditor), who approves (Admin, QE), cannot reverse to Draft, Process/Reverse, greyed-out buttons. | ☑ |
| 1.7 | **CAR workflow** rules are listed: status flow, required fields for Save, who initiates (Admin, Buyer, QE), who approves (Admin, Buyer, QE), cannot reverse to Draft, Process/Reverse, greyed-out buttons. | ☑ |
| 1.8 | **Audit** rules: only Admin/QE set results; status logic (Cancelled, Complete, Scheduled, In-Process, Overdue). | ☑ |
| 1.9 | **Shipments**: two tables (inspection requests + schedule), Admin/QE record result, OTD, metrics (total, waiting, rejected, late, OTD, FPY). | ☑ |
| 1.10 | **Alerts**: all 6 categories listed; per-user on/off per category. | ☑ |
| 1.11 | **ID formats**: SUP-00001, AUD-00001, TYP-00, FIN-00001, CAR-00001. | ☑ |
| 1.12 | **Security**: RBAC, Supplier own data only, Buyer assigned only, Viewer view only, secure authentication. | ☑ |

**Result:** Pass = all steps 1.1–1.12 checked. Fail = complete missing items and re-run.

---

## Test Case 2: Workflow mapping exists and covers all flows

| Step | Action | Pass? |
|------|--------|:-----:|
| 2.1 | Deliverable **Workflow Mapping** exists (e.g. `Day1-Workflow-Mapping.md` or equivalent). | ☑ |
| 2.2 | **Flow 1 – Supplier lifecycle** is documented: Admin adds supplier, assigns to buyer(s), supplier sees only own profile, uploads records, requests shipment inspection. | ☑ |
| 2.3 | **Flow 2 – Audit → result → Findings** is documented: schedule audit, set result (Admin/QE), create findings for failed audit, finding workflow (Draft → … → Closed), audit table links to finding #s. | ☑ |
| 2.4 | **Flow 3 – Findings → CAR** is documented: CAR linked to Finding # and Audit #, severity from finding, CAR workflow (Draft → RCCA → … → Closed), approval by Admin/Buyer/QE. | ☑ |
| 2.5 | **Flow 4 – Shipment request → inspection** is documented: supplier requests inspection (PO, Part #, Qty, date), status Waiting inspection, Admin/QE record Passed/Failed, schedule table and OTD. | ☑ |
| 2.6 | **Flow 5 – Risk inputs → score** is documented: Admin configures weights, system computes score, Low/Medium/High, QE/Buyer add risk/opportunity, supplier filter for Buyer. | ☑ |
| 2.7 | **Records/Documents/Internal Management** are mentioned: Records = upload + approve/reject; Documents = view; Internal Management = Admin only. | ☑ |

**Result:** Pass = all steps 2.1–2.7 checked. Fail = add missing flows and re-run.

---

## Test Case 3: Role–page matrix is final and matches requirements

| Step | Action | Pass? |
|------|--------|:-----:|
| 3.1 | Deliverable **Role–Page Matrix (Final)** exists (e.g. `Day1-Role-Page-Matrix-Final.md` or equivalent). | ☑ |
| 3.2 | Matrix has **16 rows** (one per page) and **6 roles** (Admin, Viewer, QE, Auditor, Buyer, Supplier). | ☑ |
| 3.3 | **Viewer** has access (✓) to all pages except **Admin** and **Internal Management**. | ☑ |
| 3.4 | **Supplier** has access only to: Supplier Profile (own), Records (own), Shipments (own). No Dashboard, Risk, Corrective Actions, Findings, Audits, Supplier List, Suppliers Map, Documents. | ☑ |
| 3.5 | **Buyer** has access to Dashboard, Risk, Corrective Actions, CAR Record, Findings, Findings Record, Audits, Supplier Profile, Supplier List, Suppliers Map, Records, Shipments; and **no** access to Documents, Internal Management, Admin. | ☑ |
| 3.6 | **Auditor** has access to: CAR Record, Findings Record, Audits, Supplier Profile, Records (and Documents per requirements). No access to Dashboard, Risk, Corrective Actions, Findings, Supplier List, Suppliers Map, Shipments. | ☑ |
| 3.7 | **Documents** page: Admin, Viewer, QE, Auditor only (no Buyer). | ☑ |
| 3.8 | **Internal Management** and **Admin**: Admin only. | ☑ |
| 3.9 | Matrix includes a short rule that Buyer views are “filtered” (assigned suppliers only). | ☑ |

**Result:** Pass = all steps 3.1–3.9 checked. Fail = correct matrix and re-run.

---

## Test Case 4: Data model draft exists and is complete

| Step | Action | Pass? |
|------|--------|:-----:|
| 4.1 | Deliverable **Data Model Draft** exists (e.g. `Day1-Data-Model-Draft.md` or equivalent). | ☑ |
| 4.2 | Entities include: **Users**, **Roles**, **UserRoles**, **Suppliers**, **BuyerSuppliers**, **Audits**, **AuditTypes**, **Findings**, **CorrectiveActions**, **Shipments**, **ShipmentSchedule**, **Records**, **Documents**, **InternalDocs**, **RiskSnapshots**, **Opportunities**, **Alerts**, **UserAlertPreferences**. | ☑ |
| 4.3 | **Relationships** are described: Users–Roles (via UserRoles), Users–Buyer/Supplier, Suppliers–Buyers (BuyerSuppliers), Suppliers–Audits/Findings/CARs/Shipments/Records/RiskSnapshots, Audits–Findings, Findings–CorrectiveActions, Audits–CorrectiveActions, AuditTypes–Audits. | ☑ |
| 4.4 | **ID formats** are stated: SUP-00001 (Supplier), AUD-00001 (Audit), TYP-00 (Audit Type), FIN-00001 (Finding), CAR-00001 (CAR). | ☑ |
| 4.5 | No major entity required by the 16 pages or workflows is missing (e.g. no extra “Reports” or “Notifications” entity required for Day 1 scope). | ☑ |

**Result:** Pass = all steps 4.1–4.5 checked. Fail = add missing entities/relationships and re-run.

---

## Test Case 5: Tech stack is documented and decided

| Step | Action | Pass? |
|------|--------|:-----:|
| 5.1 | Deliverable **Tech Stack** exists (e.g. `Day1-Tech-Stack.md` or equivalent). | ☑ |
| 5.2 | **Frontend** is specified (e.g. React with Vite). | ☑ |
| 5.3 | **Backend** is specified (e.g. Node/Express or .NET Web API). | ☑ |
| 5.4 | **Database** is specified as PostgreSQL. | ☑ |
| 5.5 | **Authentication** approach is specified (e.g. JWT, password hashing). | ☑ |
| 5.6 | Deployment is at least outlined (where the app and DB will run). | ☑ |

**Result:** Pass = all steps 5.1–5.6 checked. Fail = document choices and re-run.

---

## Test Case 6: Day 1 exit criteria (overall)

| Step | Action | Pass? |
|------|--------|:-----:|
| 6.1 | All five deliverables are present in the repo (or agreed location). | ☑ |
| 6.2 | A reviewer (or you) can open the checklist and confirm every requirement area is covered. | ☑ |
| 6.3 | A reviewer can follow the workflow doc and see all five main flows and cross-cutting flows. | ☑ |
| 6.4 | The role–page matrix can be used in Day 4 to build the menu and route guards without re-reading the full requirements. | ☑ |
| 6.5 | The data model draft is sufficient for Day 2 to start the full database schema design. | ☑ |
| 6.6 | The tech stack is sufficient for Day 2 to create the repo structure and Day 3 to implement auth. | ☑ |

**Result:** Pass = all steps 6.1–6.6 checked.

---

## Day 1 sign-off

| Criterion | Result |
|-----------|--------|
| Test Case 1 (Requirement checklist) | ☑ Pass |
| Test Case 2 (Workflow mapping) | ☑ Pass |
| Test Case 3 (Role–page matrix) | ☑ Pass |
| Test Case 4 (Data model draft) | ☑ Pass |
| Test Case 5 (Tech stack) | ☑ Pass |
| Test Case 6 (Exit criteria overall) | ☑ Pass |

**Day 1 complete:** All six test cases **Pass** and signed off.

**Verified by:** Cursor (automated check) **Date:** March 16, 2026

---

*If any case fails, fix the corresponding deliverable and re-run that test case until it passes.*
