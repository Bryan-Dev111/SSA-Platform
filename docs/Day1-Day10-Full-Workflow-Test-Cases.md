# Sentinel SSA - Day1 to Day10 Full Workflow Test Cases (Maximum Coverage)

**Goal:** Validate how all functions work end-to-end from Day1 to Day10.  
**Scope:** Requirements -> Architecture -> Auth/RBAC -> Navigation -> APIs -> Audits/Findings/CAR -> Reference Data -> Admin Config -> Supplier Portal -> Shipments/Records/Documents/Internal -> Regression.  
**Type:** Manual + API + Role-based + Negative + Security + Data-scope + E2E.

---

## 1) Test Environment

### 1.1 Required Setup
- Backend running (example: `http://localhost:4000`)
- Frontend running (example: `http://localhost:5173`)
- PostgreSQL connected
- Prisma migrations applied
- Seed data loaded
- Browser devtools available
- API client (Postman/Insomnia/curl) ready

### 1.2 Test Users
- Admin: `admin@sentinel.local / Admin123!`
- QE: `qe@sentinel.local / Test123!`
- Viewer: `viewer@sentinel.local / Test123!`
- Auditor: `auditor@sentinel.local / Test123!`
- Buyer: `buyer@sentinel.local / Test123!`
- Supplier: `supplier@sentinel.local / Test123!`

### 1.3 Baseline Data Conditions
- At least 2 suppliers exist (`SUP-TEST01`, `SUP-TEST02`)
- Buyer assigned to only one supplier (`SUP-TEST01`)
- At least 1 audit type
- At least 1 defect code + 1 disposition code
- At least 1 pending record
- At least 1 shipment request + 1 shipment schedule for matching tests

---

## 2) Day1 - Requirement/Design Validation

| ID | Test Case | Expected |
|---|---|---|
| D1-001 | 16 pages listed in requirement checklist | All required pages present |
| D1-002 | 6 roles listed with permission logic | All roles mapped |
| D1-003 | Findings fields complete | All mandatory fields documented |
| D1-004 | CAR fields complete | All mandatory fields documented |
| D1-005 | Findings workflow documented | DRAFT -> WaitingDisposition -> WaitingApproval -> Closed |
| D1-006 | CAR workflow documented | DRAFT -> RCCA -> WaitingApproval -> FollowUp -> Closed |
| D1-007 | Reverse rule documented | Cannot reverse to DRAFT |
| D1-008 | Audit result rules documented | Admin/QE only |
| D1-009 | Shipments workflow documented | Request + Schedule + Result + Metrics |
| D1-010 | Alerts model documented | Categories + user preferences |
| D1-011 | Security rules documented | RBAC + scope boundaries |
| D1-012 | ID formats documented | SUP/AUD/TYP/FIN/CAR format defined |
| D1-013 | Workflow mapping exists | Supplier lifecycle + quality flow + risk flow |
| D1-014 | Role-page matrix exists | Route/page access by role |
| D1-015 | Data model draft exists | Required entities/relations covered |
| D1-016 | Tech stack document exists | FE/BE/DB/auth/deployment decisions |

---

## 3) Day2 - Architecture + Schema + Repo + DB

| ID | Test Case | Steps | Expected |
|---|---|---|---|
| D2-001 | Architecture document completeness | Open doc | FE/BE/DB/deploy/folders covered |
| D2-002 | Prisma schema exists | Check `schema.prisma` | File present |
| D2-003 | Core models exist | Review schema | User/Role/UserRole/Supplier/etc present |
| D2-004 | Workflow models exist | Review schema | Audit/Finding/CAR/Shipment/Record present |
| D2-005 | Reference models exist | Review schema | Commodity/Defect/Disposition/AuditType present |
| D2-006 | Risk models exist | Review schema | RiskSnapshot/RiskWeight/Opportunity present |
| D2-007 | Support models exist | Review schema | Alerts/UserAlertPreference/IdSequence present |
| D2-008 | Migration files exist | Check prisma migrations | Init migration present |
| D2-009 | `prisma generate` success | Run command | No errors |
| D2-010 | `prisma migrate` success | Run command | No errors |
| D2-011 | Health API works | `GET /health` | 200, status ok |
| D2-012 | Client starts | Run client dev | UI loads |
| D2-013 | Server starts | Run server dev | API listening |

