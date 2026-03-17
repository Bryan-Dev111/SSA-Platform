# Day 2 Deliverable 2.2 — Database Schema

**Project:** Sentinel Supplier Assurance Platform  
**Date:** March 17, 2026

Full schema is in **`server/prisma/schema.prisma`**. This document lists tables and key relationships.

---

## Table list (Prisma models)

| # | Table (model) | Purpose |
|---|----------------|---------|
| 1 | Role | Admin, Viewer, QualityEngineer, Auditor, Buyer, Supplier |
| 2 | User | Login; email, passwordHash, name |
| 3 | UserRole | User–Role many-to-many |
| 4 | CommodityType | Lookup for supplier classification |
| 5 | Supplier | Supplier master; code = SUP-00001; optional userId for Supplier login |
| 6 | BuyerSupplier | Assignment of suppliers to buyers (buyerId = User.id) |
| 7 | AuditType | Audit type lookup; code = TYP-00 |
| 8 | Audit | Audit schedule/results; code = AUD-00001 |
| 9 | Finding | Finding record; code = FIN-00001; status workflow |
| 10 | CorrectiveAction | CAR; code = CAR-00001; status workflow |
| 11 | Shipment | Inspection requests from supplier |
| 12 | ShipmentSchedule | Admin-loaded schedule for OTD |
| 13 | Record | Uploaded records (Supplier/Auditor); status pending/approved/rejected |
| 14 | Document | Policies/procedures; documentType enum |
| 15 | InternalDoc | Sensitive docs (Admin only) |
| 16 | RiskWeightConfig | Weight % for risk categories (single row) |
| 17 | RiskSnapshot | Supplier risk score/level |
| 18 | Opportunity | Risk/opportunity entries (QE/Buyer) |
| 19 | Alert | Generated alert events |
| 20 | UserAlertPreference | Per-user on/off per alert category |

---

## Display ID (code) columns

| Model | Column | Format |
|-------|--------|--------|
| Supplier | code | SUP-00001 |
| AuditType | code | TYP-00 |
| Audit | code | AUD-00001 |
| Finding | code | FIN-00001 |
| CorrectiveAction | code | CAR-00001 |

Implementation: see **Day2-ID-Format-Spec.md**. Sequences or app-level generation.

---

## Key relationships

- **User** ↔ **Role**: UserRole (many-to-many).
- **User** as Buyer: BuyerSupplier.buyerId → User.id.
- **User** as Supplier: Supplier.userId → User.id (optional).
- **Supplier** → Audits, Findings, CorrectiveActions, Shipments, Records, RiskSnapshots, Opportunities, ShipmentSchedule.
- **Audit** → Findings, CorrectiveActions.
- **Finding** → CorrectiveActions (one-to-many).
- **AuditType** → Audits.

---

## Enums (in schema)

- **AuditResult:** Passed, Failed, Cancelled
- **FindingStatus:** DRAFT, WaitingDisposition, WaitingApproval, Closed
- **FindingSeverity:** Critical, Major, Minor
- **CARStatus:** DRAFT, RCCA, WaitingApproval, FollowUp, Closed
- **ShipmentStatus:** WaitingInspection, Passed, Failed
- **RecordSource:** internal, supplier
- **RecordStatus:** PENDING, Approved, Rejected
- **DocumentType:** Procedure, Policy, StandardOperatingProcedure, WorkInstruction, Form
- **RiskLevel:** Low, Medium, High
- **AlertCategory:** overdueAudit, majorCriticalFinding, overdueCAR, shipmentInspectionRequest, rejectedShipmentDocument, lateShipment

---

**Sign-off:** Schema defined in Prisma; migrations apply to PostgreSQL.
