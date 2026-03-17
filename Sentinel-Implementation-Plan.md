# Sentinel Supplier Assurance Platform
## Complete Implementation Plan (Requirements-Based)

**Project:** Sentinel Supplier Assurance Platform  
**Source:** Sentinel Supplier Assurance Platform Requirements 12MAR2026 (Functional Requirements Specification)  
**Duration:** 3 weeks (15 working days)  
**Schedule:** March 16, 2026 – April 3, 2026  
**Budget:** $2,000 (Week 1: $700 | Week 2: $700 | Week 3: $600)

---

## Part 1: Requirements Foundation

### 1.1 Project Overview

The **Sentinel Supplier Assurance Platform** is a supplier oversight and risk management system for monitoring overseas manufacturing suppliers. It provides:

- Manage suppliers and assign buyers
- Schedule and track audits; record results (Passed/Failed/Cancelled)
- Create and log findings; link findings to audits
- Create and track corrective actions (CARs); link CARs to findings and audits
- Monitor shipment readiness (inspection requests + schedule; OTD, FPY)
- Track supplier risk (weighted score: Low / Medium / High)
- Manage documentation (Documents = policies/procedures; Records = uploads from suppliers/auditors)
- Internal Management for sensitive documents (contracts, SOW) — Admin only
- Control user roles and permissions; secure authentication

**Primary users:** Admin, Quality Engineers, Buyers, Suppliers, Auditors; **Viewer** role for read-only access (e.g. demos).

---

### 1.2 Roles and Data Scope

| Role | Type | Data scope | Edit capability |
|------|------|------------|------------------|
| **Admin** | Internal | All data | Full; only role that can delete (Finding, Audit, CAR, Risk, Opportunity, Supplier) |
| **Viewer** | Internal | All data (all pages except Admin, Internal Management) | None — view only |
| **Quality Engineer** | Internal | All relevant data | Per page matrix; can approve Findings and CARs; set audit results; approve Records |
| **Auditor** | Internal | All relevant data | Can create Findings; view CAR/Finding records; upload Records |
| **Buyer** | External | **Assigned suppliers only** on every page | Per page matrix; can approve CARs; add risk/opportunity |
| **Supplier** | External | **Own data only** | Supplier Profile only: view metrics/tables; upload Records; request Shipment inspection |

**Rules:**

- **Buyers** see only suppliers assigned to them on Dashboard, Risk, Corrective Actions, Findings, Audits, Supplier List/Profile, Suppliers Map, Records, Shipments.
- **Suppliers** see only **Supplier Profile** (own metrics, audits, CARs, findings, risk history, records) and can: (1) upload Records, (2) request Shipment inspection (PO, Part Number, Qty, Inspection date → status “Waiting inspection”). Suppliers also see **Records** (own) and **Shipments** (own) where applicable.
- **Viewers** can view all pages except Admin and Internal Management; no create/edit/delete anywhere.

---

### 1.3 Page and Role Matrix (16 Pages)

| # | Page | Admin | Viewer | Quality Engineer | Auditor | Buyer | Supplier |
|---|------|:-----:|:-----:|:----------------:|:-------:|:-----:|:--------:|
| 1 | **Dashboard** | ✓ | ✓ | ✓ | — | ✓ (filtered) | — |
| 2 | **Risk** | ✓ | ✓ | ✓ | — | ✓ (filtered) | — |
| 3 | **Corrective Actions** | ✓ | ✓ | ✓ | — | ✓ (filtered) | — |
| 4 | **CAR Record** | ✓ | ✓ | ✓ | ✓ | ✓ (filtered) | — |
| 5 | **Findings** | ✓ | ✓ | ✓ | — | ✓ (filtered) | — |
| 6 | **Findings Record** | ✓ | ✓ | ✓ | ✓ | ✓ (filtered) | — |
| 7 | **Audits** | ✓ | ✓ | ✓ | ✓ | ✓ (filtered) | — |
| 8 | **Supplier Profile** | ✓ | ✓ | ✓ | ✓ | ✓ (filtered) | ✓ (own only) |
| 9 | **Supplier List** | ✓ | ✓ | ✓ | — | ✓ (filtered) | — |
| 10 | **Suppliers Map** | ✓ | ✓ | ✓ | — | ✓ (filtered) | — |
| 11 | **Records** | ✓ | ✓ | ✓ | ✓ | ✓ (filtered) | ✓ (own) |
| 12 | **Shipments** | ✓ | ✓ | ✓ | — | ✓ (filtered) | ✓ (own) |
| 13 | **Documents** | ✓ | ✓ | ✓ | ✓ | — | — |
| 14 | **Internal Management** | ✓ | — | — | — | — | — |
| 15 | **Admin** | ✓ | — | — | — | — | — |
| 16 | **Log in** | All | All | All | All | All | All |