---

## 4) Day3 - Authentication and RBAC Core

| ID | Test Case | Expected |
|---|---|---|
| D3-001 | Valid login works for each role | 200 + token + role payload |
| D3-002 | Invalid password rejected | 401/400 + error |
| D3-003 | Missing credentials rejected | validation error |
| D3-004 | Token persisted in storage | session remains after refresh |
| D3-005 | Logout clears session | token removed |
| D3-006 | Protected route unauthenticated | redirect to login |
| D3-007 | Protected API unauthenticated | 401 |
| D3-008 | Expired token API call | 401 + forced logout |
| D3-009 | Admin-only endpoint as non-admin | 403 |
| D3-010 | `/api/me` returns roleNames | correct role list |
| D3-011 | `/api/me` buyer scope | assignedSupplierIds returned |
| D3-012 | `/api/me` supplier scope | supplier id/code/name returned |

---

## 5) Day4 - App Shell, Navigation, Route Guards

| ID | Test Case | Expected |
|---|---|---|
| D4-001 | Login page loads | email/password + sign-in visible |
| D4-002 | Sentinel branding visible | logo/symbol displayed |
| D4-003 | Admin menu coverage | all allowed pages visible |
| D4-004 | Viewer menu restrictions | no Admin/Internal |
| D4-005 | Buyer menu restrictions | no Documents/Internal/Admin |
| D4-006 | QE menu restrictions | per matrix |
| D4-007 | Auditor restricted menu | only allowed audit/findings/records/docs-related |
| D4-008 | Supplier restricted menu | only profile/records/shipments |
| D4-009 | Direct URL blocked for Supplier | redirected to supplier-profile |
| D4-010 | Direct URL blocked for Viewer on Admin | redirected |
| D4-011 | Direct URL blocked for Buyer on Documents | redirected |
| D4-012 | Authorized direct URL works | page loads |
| D4-013 | Already logged in opening `/login` | redirected by role default |
| D4-014 | Bearer token sent by API helpers | authorization header present |
| D4-015 | 401 auto logout behavior | session cleared + login redirect |

---

## 6) Day5 - API Foundations and Scoped Data

| ID | Endpoint/Test | Role | Expected |
|---|---|---|---|
| D5-001 | `GET /api/me` with token | any logged-in | 200 |
| D5-002 | `GET /api/me` without token | none | 401 |
| D5-003 | `GET /api/users` | Admin | 200 |
| D5-004 | `GET /api/users` | Viewer/QE/Auditor/Buyer/Supplier | 403 |
| D5-005 | `GET /api/suppliers` | Admin | all suppliers |
| D5-006 | `GET /api/suppliers` | Buyer | assigned suppliers only |
| D5-007 | `GET /api/suppliers` | Supplier | own supplier only |
| D5-008 | `GET /api/suppliers/:id` in-scope | Buyer/Admin | 200 |
| D5-009 | `GET /api/suppliers/:id` out-of-scope | Buyer | 404/blocked |
| D5-010 | Error format consistency | all errors | JSON error body |
| D5-011 | Supplier list UI scope | Buyer | only assigned rows |
| D5-012 | Supplier list UI scope | Admin | all rows |

---

## 7) Day6 - Audits + Findings Core Workflow

### 7.1 Audits
| ID | Test | Expected |
|---|---|---|
| D6-001 | Audits page load | table/filter/buttons render |
| D6-002 | Admin create audit | new row with `AUD-xxxxx` |
| D6-003 | QE create audit (if allowed by implementation) | expected by RBAC |
| D6-004 | Viewer cannot create | create action hidden/blocked |
| D6-005 | Set result Passed (Admin/QE) | status Complete |
| D6-006 | Set result Failed (Admin/QE) | status Complete |
| D6-007 | Set result Cancelled | status Cancelled |
| D6-008 | Past date no result | status Overdue |
| D6-009 | Today date no result | status In-Process |
| D6-010 | Future date no result | status Scheduled |
| D6-011 | Delete audit as Admin | 204 + removed |
| D6-012 | Delete audit non-admin | 403 |

