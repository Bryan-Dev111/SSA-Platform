# Day 1 Deliverable 1.1 — Requirement Traceability Checklist

**Project:** Sentinel Supplier Assurance Platform  
**Date:** March 16, 2026  
**Source:** Sentinel Supplier Assurance Platform Requirements 12MAR2026

Use this checklist to confirm every page, role, field, and rule from the Requirements doc is captured. Tick when verified.

---

## 1. Pages (16 total)

| # | Page | In plan? | Notes |
|---|------|:--------:|-------|
| 1 | Dashboard | ☐ | Metrics + charts; supplier filter |
| 2 | Risk | ☐ | Stats, distribution, risks/opportunities; supplier filter |
| 3 | Corrective Actions | ☐ | Stats, charts, CAR table; supplier filter |
| 4 | CAR Record | ☐ | Form + approval/status history |
| 5 | Findings | ☐ | Stats, defect charts, table; supplier filter |
| 6 | Findings Record | ☐ | Form + approval/status history |
| 7 | Audits | ☐ | Schedule table, results, notes, link to findings |
| 8 | Supplier Profile | ☐ | Metrics, tables, upload records, request inspection |
| 9 | Supplier List | ☐ | ID, name, city/country, commodity, risk |
| 10 | Suppliers Map | ☐ | Map, risk-colored icons |
| 11 | Records | ☐ | Upload; internal/supplier, name, supplier, status |
| 12 | Shipments | ☐ | Inspection requests + schedule; OTD, FPY |
| 13 | Documents | ☐ | Number, name, category, view; 5 types |
| 14 | Internal Management | ☐ | Admin only; contracts, SOW |
| 15 | Admin | ☐ | Config: roles, codes, buyers/suppliers, weights, load data |
| 16 | Log in | ☐ | Sentinel symbol; all roles |

---

## 2. Roles (6)

| Role | In plan? | Data scope | Edit rule |
|------|:--------:|------------|-----------|
| Admin | ☐ | All | Full; only role that can delete (Finding, Audit, CAR, Risk, Opportunity, Supplier) |
| Viewer | ☐ | All (except Admin, Internal Mgmt) | None — view only |
| Quality Engineer | ☐ | All relevant | Approve Findings/CARs; set audit results; approve Records |
| Auditor | ☐ | Per matrix | Create Findings; view CAR/Finding records; upload Records |
| Buyer | ☐ | Assigned suppliers only | Approve CARs; add risk/opportunity; filtered on all pages |
| Supplier | ☐ | Own data only | Profile: view, upload Records, request Shipment inspection |

---

## 3. Key fields by entity

### Findings Record
| Field | In plan? |
|-------|:--------:|
| Supplier | ☐ |
| Audit # | ☐ |
| Severity (Critical/Major/Minor) | ☐ |
| Summary | ☐ |
| Defect Code | ☐ |
| Discrepancy | ☐ |
| Containment | ☐ |
| Occurrence Root Cause | ☐ |
| Escape Root Cause | ☐ |
| Corrective Action | ☐ |
| Verification of Effectiveness | ☐ |
| Closing Comments | ☐ |
| Approval/status history table | ☐ |

### CAR Record
| Field | In plan? |
|-------|:--------:|
| Supplier | ☐ |
| Audit # | ☐ |
| Finding # | ☐ |
| Severity (auto from Finding) | ☐ |
| CAR Owner | ☐ |
| Target Completion Date | ☐ |
| Summary | ☐ |
| Defect Code | ☐ |
| Discrepancy | ☐ |
| Containment | ☐ |
| Occurrence Root Cause | ☐ |
| Escape Root Cause | ☐ |
| Corrective Action | ☐ |
| Verification of Effectiveness | ☐ |
| Closing Comments | ☐ |
| Approval/status history table | ☐ |

### Audit
| Field / concept | In plan? |
|-----------------|:--------:|
| Schedule (date) | ☐ |
| Results (Passed/Failed/Cancelled) | ☐ |
| Notes | ☐ |
| Derived status (Scheduled/In-Process/Overdue/Complete/Cancelled) | ☐ |
| Link to Finding #s (clickable) | ☐ |

