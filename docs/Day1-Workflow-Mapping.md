# Day 1 Deliverable 1.2 — Workflow Mapping

**Project:** Sentinel Supplier Assurance Platform  
**Date:** March 16, 2026

End-to-end flows to be implemented. Use this to validate that Day 2+ design and build cover every path.

---

## Flow 1: Supplier lifecycle

```
[Admin] Add Supplier (Admin page)
    → Assign to Buyer(s) (buyer_suppliers)
    → Supplier appears on Supplier List (for Admin, Buyer, QE)
    → Supplier can log in → sees only Supplier Profile (own data)
    → Supplier uploads Records → appears on Records (status pending)
    → Supplier requests Shipment inspection (PO, Part #, Qty, date) → status Waiting inspection
```

**Check:** Supplier creation, assignment, visibility by role, Record upload, Shipment request.

---

## Flow 2: Audit schedule → result → Findings

```
[Admin/QE] Schedule Audit (date, notes) → status Scheduled / In-Process / Overdue
    → [Admin/QE] Set result: Passed | Failed | Cancelled → status Complete or Cancelled
    → If Failed: [Admin/QE/Auditor] Create Finding(s) linked to Audit #
    → Finding: DRAFT → (Save with required fields) → Waiting Disposition → Process → Waiting Approval → [Admin/QE Approve] → Closed
    → Audit table shows Finding #s (clickable to Findings Record)
```

**Check:** Audit CRUD, result update (Admin/QE only), status derivation, Finding creation and link to Audit, Finding workflow and approval.

---

## Flow 3: Findings → CAR

```
[Admin/QE/Auditor] Create Finding → Save → Waiting Disposition → … → Closed
    → [Admin/Buyer/QE] Create CAR linked to Finding # (and Audit #)
    → Severity can auto-populate from Finding
    → CAR: DRAFT → (Save with required fields) → RCCA → Process → Waiting Approval → [Admin/Buyer/QE Approve] → Follow-Up → … → Closed
```

**Check:** CAR creation from Finding, required fields, approval roles, no reverse to Draft.

---

## Flow 4: Shipment request → inspection

```
[Supplier] On Supplier Profile: Request inspection (PO, Part Number, Qty, Inspection date)
    → Record created with status "Waiting inspection"
    → Alert (if user preferences on) for shipment inspection request
    → [Admin/QE] On Shipments page: see request; record result Passed or Failed
    → Schedule table (Admin-loaded) used for OTD calculation vs shipment table
    → Metrics: total, waiting, rejected, late, OTD, FPY
```

**Check:** Request creation by Supplier, status flow, result by Admin/QE, OTD logic, metrics.

---

## Flow 5: Risk inputs → score

```
[Admin] Configure risk weight % (quality, audit, delivery, CAR closure, documentation)
    → System computes supplier risk score
    → Output: Low | Medium | High (shown on Dashboard, Risk page, Supplier List, Supplier Profile)
    → [QE/Buyer] Add risk and opportunity entries (Risk page)
    → Risk page: stats, distribution, top risk suppliers, risks table, opportunities table; supplier filter for Buyer
```

**Check:** Weight config, score calculation, level display, risk/opportunity inputs, Buyer filter.

---

## Cross-cutting: Records and Documents

- **Records:** Supplier/Auditor upload → Records table (internal/supplier, name, supplier, status) → Admin/QE approve or reject. Buyer sees only assigned suppliers’ records.
- **Documents:** Admin/QE/Auditor manage view-only documents (number, name, category, view). Types: Procedure, Policy, SOP, Work Instruction, Form.
- **Internal Management:** Admin only; upload/retrieve sensitive docs (e.g. contracts, SOW).

---

**Sign-off:** All five main flows and cross-cutting flows documented and agreed = Workflow mapping complete for Day 1.