### 7.2 Findings
| ID | Test | Expected |
|---|---|---|
| D6-013 | Findings list loads | stats/cards/table visible |
| D6-014 | Admin create draft | DRAFT created |
| D6-015 | QE create draft | DRAFT created |
| D6-016 | Auditor create draft | DRAFT created |
| D6-017 | Viewer cannot create | action hidden |
| D6-018 | Buyer cannot create | action hidden |
| D6-019 | Save DRAFT -> WaitingDisposition | final code `FIN-xxxxx` assigned |
| D6-020 | Process WaitingDisposition -> WaitingApproval | status moved |
| D6-021 | Reverse WaitingApproval -> WaitingDisposition | status moved back |
| D6-022 | Reverse cannot go to DRAFT | blocked |
| D6-023 | Approve WaitingApproval (Admin/QE) | Closed |
| D6-024 | Reject WaitingApproval (Admin/QE) | WaitingDisposition |
| D6-025 | Auditor cannot approve/reject | controls hidden/blocked |
| D6-026 | Finding detail from list link | correct record opens |
| D6-027 | Finding detail from audit finding code | correct record opens |
| D6-028 | Buyer sees only assigned supplier findings | scope enforced |
| D6-029 | Out-of-scope finding by URL/API | 404/blocked |
| D6-030 | Delete finding as Admin | 204 + removed |
| D6-031 | Delete finding as QE | 403 |

---

## 8) Day7 - Findings + CAR Advanced Workflow

### 8.1 Findings Regression
| ID | Test | Expected |
|---|---|---|
| D7-001 | New finding button role visibility | Admin/QE/Auditor only |
| D7-002 | Workflow action visibility | role-correct |
| D7-003 | Required field validation summary | blocked if empty |
| D7-004 | Required field validation discrepancy | blocked if empty |
| D7-005 | Action locking during API call | no duplicate transition |
| D7-006 | Pagination clamp after update/delete | stable page rendering |

### 8.2 CAR CRUD + Workflow
| ID | Test | Expected |
|---|---|---|
| D7-007 | Corrective Actions page loads | list + filters + links |
| D7-008 | Admin New CAR visible | yes |
| D7-009 | QE New CAR visible | yes |
| D7-010 | Buyer New CAR visible | yes |
| D7-011 | Viewer New CAR hidden | yes |
| D7-012 | Auditor New CAR hidden | yes |
| D7-013 | Create CAR draft from finding | CAR DRAFT created |
| D7-014 | Audit# + Severity auto-populated from finding | yes |
| D7-015 | Save DRAFT -> RCCA | status updated |
| D7-016 | Process RCCA -> WaitingApproval | status updated |
| D7-017 | Reverse WaitingApproval -> RCCA | status updated |
| D7-018 | Approve WaitingApproval -> Closed | status updated |
| D7-019 | Reject WaitingApproval -> RCCA | status updated |
| D7-020 | FollowUp transition behavior | matches workflow |
| D7-021 | Reverse never reaches DRAFT | blocked |
| D7-022 | CAR delete Admin | 204 |
| D7-023 | CAR delete non-admin | 403 |
| D7-024 | Buyer scope in CAR list | assigned suppliers only |
| D7-025 | CAR->Finding link | opens correct finding |
| D7-026 | Finding->CAR relationship consistency | linked IDs stable |

---

## 9) Day8 - Commodity/Defect/Disposition + Integration

### 9.1 Commodity Types API
| ID | Test | Expected |
|---|---|---|
| D8-001 | GET without token | 401 |
| D8-002 | GET as Admin | 200 list |
| D8-003 | GET as Viewer/QE/Buyer/Auditor | 200 (if allowed) |
| D8-004 | GET as Supplier | 403 (if route restricted) |
| D8-005 | POST as Admin valid | 201 |
| D8-006 | POST as Admin empty name | 400 |
| D8-007 | POST as non-admin | 403 |
| D8-008 | PATCH as Admin valid | 200 |
| D8-009 | PATCH invalid id | 404 |
| D8-010 | DELETE unused type Admin | 204 |
| D8-011 | DELETE in-use type Admin | 400 |
| D8-012 | DELETE non-admin | 403 |