**Notes:**

- **Filtered** = Buyer sees only data for assigned suppliers; all stats, charts, and tables on that page respect the supplier filter.
- **Viewer** = Can view all pages except Admin and Internal Management; no create/edit/delete (per requirements: “view all pages but not be able to edit”).
- **Supplier** has no Dashboard; lands on Supplier Profile; can access own Records and Shipments as per requirements.
- **Auditor** = Access only where required: CAR Record, Findings Record, Audits, Supplier Profile, Records (not Dashboard, Risk, Corrective Actions, Findings, Supplier List, Suppliers Map, Shipments).
- **Documents** = Admin, Quality Engineer, Auditor (no Buyer per requirements); Viewer included for “view all” pages.

---

### 1.4 Terminology

- **Records:** Uploads from **Suppliers** and **Auditors** (filled-out records). Table: internal/supplier, name, supplier, status (pending/approved/rejected). Approve/Reject by **Admin** and **Quality Engineer** only. Stored and shown on **Records** page.
- **Documents:** Policies, procedures, work instructions, command media. Table: document number, name, category, view button. Types: Procedure, Policy, Standard Operating Procedure, Work Instruction, Form. **Documents** page.
- **Internal Management:** Sensitive company documents (e.g. contracts, SOW with suppliers/buyers). Admin-only; table: document name, category, view.

---

### 1.5 Findings Workflow and Fields

**Status flow:**  
**DRAFT** → **Waiting Disposition** → **Waiting Approval** → **Closed**

**Required to move from DRAFT to Waiting Disposition (Save):**  
Supplier, Audit #, Severity, Summary, Discrepancy.

**Who can initiate a Finding:** Admin, Quality Engineer, Auditor.

**Who can approve/reject (Waiting Approval):** Admin, Quality Engineer only.

**Severity:** Critical | Major | Minor.

**Full input fields (Findings Record):**  
Supplier, Audit #, Severity, Summary, Defect Code, Discrepancy, Containment, Occurrence Root Cause, Escape Root Cause, Corrective Action, Verification of Effectiveness, Closing Comments.  
Plus: approval and status history table.

**Rules:**

- Save button: sends DRAFT → Waiting Disposition (only when required fields are filled).
- Process: moves forward one status; Reverse: moves back one status.
- **Cannot** reverse back to DRAFT.
- In Waiting Approval, only Approve/Reject buttons move the Finding forward/backward.
- Buttons are greyed out until available for the current state and role.
- Once status is Waiting Disposition or beyond, the finding appears in the Findings list table.

**Findings page (list):**  
Top: Total findings (Critical/Major), Open findings (Critical/Major), Findings Waiting Approval.  
Then: Charts/graphs (e.g. top defect codes).  
Then: Table of findings.  
Supplier filter at top for Buyers.

---

### 1.6 CAR Workflow and Fields

**Status flow:**  
**DRAFT** → **RCCA** → **Waiting Approval** → **Follow-Up** → **Closed**

**Required to move from DRAFT to RCCA (Save):**  
Supplier, Audit #, Finding #, Severity (auto-populate from linked Finding when chosen), Summary, Discrepancy.

**Who can initiate a CAR:** Admin, Buyer, Quality Engineer.

**Who can approve/reject (Waiting Approval):** Admin, Buyer, Quality Engineer.

**Full input fields (CAR Record):**  
Supplier, Audit #, Finding #, Severity, CAR Owner, Target Completion Date, Summary, Defect Code, Discrepancy, Containment, Occurrence Root Cause, Escape Root Cause, Corrective Action, Verification of Effectiveness, Closing Comments.  
Plus: approval and status history table.

**Rules:**

- Save button: sends DRAFT → RCCA (only when required fields are filled).
- Process: moves forward; Reverse: moves back.
- **Cannot** reverse back to DRAFT.
- In Waiting Approval, only Approve/Reject buttons move the CAR forward/backward.
- Buttons greyed out until available.
- Once status is RCCA or beyond, the CAR appears in the Corrective Actions table.

**Corrective Actions page (list):**  
Top: Open CARs, Overdue CARs, CARs Waiting Approval, AVG Closure Time.  
Then: Charts/graphs.  
Then: Table of CARs.  
Supplier filter at top for Buyers.  
Clicking a CAR opens CAR Record page.

---

### 1.7 Audits

**Results (set by Admin, Quality Engineer only):** Passed | Failed | Cancelled.

**Status logic (derived):**

