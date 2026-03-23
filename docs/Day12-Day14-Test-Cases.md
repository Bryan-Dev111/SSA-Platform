# Sentinel SSA - Day12 to Day14 Full Test Cases

Goal: maximum practical test coverage for Day 12 (Dashboard + Suppliers Map), Day 13 (Alerts + Preferences), and Day 14 (testing + bug-fix validation).

---

## 1) Test Environment

- Backend running (`server`)
- Frontend running (`client`)
- DB connected and seeded
- Roles available: Admin, Viewer, QualityEngineer, Auditor, Buyer, Supplier
- Buyer assignment data exists (at least one buyer with only subset of suppliers)
- At least 2 suppliers with different risk levels and locations
- At least one audit/findings/CAR/shipment/record/document row available

---

## 2) Day 12 - Dashboard API and UI

### 2.1 Dashboard API (`GET /dashboard`)

| ID | Test | Steps | Expected |
|---|---|---|---|
| D12-API-001 | Auth required | Call without token | 401 |
| D12-API-002 | Admin full scope | Call as Admin no query | All-scope metrics/charts |
| D12-API-003 | Buyer scoped | Call as Buyer no query | Assigned suppliers only |
| D12-API-004 | Viewer access | Call as Viewer | 200 (read-only scope) |
| D12-API-005 | Supplier filter valid | `?supplierId=<in-scope>` | Only selected supplier data |
| D12-API-006 | Supplier filter out of scope | Buyer with other supplierId | Zeroed response (no leakage) |
| D12-API-007 | Metrics shape | Inspect response | all required fields present |
| D12-API-008 | Chart shape | Inspect response | `topRiskSuppliers`, `upcomingEvents`, `monthlyTrends` present |
| D12-API-009 | Top risk ordering | Verify scores | descending by score |
| D12-API-010 | Upcoming events window | Validate dates | next 30 days only |
| D12-API-011 | Monthly trends horizon | Validate rows | last 6 months |
| D12-API-012 | Empty data safety | Run with empty scope | no crash, arrays empty |

### 2.2 Dashboard UI (`/dashboard`)

| ID | Test | Steps | Expected |
|---|---|---|---|
| D12-UI-001 | Page load | Open dashboard | cards/charts render |
| D12-UI-002 | Loading state | Refresh page | spinner/loading appears |
| D12-UI-003 | Error handling | stop backend then load | visible error message |
| D12-UI-004 | Supplier filter list | Open dropdown | suppliers in scope shown |
| D12-UI-005 | Supplier filter change | select supplier | metrics/charts refresh |
| D12-UI-006 | Top metrics | verify card values | match API values |
| D12-UI-007 | Top risk chart | verify bars | labels and score/level visible |
| D12-UI-008 | Upcoming events list | verify rows | date + type + code + supplier |
| D12-UI-009 | Monthly trends | verify table & bars | values consistent |
| D12-UI-010 | Buyer isolation | login buyer | no out-of-scope data |
| D12-UI-011 | Viewer behavior | login viewer | read-only, no edit controls |
| D12-UI-012 | Route guard | unauthorized role attempt | redirect/blocked per matrix |

---

## 3) Day 12 - Suppliers Map

### 3.1 Suppliers Map data and access

| ID | Test | Steps | Expected |
|---|---|---|---|
| D12-MAP-001 | Page access matrix | check roles vs route | Admin/Viewer/QE/Buyer allowed |
| D12-MAP-002 | Supplier blocked | open as Supplier | blocked/redirected |
| D12-MAP-003 | Data load | open page | supplier rows load |
| D12-MAP-004 | Risk load | verify risk badges/colors | color matches risk level |
| D12-MAP-005 | Buyer scope | open as Buyer | assigned suppliers only |
| D12-MAP-006 | Empty scope handling | user with no suppliers | empty state shown |

### 3.2 Real map behavior

| ID | Test | Steps | Expected |
|---|---|---|---|
| D12-MAP-007 | Tile rendering | open map area | map tiles visible |
| D12-MAP-008 | Marker rendering | verify suppliers with location | markers shown |
| D12-MAP-009 | Marker popup | click marker | supplier + risk details shown |
| D12-MAP-010 | Color coding | inspect high/medium/low | red/orange/yellow/green logic correct |
| D12-MAP-011 | Missing location fallback | supplier w/o city/country | no crash, listed in table |
| D12-MAP-012 | Map pan/zoom | interact map | smooth interaction, no errors |
| D12-MAP-013 | Geocode failure resilience | invalid location data | map still loads, no crash |
| D12-MAP-014 | Large supplier count | test many rows | acceptable performance |

---

## 4) Day 13 - Alerts and Preferences

### 4.1 Alert preferences API

| ID | Test | Steps | Expected |
|---|---|---|---|
| D13-PREF-001 | Get prefs auth | `GET /alerts/preferences` no token | 401 |
| D13-PREF-002 | Get prefs default | first-time user | all categories default true |
| D13-PREF-003 | Put prefs valid | toggle subset false | 200 + persisted |
| D13-PREF-004 | Read-after-write | GET after PUT | exactly saved values |
| D13-PREF-005 | Invalid payload | PUT malformed body | 400 |
| D13-PREF-006 | User isolation | set prefs as user A; GET user B | independent values |

### 4.2 Alert trigger coverage