### 9.2 Defect Codes API
| ID | Test | Expected |
|---|---|---|
| D8-013 | GET default returns active only | 200 active subset |
| D8-014 | GET `?all=1` as Admin | includes inactive |
| D8-015 | GET `?all=1` as non-admin | still active only |
| D8-016 | POST Admin valid | 201 |
| D8-017 | POST duplicate code | 400 |
| D8-018 | POST missing code | 400 |
| D8-019 | PATCH Admin valid | 200 |
| D8-020 | PATCH empty code | 400 |
| D8-021 | DELETE existing Admin | 204 |
| D8-022 | DELETE unknown id | 404 |
| D8-023 | DELETE non-admin | 403 |

### 9.3 Disposition Codes API
| ID | Test | Expected |
|---|---|---|
| D8-024 | GET default active only | 200 |
| D8-025 | GET `?all=1` Admin | include inactive |
| D8-026 | POST Admin valid | 201 |
| D8-027 | POST duplicate | 400 |
| D8-028 | PATCH toggle active | 200 |
| D8-029 | DELETE Admin | 204 |
| D8-030 | POST non-admin | 403 |

### 9.4 Supplier Commodity Assignment
| ID | Test | Expected |
|---|---|---|
| D8-031 | PATCH supplier commodity valid (Admin) | 200 + relation shown |
| D8-032 | PATCH commodity null (clear) | 200 |
| D8-033 | PATCH invalid commodityTypeId | 400 |
| D8-034 | PATCH missing commodityTypeId | 400 |
| D8-035 | PATCH as Buyer/QE/Viewer | 403 |

### 9.5 UI Integration
| ID | Test | Expected |
|---|---|---|
| D8-036 | Admin page tabs load | Commodity/Defect/Disposition visible |
| D8-037 | Commodity tab add/edit/delete | works with constraints |
| D8-038 | Defect tab add/edit/activate/deactivate/delete | works |
| D8-039 | Disposition tab add/edit/activate/deactivate/delete | works |
| D8-040 | Supplier List commodity editor visible only Admin | yes |
| D8-041 | Findings Record uses defect/disposition dropdowns | yes |
| D8-042 | CAR Record uses defect dropdown | yes |
| D8-043 | Legacy code fallback option appears | "(not in list)" option |
| D8-044 | Non-admin `/admin` blocked | redirect/forbidden |

---

## 10) Day9 - Admin Config + Supplier Portal

### 10.1 Audit Types
| ID | Test | Expected |
|---|---|---|
| D9-001 | GET no token | 401 |
| D9-002 | GET Admin/QE | 200 |
| D9-003 | GET Supplier | 403 |
| D9-004 | POST Admin with auto code | 201 `TYP-xx` assigned |
| D9-005 | POST Admin with custom code | 201 |
| D9-006 | POST duplicate code | 400 |
| D9-007 | POST non-admin | 403 |
| D9-008 | PATCH Admin | 200 |
| D9-009 | DELETE in-use type | 400 |
| D9-010 | DELETE unused type | 204 |

### 10.2 Risk Weights
| ID | Test | Expected |
|---|---|---|
| D9-011 | GET no token | 401 |
| D9-012 | GET Admin/Viewer/QE | 200 |
| D9-013 | GET Supplier | 403 |
| D9-014 | PUT sum != 100 | 400 |
| D9-015 | PUT valid sum = 100 | 200 |
| D9-016 | PUT non-admin | 403 |
| D9-017 | UI save and reload persistence | values retained |

### 10.3 Buyers/Suppliers Management
| ID | Test | Expected |
|---|---|---|
| D9-018 | POST user as Admin (Buyer role) | 201 |
| D9-019 | POST user duplicate email | 400 |
| D9-020 | POST user invalid role | 400 |
| D9-021 | POST user non-admin | 403 |
| D9-022 | POST supplier as Admin | 201 + `SUP-xxxxx` |
| D9-023 | PATCH supplier partial fields | 200 |
| D9-024 | PATCH supplier empty body | 400 |
| D9-025 | PATCH supplier non-admin | 403 |
| D9-026 | POST buyer-supplier assignment Admin | 201 |
| D9-027 | POST buyer-supplier invalid buyer | 400 |
| D9-028 | DELETE buyer-supplier assignment | 204 |
| D9-029 | Buyer sees assigned supplier after assignment | yes |
| D9-030 | Buyer loses supplier after unassignment | yes |