- If result = Cancelled → Status = **Cancelled**
- If result = Passed or Failed → Status = **Complete**
- If audit_date > today → **Scheduled**
- If audit_date = today → **In-Process**
- If audit_date < today and result empty → **Overdue**

**Table:** Schedule of audits; columns include results, notes. Supplier filter for Buyers.  
**Link to Findings:** Audit table shows finding numbers linked to that audit; each finding # is clickable and opens the Findings Record page.

---

### 1.8 Shipments

**Two concepts:**

1. **Inspection requests (from Supplier):** Supplier chooses PO, Part Number, enters Qty and Inspection date → status **Waiting inspection**. Alerts go out for inspection requests.
2. **Schedule table:** Populated by Admin (load shipment information). Used for OTD calculation.

**When inspection is done:** Admin or Quality Engineer records result **Passed** or **Failed**.

**Metrics (top of Shipments page):** Total shipments, Waiting inspection, Rejected, Late shipments, OTD, FPY (First Pass Yield).

**OTD:** Calculated by comparing quantities and dates between the schedule table and the shipment (inspection) table.

**Shipments page:** Two tables — (1) Inspection requests from suppliers, (2) Schedule (admin-loaded).

---

### 1.9 Risk

**Score:** Weighted categories, e.g. Quality performance, Audit performance, Delivery performance, CAR closure performance, Documentation compliance.  
**Output levels:** Low | Medium | High.  
**Admin** can adjust weight percentages (Admin config).

**Risk page:**  
Top: Risk score, # open risks, mitigated risks, open opportunities.  
Risk distribution, top risk suppliers, table of risks, table of opportunities.  
Inputs for Quality Engineers/Buyers to add risks and opportunities.  
Charts: e.g. top risk drivers.  
Supplier filter for Buyers.  
Risk level shown on Supplier List and Supplier Profile.

---

### 1.10 Dashboard

**Top metrics:** Total suppliers, High-risk suppliers, Open/overdue CARs, Open findings (how many Major/Critical), Shipments on hold, Rejected document count.

**Charts/graphs:** Top risk suppliers, Upcoming events (shipments ready for inspection, audits upcoming), Monthly trends.

Supplier filter for Buyers.

---

### 1.11 Alerts

**System alerts for:**

- Overdue audits
- Major/Critical findings
- Open CARs past due
- Shipment inspection requests
- Rejected shipments / Rejected documents
- Shipments past due

**Per-user preferences:** Each user can turn on/off (e.g. email) alerts **per category**. Not Admin-controlled; individual preference. Store in `user_alert_preferences`.

---

### 1.12 Security

- Role-based access control (RBAC).
- Supplier: limited to own data.
- Buyer: limited to assigned suppliers.
- Viewer: view only; no create/edit/delete.
- Secure authentication (e.g. JWT, password hashing).

---

### 1.13 ID Format Requirements

| Entity | Format | Example |
|--------|--------|---------|
| Supplier | SUP-00001 | SUP-00001 |
| Audit | AUD-00001 | AUD-00001 |
| Audit Type | TYP-00 | TYP-00 |
| Finding | FIN-00001 | FIN-00001 |
| CAR | CAR-00001 | CAR-00001 |

---

### 1.14 Admin Configuration (Admin Page)

Admin can:

- Manage **Roles**
- **Commodity Types** (CRUD)
- **Defect Codes** (used in Findings and CARs)
- **Disposition Codes** (for Findings)
- **Audit Types** (TYP-00)
- **Add/remove Buyers** and **Suppliers**; assign suppliers to buyers
- **Adjust permissions** (which roles can see which pages)
- **Adjust weight percentages** for risk score
- **Load audits** into schedule
- **Load shipment information** (populates Schedule table on Shipments page)

**Admin-only delete:** Only Admin can delete any record: Finding, Audit, CAR, Risk, Opportunity, Supplier.

---

## Part 2: Weekly Milestones

### Week 1 — Architecture and System Foundation  
**Budget: $700**  
**Goal:** Requirements locked, architecture defined, database and auth in place, core app shell and navigation.

**Scope:**

- Requirement review and workflow mapping; role–page matrix; data model; tech stack.
- System architecture: frontend (e.g. React), backend (REST API), PostgreSQL.
- Database schema: Users, Roles, UserRoles, Suppliers, BuyerSuppliers, Audits, AuditTypes, Findings, CorrectiveActions, Shipments, ShipmentSchedule, Records, Documents, InternalDocs, RiskSnapshots, Opportunities, Alerts, UserAlertPreferences; ID formats SUP-, AUD-, TYP-, FIN-, CAR-.
- Authentication and RBAC: login, role-based access, Buyer = assigned suppliers only, Supplier = own data only, Viewer = read-only.
- App shell: router, layout, role-based menu, route guards, placeholder pages for all 16 pages, Login (Sentinel symbol).

