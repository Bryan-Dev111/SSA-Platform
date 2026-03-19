# Day 10 — Acceptance test cases

**Purpose:** Shipments (requests, schedule, metrics, results), Records (upload, approve/reject, download), Documents library, Internal Management (Admin).

---

## Section A — Shipments

| ID | Role | Step | Expected | Pass? |
|----|------|------|----------|:-----:|
| A.1 | Admin | **GET /shipments/metrics** | JSON with totals, waiting, passed, failed, OTD%, FPY%, scheduleRowCount | ☐ |
| A.2 | Supplier | **GET /shipments** | Only own supplier’s requests | ☐ |
| A.3 | Buyer | **GET /shipment-schedule** | Only schedules for assigned suppliers | ☐ |
| A.4 | Admin | **POST /shipment-schedule** with supplierId, scheduledDate | **201** | ☐ |
| A.5 | QE | **POST /shipment-schedule** | **403** | ☐ |
| A.6 | Admin | **DELETE /shipment-schedule/:id** | **204** | ☐ |
| A.7 | QE | **PATCH /shipments/:id** `{ "result": "Passed" }` on WaitingInspection row | **200**, status Passed | ☐ |
| A.8 | Buyer | **PATCH /shipments/:id** | **403** | ☐ |
| A.9 | Admin | **Shipments** page: metrics cards, two tables, Pass/Fail buttons | Works | ☐ |
| A.10 | Admin | Add schedule row matching a request’s PO/Part; Pass inspection on/before scheduled date | OTD% reflects on-time (when matched) | ☐ |

---

## Section B — Records

| ID | Role | Step | Expected | Pass? |
|----|------|------|----------|:-----:|
| B.1 | Supplier | **POST /records** supplier-sourced | **201** PENDING | ☐ |
| B.2 | Buyer | **POST /records** for non-assigned supplierId | **403** | ☐ |
| B.3 | Admin | **PATCH /records/:id** `{ "status": "Approved" }` | **200** | ☐ |
| B.4 | Viewer | **PATCH /records/:id** | **403** | ☐ |
| B.5 | Any (scoped) | **GET /records/:id/download** with file | File downloads | ☐ |
| B.6 | **Records** page | Approve / Reject / Download | UI matches API | ☐ |

---

## Section C — Documents

| ID | Role | Step | Expected | Pass? |
|----|------|------|----------|:-----:|
| C.1 | Viewer | **GET /documents** | List (may be empty) | ☐ |
| C.2 | Viewer | **POST /documents** | **403** | ☐ |
| C.3 | QE | **POST /documents** with documentNumber, name, documentType | **201** | ☐ |
| C.4 | Auditor | **GET /documents/:id/download** | **200** file | ☐ |
| C.5 | **Documents** page | Create + Download + Delete (Admin/QE) | Works | ☐ |

---

## Section D — Internal Management

| ID | Role | Step | Expected | Pass? |
|----|------|------|----------|:-----:|
| D.1 | Admin | **GET /internal-docs** | **200** | ☐ |
| D.2 | QE | **GET /internal-docs** | **403** | ☐ |
| D.3 | Admin | **POST /internal-docs** | **201** | ☐ |
| D.4 | Non-Admin | Open **/internal-management** | Redirect away | ☐ |

---

## Sign-off

| Block | IDs | All pass? |
|-------|-----|:---------:|
| Shipments | A.1–A.10 | ☐ |
| Records | B.1–B.6 | ☐ |
| Documents | C.1–C.5 | ☐ |
| Internal | D.1–D.4 | ☐ |

**Tester:** _______________ **Date:** _______________