### Shipment (inspection request)
| Field | In plan? |
|-------|:--------:|
| Purchase Order | ☐ |
| Part Number | ☐ |
| Qty | ☐ |
| Inspection date | ☐ |
| Status (Waiting inspection / Passed / Failed) | ☐ |

### Records table
| Column | In plan? |
|--------|:--------:|
| Internal or supplier document | ☐ |
| Name | ☐ |
| Supplier | ☐ |
| Status (pending/approved/rejected) | ☐ |

### Documents
| Concept | In plan? |
|---------|:--------:|
| Document number, name, category, view | ☐ |
| Types: Procedure, Policy, SOP, Work Instruction, Form | ☐ |

---

## 4. Business rules

### Findings workflow
| Rule | In plan? |
|------|:--------:|
| Status: DRAFT → Waiting Disposition → Waiting Approval → Closed | ☐ |
| Required to Save (Draft → Waiting Disposition): Supplier, Audit #, Severity, Summary, Discrepancy | ☐ |
| Initiate: Admin, QE, Auditor | ☐ |
| Approve: Admin, QE only | ☐ |
| Cannot reverse to Draft | ☐ |
| Process moves forward; Reverse moves back | ☐ |
| Buttons greyed out until available | ☐ |

### CAR workflow
| Rule | In plan? |
|------|:--------:|
| Status: DRAFT → RCCA → Waiting Approval → Follow-Up → Closed | ☐ |
| Required to Save: Supplier, Audit #, Finding #, Severity, Summary, Discrepancy | ☐ |
| Initiate: Admin, Buyer, QE | ☐ |
| Approve: Admin, Buyer, QE | ☐ |
| Cannot reverse to Draft | ☐ |
| Process/Reverse; Approve/Reject in Waiting Approval | ☐ |
| Buttons greyed out until available | ☐ |

### Audits
| Rule | In plan? |
|------|:--------:|
| Only Admin, QE set results | ☐ |
| Status logic: Cancelled→Cancelled; Passed/Failed→Complete; date>today→Scheduled; date=today→In-Process; date<today & no result→Overdue | ☐ |

### Shipments
| Rule | In plan? |
|------|:--------:|
| Two tables: inspection requests + schedule (Admin load) | ☐ |
| Admin/QE record result Passed/Failed | ☐ |
| OTD from schedule vs shipment table | ☐ |
| Metrics: total, waiting, rejected, late, OTD, FPY | ☐ |

### Records
| Rule | In plan? |
|------|:--------:|
| Upload by Supplier, Auditor | ☐ |
| Approve/Reject by Admin, QE only | ☐ |
| Buyer sees assigned suppliers only | ☐ |

### Admin
| Rule | In plan? |
|------|:--------:|
| Admin only can delete: Finding, Audit, CAR, Risk, Opportunity, Supplier | ☐ |
| Config: Commodity Types, Defect Codes, Disposition Codes, Audit Types (TYP-00), Risk weights, Buyers/Suppliers, permissions, load audits, load shipment schedule | ☐ |

### Alerts
| Rule | In plan? |
|------|:--------:|
| Categories: overdue audits, major/critical findings, overdue CARs, shipment inspection request, rejected shipment/document, late shipment | ☐ |
| Per-user on/off per category (not Admin-controlled) | ☐ |

### IDs
| Format | In plan? |
|--------|:--------:|
| SUP-00001, AUD-00001, TYP-00, FIN-00001, CAR-00001 | ☐ |

---

## 5. Security

| Requirement | In plan? |
|-------------|:--------:|
| Role-based access control | ☐ |
| Supplier: own data only | ☐ |
| Buyer: assigned suppliers only | ☐ |
| Viewer: view only, no edit | ☐ |
| Secure authentication | ☐ |

---

**Sign-off:** All items above ticked = Requirement checklist complete for Day 1.