**Exit criteria:** Database created and migrated; login works; role-based menu and route guards in place; all main pages exist as shells and are reachable by correct roles.

---

### Week 2 — Core Business Workflows  
**Budget: $700**  
**Goal:** All main workflows implemented and configurable.

**Scope:**

- **Audits:** CRUD, schedule, results (Passed/Failed/Cancelled), derived status, link to Findings (finding #s in audit table, clickable to Findings Record); only Admin/QE set results.
- **Findings:** CRUD, full workflow and fields (including Occurrence/Escape Root Cause), required-field validation, Process/Reverse, approval by Admin/QE only; Findings list and Findings Record UI.
- **CARs:** CRUD, full workflow and fields (including Occurrence/Escape Root Cause, CAR Owner, Target Completion Date), required-field validation, Process/Reverse, approval by Admin/Buyer/QE; link to Finding and Audit; Corrective Actions list and CAR Record UI.
- **Admin config:** Commodity Types, Defect Codes, Disposition Codes, Audit Types (TYP-00), Risk weights, Buyers/Suppliers and assignment, permissions; Admin-only delete rules.
- **Supplier Profile (Supplier view):** Metrics (e.g. Assigned buyer), tables (audits, CARs, findings, risk history, records); upload Records; request Shipment inspection (PO, Part Number, Qty, Inspection date).
- **Shipments:** Inspection requests API/UI; Schedule table (Admin load); record result Passed/Failed; metrics (total, waiting, rejected, late, OTD, FPY).
- **Records:** Upload (Supplier/Auditor); table (internal/supplier, name, supplier, status); Admin/QE approve/reject; Buyer filtered to assigned suppliers.
- **Documents:** Table (document number, name, category, view); types Procedure, Policy, SOP, Work Instruction, Form.
- **Internal Management:** Admin-only; upload/retrieve; name, category, view.

**Exit criteria:** End-to-end flows for Audits, Findings, CARs, Shipments, Records, Documents; Supplier and Buyer see correct data; Admin config and delete rules working.

---

### Week 3 — Analytics, Alerts, and Final Delivery  
**Budget: $600**  
**Goal:** Risk scoring, dashboard, Suppliers Map, alerts, testing, and handover.

**Scope:**

- **Risk:** Calculation from weighted categories; Low/Medium/High; Risk page (stats, distribution, top risk suppliers, risks/opportunities tables and inputs); risk on Supplier List and Profile; supplier filter for Buyers.
- **Dashboard:** Metrics and charts per requirements; supplier filter.
- **Suppliers Map:** Map with supplier locations; icons by risk (red/orange/yellow/green); access per matrix.
- **Alerts:** Triggers for all six categories; per-user on/off per category; delivery (in-app and optionally email).
- **Testing:** Workflows, permissions (Viewer read-only, Buyer/Supplier scope, Admin delete), Shipments/OTD, UI/UX (greyed buttons, validation).
- **Delivery:** Source code, deployment config, DB schema, README/runbook, handover notes (limitations, next steps e.g. AI enhancements).

**Exit criteria:** Risk and dashboard correct; alerts firing and configurable; testing signed off; deliverables packaged.

---

## Part 3: Detailed Daily Plan

**Calendar:** 15 working days (Mon–Fri), March 16 – April 3, 2026.

---

### Week 1 — Architecture and System Foundation

#### Day 1 — Monday, March 16, 2026  
**Theme:** Requirement lock-down and workflow mapping

| # | Task | Details | Deliverable |
|---|------|---------|-------------|
| 1.1 | Requirement checklist | List every page, role, field, and rule from the Requirements doc | Requirement traceability checklist |
| 1.2 | Workflow mapping | End-to-end: Supplier lifecycle; Audit schedule → result → Findings; Findings → CAR; Shipment request → inspection; Risk inputs → score | Workflow diagram or doc |
| 1.3 | Role–page matrix (final) | Table: which role can view/edit each of the 16 pages; Viewer read-only; Buyer/Supplier scope | Role–page matrix (final) |
| 1.4 | Data model draft | Entities: Users, Roles, UserRoles, Suppliers, BuyerSuppliers, Audits, AuditTypes, Findings, CorrectiveActions, Shipments, ShipmentSchedule, Records, Documents, InternalDocs, RiskSnapshots, Opportunities, Alerts, UserAlertPreferences; main relationships | Entity list and relationships |
| 1.5 | Tech stack | Frontend (e.g. React), backend (e.g. Node/Express or .NET), PostgreSQL, auth (e.g. JWT) | One-page tech stack doc |

**End of day:** Requirements and workflows agreed; data model and tech stack documented.

---

#### Day 2 — Tuesday, March 17, 2026  
**Theme:** Architecture and database schema

| # | Task | Details | Deliverable |
|---|------|---------|-------------|
| 2.1 | Architecture document | Frontend (pages/components), Backend (API, workflow, risk service, alerts), DB layer; deployment outline | Architecture doc/diagram |
| 2.2 | Database schema design | Full schema: all tables, FKs, indexes; tables for users, roles, user_roles, suppliers, buyer_suppliers, audits, audit_types, findings, corrective_actions, shipments, shipment_schedule, records, documents, internal_docs, risk_snapshots, opportunities, alerts, user_alert_preferences | Schema ERD and table list |
| 2.3 | ID format spec | SUP-00001, AUD-00001, TYP-00, FIN-00001, CAR-00001; sequence/implementation | ID format spec |
| 2.4 | Repo and project structure | Backend and frontend folders; package manager; .gitignore; env template | Repo with initial structure |
| 2.5 | Database setup | PostgreSQL; create database; run first migration (users, roles, suppliers, etc.) | DB created; first migration |

**End of day:** Architecture and schema documented; repo and DB started.

---

#### Day 3 — Wednesday, March 18, 2026  
**Theme:** Database completion and authentication

| # | Task | Details | Deliverable |
|---|------|---------|-------------|
| 3.1 | Remaining migrations | audits, audit_types, findings, corrective_actions, shipments, shipment_schedule, records, documents, internal_docs, risk_snapshots, opportunities, alerts, user_alert_preferences | All tables created |
| 3.2 | Seed data | Roles: Admin, Viewer, Quality Engineer, Auditor, Buyer, Supplier; optional seed Admin user | Roles and optional admin |
| 3.3 | Auth API | Register/login; password hashing; JWT issue and validation | Login/register working |
| 3.4 | Role middleware | Attach user and role(s) to request; RBAC helpers (e.g. requireRole, requirePageAccess) | Middleware and helpers |
| 3.5 | Buyer/Supplier scope | Helpers: assigned supplier IDs for Buyer; current user’s supplier for Supplier; apply in sample endpoints | Scope helpers in use |

**End of day:** DB complete; auth and RBAC and scope logic in place.

---

#### Day 4 — Thursday, March 19, 2026  
**Theme:** Core application layout and navigation

| # | Task | Details | Deliverable |
|---|------|---------|-------------|
| 4.1 | Frontend app shell | Router, layout (sidebar/header), theme; protected route wrapper (auth check) | App shell with router |
| 4.2 | Navigation and menu | Menu items per role from matrix; Viewer sees allowed pages with no create/edit buttons; Buyer/Supplier see only allowed items | Role-based menu |
| 4.3 | Route guards | Guard each route by role; Buyer: assigned suppliers; Supplier: redirect to Profile (and own Records/Shipments only) | Route guards |
| 4.4 | Placeholder pages | Skeleton pages: Dashboard, Risk, Corrective Actions, CAR Record, Findings, Findings Record, Audits, Supplier Profile, Supplier List, Suppliers Map, Records, Shipments, Documents, Internal Management, Admin, Login | All pages exist and reachable by correct roles |
| 4.5 | Login page | Login form; Sentinel symbol; call auth API; store token and user; redirect by role | Working login flow |

**End of day:** User can log in and see role-appropriate menu and placeholder pages.

---

#### Day 5 — Friday, March 20, 2026  
**Theme:** Week 1 wrap-up and API foundations

| # | Task | Details | Deliverable |
|---|------|---------|-------------|
| 5.1 | Core API structure | REST conventions; error handling; attach user/role to requests | API base ready |
| 5.2 | Users and profile API | Get current user; list users (Admin); link user to Buyer/Supplier where applicable | User endpoints |
| 5.3 | Suppliers API (read) | List suppliers (Admin: all; Buyer: assigned; Supplier: self); get one supplier; enforce scope in backend | Suppliers list and detail |
| 5.4 | Week 1 testing | Manual: login as different roles; menu and page access; one API with Buyer scope | Test notes |
| 5.5 | Week 1 report | Completed tasks; risks/blockers; plan for Week 2 Day 1 | Week 1 report |

**End of day:** Week 1 complete; APIs started; ready for Week 2.

---

### Week 2 — Core Business Workflows

#### Day 6 — Monday, March 23, 2026  
**Theme:** Audits and Findings CRUD

| # | Task | Details | Deliverable |
|---|------|---------|-------------|
| 6.1 | Audits API | CRUD; schedule (date, notes); results Passed/Failed/Cancelled; derived status (Scheduled/In-Process/Overdue/Complete/Cancelled); filter by supplier (Buyer) | Audits CRUD and list |
| 6.2 | Audits UI | Table (schedule, results, notes); only Admin/QE set result; column/link for finding #s (clickable → Findings Record) | Audits page functional |
| 6.3 | Findings API | CRUD; status flow; required fields (Supplier, Audit #, Severity, Summary, Discrepancy); Process/Reverse; approval (Admin, QE only) | Findings API with workflow |
| 6.4 | Findings list UI | Top stats (total, Critical/Major, Waiting Approval); charts (e.g. top defect codes); table; supplier filter | Findings page (list) |
| 6.5 | Findings Record UI (start) | Form: Supplier, Audit #, Severity, Summary, Defect Code, Discrepancy, Containment, Occurrence Root Cause, Escape Root Cause, Corrective Action, Verification of Effectiveness, Closing Comments; approval/status history table | Findings Record form shell |

**End of day:** Audits and Findings backend and list; Findings Record form in progress.

---

#### Day 7 — Tuesday, March 24, 2026  
**Theme:** Findings workflow and CAR CRUD

| # | Task | Details | Deliverable |
|---|------|---------|-------------|
| 7.1 | Findings workflow logic | Save (Draft → Waiting Disposition) validation; Process/Reverse; Approve/Reject in Waiting Approval; grey-out buttons by state/role | Findings workflow complete |
| 7.2 | Findings Record UI complete | Severity dropdown (Critical/Major/Minor); Defect Code from config; link to audit; status history; open from Findings list by Finding # | Findings Record complete |
| 7.3 | CARs API | CRUD; status flow; required fields (Supplier, Audit #, Finding #, Severity, Summary, Discrepancy); Process/Reverse; approval (Admin, Buyer, QE); link to Finding and Audit | CARs API with workflow |
| 7.4 | CAR list UI | Top stats (Open, Overdue, Waiting Approval, AVG Closure Time); charts; table; supplier filter | Corrective Actions page |
| 7.5 | CAR Record UI (start) | Form: Supplier, Audit #, Finding #, Severity (auto from Finding), CAR Owner, Target Completion Date, Summary, Defect Code, Discrepancy, Containment, Occurrence Root Cause, Escape Root Cause, Corrective Action, Verification of Effectiveness, Closing Comments; status history | CAR Record form shell |

**End of day:** Findings end-to-end; CARs API and list; CAR Record form started.

---

#### Day 8 — Wednesday, March 25, 2026  
**Theme:** CAR workflow and Admin configuration (codes)

| # | Task | Details | Deliverable |
|---|------|---------|-------------|
| 8.1 | CAR workflow logic | Save (Draft → RCCA) validation; Process/Reverse; Approve/Reject in Waiting Approval; grey-out by state/role; no reverse to Draft | CAR workflow complete |
| 8.2 | CAR Record UI complete | All fields; link to Finding; approval/status history; open from Corrective Actions by CAR # | CAR Record page complete |
| 8.3 | Admin: Commodity Types | CRUD; used in supplier classification | Commodity Types config |
| 8.4 | Admin: Defect Codes | CRUD; used in Findings and CARs | Defect Codes config |
| 8.5 | Admin: Disposition Codes | CRUD; used in Findings workflow | Disposition Codes config |

**End of day:** CAR flow complete; Admin config for Commodity, Defect, Disposition.

---

#### Day 9 — Thursday, March 26, 2026  
**Theme:** Admin config, Supplier portal, Shipments

| # | Task | Details | Deliverable |
|---|------|---------|-------------|
| 9.1 | Admin: Audit Types | CRUD Audit Types (TYP-00); link to Audits if needed | Audit Types config |
| 9.2 | Admin: Risk weights | Configure weight % for risk categories; save for risk calc | Risk weight config |
| 9.3 | Admin: Buyers & Suppliers | Add/edit Buyers and Suppliers; assign suppliers to buyers | Buyer/Supplier management |
| 9.4 | Admin: Permissions & delete | Which roles see which pages; Admin-only delete (Finding, Audit, CAR, Risk, Opportunity, Supplier) | Permission and delete rules |
| 9.5 | Supplier Profile (supplier view) | Metrics (e.g. Assigned buyer); tables: audits, CARs, findings, risk history, records; upload Records; request Shipment inspection (PO, Part #, Qty, Inspection date) | Supplier Profile actions |

**End of day:** Admin config largely complete; Supplier can upload records and request inspection.

---

#### Day 10 — Friday, March 27, 2026  
**Theme:** Shipments, Records, Documents, Internal Management

| # | Task | Details | Deliverable |
|---|------|---------|-------------|
| 10.1 | Shipments API | Inspection requests (PO, Part #, Qty, date, status); Schedule table (Admin load); record result Passed/Failed; OTD vs schedule | Shipments API and OTD |
| 10.2 | Shipments UI | Two tables: inspection requests, schedule; metrics (total, waiting, rejected, late, OTD, FPY); Admin/QE record result | Shipments page |
| 10.3 | Records API & UI | Upload (Supplier/Auditor); table: internal/supplier, name, supplier, status (pending/approved/rejected); Admin/QE approve/reject; Buyer: assigned suppliers only | Records page |
| 10.4 | Documents API & UI | Document number, name, category, view; types: Procedure, Policy, SOP, Work Instruction, Form | Documents page |
| 10.5 | Internal Management | Admin-only; upload/retrieve; name, category, view (e.g. contracts, SOW) | Internal Management page |

**End of day:** Shipments, Records, Documents, Internal Management done; Week 2 core workflows complete.

---

### Week 3 — Analytics, Alerts, and Final Delivery

#### Day 11 — Monday, March 30, 2026  
**Theme:** Risk calculation and Risk page

| # | Task | Details | Deliverable |
|---|------|---------|-------------|
| 11.1 | Risk calculation service | Weights from Admin config; compute from quality, audit, delivery, CAR closure, documentation; classify Low/Medium/High; store snapshot if needed | Risk calculation logic |
| 11.2 | Risk API | Get risk score/level per supplier; list risk snapshots; create/update risk and opportunity (QE/Buyer) | Risk endpoints |
| 11.3 | Risk page UI | Stats (risk score, open risks, mitigated, opportunities); distribution; top risk suppliers; tables: risks, opportunities; inputs for add risk/opportunity; supplier filter | Risk page |
| 11.4 | Risk on list and profile | Risk level on Supplier List and Supplier Profile | Risk displayed where needed |

**End of day:** Risk scoring and Risk page complete.

---

#### Day 12 — Tuesday, March 31, 2026  
**Theme:** Dashboard and Suppliers Map

| # | Task | Details | Deliverable |
|---|------|---------|-------------|
| 12.1 | Dashboard API | Metrics: total suppliers, high-risk count, open/overdue CARs, open findings (Major/Critical), shipments on hold, rejected documents; charts data (top risk, upcoming events, monthly trends) | Dashboard API |
| 12.2 | Dashboard UI | Top metrics; charts (top risk suppliers, upcoming audits/shipments, trends); supplier filter | Dashboard page |
| 12.3 | Suppliers Map | Map with supplier locations; icon color by risk (red/orange/yellow/green); access per matrix | Suppliers Map page |
| 12.4 | Navigation check | All pages accessible per role per matrix | Final menu check |

**End of day:** Dashboard and Suppliers Map done; navigation verified.

---

#### Day 13 — Wednesday, April 1, 2026  
**Theme:** Alerts and user preferences

| # | Task | Details | Deliverable |
|---|------|---------|-------------|
| 13.1 | Alert triggers | Create alerts: overdue audit, major/critical finding, overdue CAR, shipment inspection request, rejected shipment/document, late shipment | Alert generation logic |
| 13.2 | User alert preferences | Per-user on/off per category; store in user_alert_preferences | Alert preferences API |
| 13.3 | Alert delivery | In-app (e.g. dashboard widget/list); optional email per preferences | Alerts visible and (optional) email |
| 13.4 | Admin: load data | Admin load audits into schedule; load shipment schedule; document in Admin UI | Admin load audits/shipments |

**End of day:** Alerts implemented and configurable per user.

---

#### Day 14 — Thursday, April 2, 2026  
**Theme:** Testing and bug fixes

| # | Task | Details | Deliverable |
|---|------|---------|-------------|
| 14.1 | Workflow testing | E2E: Audit → fail → Findings → CAR → Closed; Shipment request → inspect → Pass/Fail | Test report (workflows) |
| 14.2 | Permission testing | Viewer read-only; Buyer assigned only; Supplier own only; Admin-only delete | Test report (permissions) |
| 14.3 | Shipment and OTD | Schedule vs shipment; OTD calculation; FPY | Test report (shipments) |
| 14.4 | UI/UX pass | Greyed buttons; required validation; error messages; navigation | Bug list and fixes |
| 14.5 | Fix critical/high bugs | Address issues from testing | Patched build |

**End of day:** Test report and critical issues resolved.

---

#### Day 15 — Friday, April 3, 2026  
**Theme:** Final validation and delivery

| # | Task | Details | Deliverable |
|---|------|---------|-------------|
| 15.1 | Final regression | Smoke test all main flows and roles | Sign-off checklist |
| 15.2 | Deployment prep | Deployment config; environment variables; DB migration runbook | Deployment package |
| 15.3 | Deliverables package | Source (frontend + backend); DB schema (migrations/export); README (setup and run) | Final delivery |
| 15.4 | Handover notes | Known limitations; next steps (e.g. AI: predict risk, audit trends, defect classification, CAR escalation) | Handover document |
| 15.5 | Project closure | Final report; payment reminder; thank you | Closure report |

**End of day:** Project delivered; documentation and code handed over.

---

## Part 4: Quick Reference

### Daily focus

| Day | Date | Focus |
|-----|------|--------|
| 1 | Mar 16 | Requirements & workflow mapping |
| 2 | Mar 17 | Architecture, schema, repo, DB start |
| 3 | Mar 18 | DB complete, auth, RBAC, scope |
| 4 | Mar 19 | App shell, navigation, placeholder pages, login |
| 5 | Mar 20 | API base, suppliers API, Week 1 wrap |
| 6 | Mar 23 | Audits, Findings API & list, Findings Record start |
| 7 | Mar 24 | Findings workflow, CARs API & list, CAR Record start |
| 8 | Mar 25 | CAR workflow, Admin: Commodity, Defect, Disposition |
| 9 | Mar 26 | Admin: Audit Types, risk weights, buyers/suppliers, Supplier Profile |
| 10 | Mar 27 | Shipments, Records, Documents, Internal Management |
| 11 | Mar 30 | Risk calculation, Risk page |
| 12 | Mar 31 | Dashboard, Suppliers Map |
| 13 | Apr 1 | Alerts, user preferences |
| 14 | Apr 2 | Testing, bug fixes |
| 15 | Apr 3 | Final validation, delivery, handover |

### Finding vs CAR — quick reference

| Item | Finding | CAR |
|------|--------|-----|
| Required (Save) | Supplier, Audit #, Severity, Summary, Discrepancy | Supplier, Audit #, Finding #, Severity, Summary, Discrepancy |
| Initiate | Admin, QE, Auditor | Admin, Buyer, QE |
| Approve | Admin, QE | Admin, Buyer, QE |
| Status flow | DRAFT → Waiting Disposition → Waiting Approval → Closed | DRAFT → RCCA → Waiting Approval → Follow-Up → Closed |

---

---

## Appendix: Requirements-to-Plan Traceability

| Requirements section | Plan section |
|----------------------|--------------|
| Overview (manage suppliers, audits, findings, CARs, shipments, risk, docs, records, roles) | 1.1, Part 2 |
| Pages & Roles (16 pages, 6 roles; Viewer view-only; Buyer/Supplier scope) | 1.2, 1.3 |
| Dashboard (metrics, charts, filter) | 1.10, Day 12 |
| Risk (stats, distribution, risks/opportunities, weights, filter) | 1.9, Day 11 |
| Corrective Actions (stats, charts, table, filter) | 1.6, Days 7–8 |
| CAR Record (fields, workflow, approval, history) | 1.6, Days 7–8 |
| Findings (stats, defect charts, table, filter) | 1.5, Days 6–7 |
| Findings Record (fields, workflow, approval, history) | 1.5, Days 6–7 |
| Audits (schedule, results, notes, status logic, link to findings) | 1.7, Day 6 |
| Supplier Profile (metrics, tables, upload records, request inspection) | 1.2, Day 9 |
| Supplier List (ID, name, city/country, commodity, risk) | Day 4, 5 |
| Suppliers Map (map, risk-colored icons) | Day 12 |
| Records (upload, internal/supplier, name, supplier, status; approve/reject) | 1.4, Day 10 |
| Shipments (requests, schedule, result, OTD, FPY, metrics) | 1.8, Day 10 |
| Documents (number, name, category, view; types) | 1.4, Day 10 |
| Internal Management (Admin only; contracts, SOW) | 1.4, Day 10 |
| Admin (roles, codes, buyers/suppliers, permissions, weights, load data, delete) | 1.14, Days 8–9, 13 |
| Log in (Sentinel symbol) | Day 4 |
| Alerts (six categories; per-user on/off) | 1.11, Day 13 |
| Security (RBAC, scope, Viewer, auth) | 1.12, Days 3–4 |
| ID formats (SUP-, AUD-, TYP-, FIN-, CAR-) | 1.13, Day 2 |

*This plan is derived from the Sentinel Supplier Assurance Platform Functional Requirements Specification (12MAR2026) and is intended as the single source of truth for the 3-week implementation. Adjust task order within a day as needed without changing weekly milestones or scope.*
