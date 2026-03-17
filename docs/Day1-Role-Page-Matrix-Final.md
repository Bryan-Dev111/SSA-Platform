# Day 1 Deliverable 1.3 — Role–Page Matrix (Final)

**Project:** Sentinel Supplier Assurance Platform  
**Date:** March 16, 2026  
**Source:** Requirements 12MAR2026 — Pages & Roles

This is the single source of truth for which role can **view** each page. Edit capability is per role (Viewer = none; others per requirements).

---

## Matrix: 16 pages × 6 roles

| # | Page | Admin | Viewer | Quality Engineer | Auditor | Buyer | Supplier |
|---|------|:-----:|:-----:|:----------------:|:-------:|:-----:|:--------:|
| 1 | Dashboard | ✓ | ✓ | ✓ | — | ✓ (filtered) | — |
| 2 | Risk | ✓ | ✓ | ✓ | — | ✓ (filtered) | — |
| 3 | Corrective Actions | ✓ | ✓ | ✓ | — | ✓ (filtered) | — |
| 4 | CAR Record | ✓ | ✓ | ✓ | ✓ | ✓ (filtered) | — |
| 5 | Findings | ✓ | ✓ | ✓ | — | ✓ (filtered) | — |
| 6 | Findings Record | ✓ | ✓ | ✓ | ✓ | ✓ (filtered) | — |
| 7 | Audits | ✓ | ✓ | ✓ | ✓ | ✓ (filtered) | — |
| 8 | Supplier Profile | ✓ | ✓ | ✓ | ✓ | ✓ (filtered) | ✓ (own only) |
| 9 | Supplier List | ✓ | ✓ | ✓ | — | ✓ (filtered) | — |
| 10 | Suppliers Map | ✓ | ✓ | ✓ | — | ✓ (filtered) | — |
| 11 | Records | ✓ | ✓ | ✓ | ✓ | ✓ (filtered) | ✓ (own) |
| 12 | Shipments | ✓ | ✓ | ✓ | — | ✓ (filtered) | ✓ (own) |
| 13 | Documents | ✓ | ✓ | ✓ | ✓ | — | — |
| 14 | Internal Management | ✓ | — | — | — | — | — |
| 15 | Admin | ✓ | — | — | — | — | — |
| 16 | Log in | All | All | All | All | All | All |

---

## Rules

- **Filtered:** Buyer sees only data for suppliers assigned to them on that page.
- **Viewer:** Can view all pages except Admin and Internal Management. Cannot create, edit, or delete anywhere.
- **Supplier:** Can view only Supplier Profile (own data), own Records, and own Shipments. No Dashboard, Risk, Corrective Actions, Findings, Audits, Supplier List, Suppliers Map, Documents.
- **Auditor:** Has access only to CAR Record, Findings Record, Audits, Supplier Profile, Records. No access to Dashboard, Risk, Corrective Actions, Findings, Supplier List, Suppliers Map, Shipments, Documents (per strict requirements, Documents = Admin, QE, Auditor — so Auditor has Documents).
- **Documents:** No Buyer access per requirements.

---

## Who can do what (summary)

| Role | Can initiate Finding | Can approve Finding | Can initiate CAR | Can approve CAR | Set audit result | Approve Records | Delete (any) |
|------|:-------------------:|:-------------------:|:-----------------:|:----------------:|:----------------:|:---------------:|:-------------:|
| Admin | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ (only) |
| Viewer | — | — | — | — | — | — | — |
| Quality Engineer | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| Auditor | ✓ | — | — | — | — | — | — |
| Buyer | — | — | ✓ | ✓ | — | — | — |
| Supplier | — | — | — | — | — | — | — |

---

**Sign-off:** Matrix matches Requirements doc = Role–page matrix complete for Day 1.
