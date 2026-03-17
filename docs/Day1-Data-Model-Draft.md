# Day 1 Deliverable 1.4 — Data Model Draft

**Project:** Sentinel Supplier Assurance Platform  
**Date:** March 16, 2026

Entities and main relationships. Full schema (columns, FKs, indexes) in Day 2.

---

## Entity list

| # | Entity | Purpose |
|---|--------|---------|
| 1 | **Users** | Login, profile; link to Buyer or Supplier where applicable |
| 2 | **Roles** | Admin, Viewer, Quality Engineer, Auditor, Buyer, Supplier |
| 3 | **UserRoles** | User–Role many-to-many |
| 4 | **Suppliers** | Supplier master (ID SUP-00001); commodity, etc. |
| 5 | **BuyerSuppliers** | Assignment of suppliers to buyers |
| 6 | **Audits** | Audit schedule/results (ID AUD-00001); FK to supplier, audit_type |
| 7 | **AuditTypes** | Audit type lookup (ID TYP-00) |
| 8 | **Findings** | Finding records (ID FIN-00001); FK to audit, supplier; status workflow |
| 9 | **CorrectiveActions** | CAR records (ID CAR-00001); FK to finding, audit, supplier; status workflow |
| 10 | **Shipments** | Inspection requests (from supplier); PO, part #, qty, date, status |
| 11 | **ShipmentSchedule** | Admin-loaded schedule for OTD comparison |
| 12 | **Records** | Uploaded records (Supplier/Auditor); internal/supplier, name, supplier, status |
| 13 | **Documents** | Policies/procedures; number, name, category, view |
| 14 | **InternalDocs** | Sensitive docs (contracts, SOW); Admin only |
| 15 | **RiskSnapshots** | Supplier risk score/level over time (or current snapshot) |
| 16 | **Opportunities** | Risk/opportunity entries (QE/Buyer input) |
| 17 | **Alerts** | Generated alert events (e.g. overdue audit, open CAR past due) |
| 18 | **UserAlertPreferences** | Per-user on/off per alert category |

---

## Main relationships

```
Users ──┬── UserRoles ─── Roles
        ├── (optional) Buyer profile → BuyerSuppliers
        └── (optional) Supplier profile → Suppliers (one supplier per user)

Suppliers ──┬── BuyerSuppliers ─── (Buyer = User)
            ├── Audits
            ├── Findings
            ├── CorrectiveActions
            ├── Shipments (inspection requests)
            ├── Records
            └── RiskSnapshots

AuditTypes ─── Audits

Audits ─── Findings (one audit, many findings)
Findings ─── CorrectiveActions (one finding, one or more CARs)
Audits ─── CorrectiveActions (CAR also links to audit)

Shipments (requests) + ShipmentSchedule → used for OTD calculation

Alerts ─── (triggered by business events)
UserAlertPreferences ─── Users (per user, per category)
```

---

## ID formats (for schema)

| Entity | Table (example) | ID column | Format |
|--------|------------------|-----------|--------|
| Supplier | suppliers | code / id_display | SUP-00001 |
| Audit | audits | code | AUD-00001 |
| Audit Type | audit_types | code | TYP-00 |
| Finding | findings | code | FIN-00001 |
| CAR | corrective_actions | code | CAR-00001 |

Sequences or auto-increment + padding to be defined in Day 2 schema.

---

**Sign-off:** All entities and relationships needed for Week 1–3 scope listed = Data model draft complete for Day 1.