| ID | Trigger | Steps | Expected alert category |
|---|---|---|---|
| D13-TRG-001 | Overdue audit | create audit in past with empty result | `overdueAudit` |
| D13-TRG-002 | Major finding | create Major finding | `majorCriticalFinding` |
| D13-TRG-003 | Critical finding | create Critical finding | `majorCriticalFinding` |
| D13-TRG-004 | Overdue CAR | create open CAR past target date | `overdueCAR` |
| D13-TRG-005 | Shipment inspection request | create shipment request | `shipmentInspectionRequest` |
| D13-TRG-006 | Rejected shipment | set shipment result Failed | `rejectedShipmentDocument` |
| D13-TRG-007 | Rejected record/document | reject record review | `rejectedShipmentDocument` |
| D13-TRG-008 | Late shipment | waiting shipment with past inspection date | `lateShipment` |
| D13-TRG-009 | No duplicate spam | repeat same trigger | deduped/controlled alert creation |
| D13-TRG-010 | Preference off | disable category then trigger | no new alert for that user |

### 4.3 In-app alert delivery (Dashboard widget)

| ID | Test | Steps | Expected |
|---|---|---|---|
| D13-UI-001 | Alert list visible | open dashboard | alert panel renders |
| D13-UI-002 | Order | inspect list | newest first |
| D13-UI-003 | Pref toggles UI | toggle checkbox | saved and reflected |
| D13-UI-004 | Pref rollback on API fail | force API error | UI rollback to previous state |
| D13-UI-005 | Empty alerts state | no alerts present | clean empty state |
| D13-UI-006 | Multi-role view | Admin/QE/Buyer/Auditor | role-appropriate alerts |

---

## 5) Day 14 - Workflow, Permission, Shipments/OTD, UI/UX Pass

### 5.1 End-to-end workflow tests

| ID | Workflow | Steps | Expected |
|---|---|---|---|
| D14-E2E-001 | Audit fail -> Finding -> CAR -> Closed | complete chain | linked records + valid status flow |
| D14-E2E-002 | Audit pass path | create passed audit no finding | no forced finding |
| D14-E2E-003 | Finding reverse limits | reverse near start | cannot reverse to New/DRAFT |
| D14-E2E-004 | CAR reverse limits | reverse near start | cannot reverse to DRAFT |
| D14-E2E-005 | Finding approval restriction | try approve as Auditor | blocked |
| D14-E2E-006 | CAR approval restriction | try approve as Viewer | blocked |
| D14-E2E-007 | Search-first CAR record flow | search + create from miss | expected UX behavior |
| D14-E2E-008 | Search-first Finding record flow | search + create from miss | expected UX behavior |

### 5.2 Permission tests

| ID | Permission area | Steps | Expected |
|---|---|---|---|
| D14-PERM-001 | Viewer edit attempt | try any mutate action | blocked |
| D14-PERM-002 | Buyer scope enforcement | access other supplier data | blocked |
| D14-PERM-003 | Supplier own-data only | try cross-supplier IDs | blocked |
| D14-PERM-004 | Admin-only deletes | non-admin delete API | 403 |
| D14-PERM-005 | Auditor audit-result setting | non-assigned auditor | blocked |
| D14-PERM-006 | Assigned auditor result setting | assigned auditor | allowed |
| D14-PERM-007 | QE result setting | QE update result | allowed |
| D14-PERM-008 | Admin page access | non-admin route | blocked |

### 5.3 Shipment and OTD/FPY tests

| ID | Scenario | Steps | Expected |
|---|---|---|---|
| D14-SHIP-001 | On-time pass | schedule + request same date then pass | OTD and FPY improve |
| D14-SHIP-002 | Late pass | request after schedule date | late count increments |
| D14-SHIP-003 | Failed inspection | set failed result | rejected/failure counts update |
| D14-SHIP-004 | Missing schedule counterpart | request only | no OTD false positives |
| D14-SHIP-005 | Supplier filter impact | switch filter | metrics/tables recalc correctly |
| D14-SHIP-006 | Scope on metrics API | buyer with assignment | no cross-supplier metrics |

### 5.4 UI/UX pass tests

| ID | UX rule | Steps | Expected |
|---|---|---|---|
| D14-UX-001 | Disabled buttons | invalid state/action | buttons disabled |
| D14-UX-002 | Required field validation | submit incomplete forms | clear validation errors |
| D14-UX-003 | No raw server errors | provoke not-found | user-friendly message only |
| D14-UX-004 | Table hover consistency | compare Findings/CAR tables | behavior consistent |
| D14-UX-005 | New-tab links | findings/car/audit links | open as required |
| D14-UX-006 | Toolbar alignments | CAR/Finding record search toolbars | single-line aligned controls |
| D14-UX-007 | Loading states | trigger long operation | spinner/loading feedback |
| D14-UX-008 | Toast consistency | create/update/delete | success/error toasts consistent |

---

## 6) Day 12-14 Regression Suite (High Priority)

| ID | Regression focus | Expected |
|---|---|---|
| RG12-14-001 | Dashboard route still protected | yes |
| RG12-14-002 | Suppliers Map route still protected | yes |
| RG12-14-003 | Existing Day1-11 APIs unaffected | build + smoke pass |
| RG12-14-004 | Alerts not breaking request flows | create/update flows still succeed |
| RG12-14-005 | Prisma transient connection handling | retries on transient disconnect |
| RG12-14-006 | Client builds after map+alerts | pass |
| RG12-14-007 | Server builds after alert routes | pass |
| RG12-14-008 | No linter errors in changed files | pass |

---

## 7) Execution Sheet

| Field | Value |
|---|---|
| Build ID | |
| Environment | |
| Tester | |
| Date | |
| Browser(s) | |

### Status Legend
- PASS
- FAIL
- BLOCKED
- NOT RUN

### Summary
- Total cases:
- Passed:
- Failed:
- Blocked:
- Not run:

### Defect log

| Defect ID | Test ID | Severity | Summary | Status |
|---|---|---|---|---|