### 10.4 Permissions/Delete Rules
| ID | Test | Expected |
|---|---|---|
| D9-031 | Admin permissions tab displays matrix | correct path-role mappings |
| D9-032 | Non-admin to `/admin` | blocked |
| D9-033 | Delete protected resources as non-admin | 403 |
| D9-034 | Delete protected resources as admin | 204/200 |

### 10.5 Records + Shipments API Role Behavior
| ID | Test | Expected |
|---|---|---|
| D9-035 | Supplier `GET /records` own scope | own records only |
| D9-036 | Supplier `POST /records` own supplier | 201 PENDING |
| D9-037 | Supplier `POST /records` other supplier | 403 |
| D9-038 | Supplier internal record type (if restricted) | 403 |
| D9-039 | Supplier `GET /shipments` own scope | own rows only |
| D9-040 | Supplier `POST /shipments` own supplier | 201 WaitingInspection |
| D9-041 | Supplier `POST /shipments` other supplier | 403 |
| D9-042 | Supplier `POST /shipments` missing required fields | 400 |
| D9-043 | Viewer `POST /shipments` | 403 |

### 10.6 Supplier Profile Portal
| ID | Test | Expected |
|---|---|---|
| D9-044 | Supplier profile portal API loads | 200 |
| D9-045 | Metrics block shown | buyers/open cars/audits/findings/records/shipments |
| D9-046 | Portal tables shown | audits/findings/cars/risk/records/shipments |
| D9-047 | Submit record from portal | new record created |
| D9-048 | Submit shipment request from portal | new shipment created |
| D9-049 | Buyer opening supplier portal | fallback message |
| D9-050 | Supplier user with no linked supplier | 404/handled error UI |

---

## 11) Day10 - Full End-to-End Operational Workflows

### 11.1 Shipments
| ID | Test | Expected |
|---|---|---|
| D10-001 | `GET /shipments/metrics` Admin | totals + waiting + passed + failed + OTD + FPY |
| D10-002 | `GET /shipments` Supplier | own requests only |
| D10-003 | `GET /shipment-schedule` Buyer | assigned supplier schedules only |
| D10-004 | `POST /shipment-schedule` Admin | 201 |
| D10-005 | `POST /shipment-schedule` QE | 403 (if admin-only) |
| D10-006 | `DELETE /shipment-schedule/:id` Admin | 204 |
| D10-007 | `PATCH /shipments/:id` result Passed by QE/Admin | 200 + status updated |
| D10-008 | `PATCH /shipments/:id` result by Buyer | 403 |
| D10-009 | UI metrics cards visible | yes |
| D10-010 | UI two tables visible | requests + schedule |
| D10-011 | Pass/Fail buttons role-correct | only permitted roles |
| D10-012 | OTD increases when pass on/before schedule | correct metric effect |
| D10-013 | OTD late scenario | correctly classified late |
| D10-014 | FPY scenario with first-pass success | metric updates |
| D10-015 | Supplier filter affects tables/metrics | scoped correctly |

### 11.2 Records
| ID | Test | Expected |
|---|---|---|
| D10-016 | Supplier `POST /records` | 201 PENDING |
| D10-017 | Buyer upload unassigned supplier | 403 |
| D10-018 | Admin/QE approve record | status Approved |
| D10-019 | Admin/QE reject record | status Rejected |
| D10-020 | Viewer patch record status | 403 |
| D10-021 | Download file-backed record in scope | file downloaded |
| D10-022 | Download out-of-scope record | 403/404 |
| D10-023 | Records UI action parity with API | consistent |

### 11.3 Documents
| ID | Test | Expected |
|---|---|---|
| D10-024 | Viewer `GET /documents` | 200 list |
| D10-025 | Viewer `POST /documents` | 403 |
| D10-026 | QE/Admin `POST /documents` | 201 |
| D10-027 | Auditor download document | 200 file |
| D10-028 | Documents page create (allowed roles) | success |
| D10-029 | Documents page delete (allowed roles) | success |
| D10-030 | Documents page create for blocked role | hidden/blocked |

### 11.4 Internal Management
| ID | Test | Expected |
|---|---|---|
| D10-031 | Admin `GET /internal-docs` | 200 |
| D10-032 | QE `GET /internal-docs` | 403 |
| D10-033 | Admin `POST /internal-docs` | 201 |
| D10-034 | Admin delete internal doc | 204 |
| D10-035 | Non-admin open `/internal-management` | redirect |

---

## 12) Cross-Day Regression and Non-Functional

### 12.1 API/Build/Schema
| ID | Test | Expected |
|---|---|---|
| RG-001 | `GET /health` | 200 ok |
| RG-002 | Prisma migrate status | up-to-date |
| RG-003 | Seed rerun idempotency | no fatal errors |
| RG-004 | Client TypeScript check | clean |
| RG-005 | Server TypeScript check | clean |

### 12.2 Security
| ID | Test | Expected |
|---|---|---|
| RG-006 | Unauthorized no-token request | 401 |
| RG-007 | Role-violating write attempt | 403 |
| RG-008 | Buyer cross-supplier data access | blocked |
| RG-009 | Supplier cross-supplier data access | blocked |
| RG-010 | Admin-only delete as non-admin | 403 |
| RG-011 | Invalid ID tampering | 400/404 |
| RG-012 | Basic XSS string input in text fields | no script execution |

### 12.3 Data Integrity
| ID | Test | Expected |
|---|---|---|
| RG-013 | ID sequence uniqueness FIN/CAR/AUD/SUP | no duplicates |
| RG-014 | State transition integrity | invalid transitions rejected |
| RG-015 | Linked entities consistency | CAR links valid finding, finding links valid audit |
| RG-016 | Deleting referenced config item | blocked with clear error |

### 12.4 UX Consistency
| ID | Test | Expected |
|---|---|---|
| RG-017 | Toast/error messaging on failures | clear and actionable |
| RG-018 | Loading/disable during action submits | prevents double submit |
| RG-019 | Empty states in lists | user-friendly empty messages |
| RG-020 | Redirect targets by role | consistent default routes |

---

## 13) End-to-End Critical Journeys (Must Pass)

| ID | Journey | Steps | Expected |
|---|---|---|---|
| E2E-001 | Supplier lifecycle | Admin creates supplier -> assigns buyer -> supplier logs in | scope correct on both sides |
| E2E-002 | Audit to finding | Admin creates audit -> sets failed result -> create finding | finding linked to audit |
| E2E-003 | Finding to CAR | create/advance finding -> create CAR from finding | links and status flow correct |
| E2E-004 | CAR closure | CAR DRAFT -> RCCA -> WaitingApproval -> Closed | full transition success |
| E2E-005 | Shipment flow | supplier request + admin schedule + QE/Admin pass/fail | metrics update correctly |
| E2E-006 | Record flow | supplier upload -> admin/QE approve/reject -> download | full lifecycle works |
| E2E-007 | Document flow | QE/Admin create -> Viewer/Auditor read/download | RBAC enforced |
| E2E-008 | Internal docs flow | Admin create/list/delete + non-admin denied | admin-only guaranteed |
| E2E-009 | Buyer boundary | buyer tries all cross-supplier operations | consistently blocked |
| E2E-010 | Session/security boundary | expired token + unauthorized operations | logout + proper status codes |

---

## 14) Test Execution Sheet

| Field | Value |
|---|---|
| Build/Commit | |
| Environment | |
| DB Snapshot | |
| Tester | |
| Date | |

### Status Legend
- PASS
- FAIL
- BLOCKED
- NOT RUN

### Result Summary
- Total Cases:
- Passed:
- Failed:
- Blocked:
- Not Run:
- Pass Rate:

### Defect Log
| Defect ID | Case ID | Severity | Summary | Status |
|---|---|---|---|---|

---

## 15) Final Sign-off Checklist

- [ ] Day1 cases complete
- [ ] Day2 cases complete
- [ ] Day3 cases complete
- [ ] Day4 cases complete
- [ ] Day5 cases complete
- [ ] Day6 cases complete
- [ ] Day7 cases complete
- [ ] Day8 cases complete
- [ ] Day9 cases complete
- [ ] Day10 cases complete
- [ ] Regression suite complete
- [ ] Critical E2E journeys complete

**QA Lead:**  
**Engineering Lead:**  
**Date:**
