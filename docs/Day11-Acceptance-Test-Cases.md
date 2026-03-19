# Day 11 - Full Acceptance Test Cases (Maximum Coverage)
## Sentinel Supplier Assurance Platform

**Day 11 scope:** Risk calculation and Risk page  
**Plan reference:** Day 11 in `Sentinel-Implementation-Plan.md`

---

## 1) Objectives

Validate that:
1. Risk score calculation is correct and uses Admin-configured weights
2. Risk level classification (Low/Medium/High) is correct
3. Risk APIs work with RBAC + supplier scope
4. Risk page UI shows required stats, distribution, top suppliers, tables, and input forms
5. Risk is visible on Supplier List and Supplier Profile
6. Buyer scope and Supplier restrictions are enforced
7. Error handling and runtime behavior are stable

---

## 2) Test Users

- Admin: `admin@sentinel.local / Admin123!`
- Quality Engineer: `qe@sentinel.local / Test123!`
- Viewer: `viewer@sentinel.local / Test123!`
- Buyer: `buyer@sentinel.local / Test123!`
- Auditor: `auditor@sentinel.local / Test123!`
- Supplier: `supplier@sentinel.local / Test123!`

---

## 3) Preconditions

1. Backend running
2. Frontend running
3. DB reachable
4. Seeded data exists:
   - >=2 suppliers
   - Buyer assigned to subset of suppliers
   - Findings/Audits/CARs/Shipments/Records available for at least one supplier
5. Risk weights row exists (or auto-created via API)

---

## 4) API Test Cases - Risk Weights

| ID | Role | Action | Expected |
|---|---|---|---|
| D11-RW-01 | None | `GET /risk-weights` without token | 401 |
| D11-RW-02 | Admin | `GET /risk-weights` | 200, returns 5 percentages |
| D11-RW-03 | Viewer | `GET /risk-weights` | 200 (read allowed) |
| D11-RW-04 | Buyer | `GET /risk-weights` | 200 (read allowed) |
| D11-RW-05 | Supplier | `GET /risk-weights` | 403 |
| D11-RW-06 | Admin | `PUT /risk-weights` valid sum=100 | 200, persisted |
| D11-RW-07 | Admin | `PUT` sum != 100 (e.g. 99) | 400 |
| D11-RW-08 | Admin | `PUT` negative value | 400 |
| D11-RW-09 | Admin | `PUT` >100 value | 400 |
| D11-RW-10 | QE | `PUT /risk-weights` valid payload | 403 |
| D11-RW-11 | Buyer | `PUT /risk-weights` valid payload | 403 |
| D11-RW-12 | Admin | `PUT` then `GET` | Returned values match saved values |

---

## 5) API Test Cases - Current Risk Calculation

| ID | Role | Action | Expected |
|---|---|---|---|
| D11-RC-01 | None | `GET /risk-snapshots/current` no token | 401 |
| D11-RC-02 | Admin | `GET /risk-snapshots/current` | 200, all in-scope suppliers |
| D11-RC-03 | QE | `GET /risk-snapshots/current` | 200, all in-scope suppliers |
| D11-RC-04 | Viewer | `GET /risk-snapshots/current` | 200 (read only) |
| D11-RC-05 | Buyer | `GET /risk-snapshots/current` | 200, only assigned suppliers |
| D11-RC-06 | Supplier | `GET /risk-snapshots/current` | 403 (no Risk page access) or blocked route |
| D11-RC-07 | Admin | `GET /risk-snapshots/current?supplierId=<valid>` | 200, one supplier |
| D11-RC-08 | Buyer | `GET current` with out-of-scope supplierId | 404 |
| D11-RC-09 | Admin | Validate response shape | `supplier`, `score`, `level`, `factors` present |
| D11-RC-10 | Admin | Validate factors range | each factor is numeric, 0..100 |
| D11-RC-11 | Admin | Validate score range | score numeric, 0..100 |
| D11-RC-12 | Admin | Validate level enum | only Low/Medium/High |
| D11-RC-13 | Admin | Make data change (e.g., add failed shipment), re-read current | score/level reflects change |

---

## 6) API Test Cases - Risk Snapshot Recalculation

| ID | Role | Action | Expected |
|---|---|---|---|
| D11-RS-01 | None | `POST /risk-snapshots/recalculate` no token | 401 |
| D11-RS-02 | Admin | `POST /risk-snapshots/recalculate` no body | 201, snapshots created for in-scope suppliers |
| D11-RS-03 | QE | same call | 201 (allowed) |
| D11-RS-04 | Buyer | same call | 201 for assigned suppliers only |
| D11-RS-05 | Viewer | same call | 403 |
| D11-RS-06 | Auditor | same call | 403 |
| D11-RS-07 | Admin | `POST ... { supplierId }` valid | 201, one snapshot result |
| D11-RS-08 | Buyer | `POST ... { out-of-scope supplierId }` | 403 |
| D11-RS-09 | Admin | After recalc, `GET /risk-snapshots` | newest snapshot rows exist |
| D11-RS-10 | Admin | Recalculate repeatedly | stable behavior, no malformed response |

---

## 7) API Test Cases - Risk/Opportunity Items (Opportunities API)

| ID | Role | Action | Expected |
|---|---|---|---|
| D11-OP-01 | None | `GET /opportunities` no token | 401 |
| D11-OP-02 | Viewer | `GET /opportunities` | 200, read only |
| D11-OP-03 | Buyer | `GET /opportunities` | 200, assigned suppliers only |
| D11-OP-04 | Admin | `GET /opportunities?type=risk` | only `risk` rows |
| D11-OP-05 | Admin | `GET /opportunities?type=opportunity` | only `opportunity` rows |
| D11-OP-06 | Admin | `GET /opportunities?supplierId=<id>` | rows for supplier only |
| D11-OP-07 | Buyer | `GET` with out-of-scope supplierId | empty list |
| D11-OP-08 | Admin | `POST /opportunities` valid risk row | 201 |
| D11-OP-09 | QE | `POST` valid opportunity row | 201 |
| D11-OP-10 | Buyer | `POST` valid row in-scope | 201 |
| D11-OP-11 | Viewer | `POST` valid row | 403 |
| D11-OP-12 | Admin | `POST` missing `supplierId` | 400 |
| D11-OP-13 | Admin | `POST` missing `description` | 400 |
| D11-OP-14 | Admin | `POST` invalid `type` | 400 |
| D11-OP-15 | Buyer | `POST` out-of-scope supplier | 403 |
| D11-OP-16 | Admin/QE/Buyer | `PATCH /opportunities/:id` description | 200 |
| D11-OP-17 | Admin/QE/Buyer | `PATCH` type change | 200 |
| D11-OP-18 | Viewer | `PATCH` any row | 403 |
| D11-OP-19 | Buyer | `PATCH` out-of-scope row | 404 |
| D11-OP-20 | Admin | `PATCH` empty description | 400 |
| D11-OP-21 | Admin | `PATCH` invalid type | 400 |
| D11-OP-22 | Admin | `DELETE /opportunities/:id` | 204 |
| D11-OP-23 | QE | `DELETE /opportunities/:id` | 403 |
| D11-OP-24 | Buyer | `DELETE /opportunities/:id` | 403 |

---

## 8) Risk Formula Verification Cases

Use a controlled supplier dataset to verify calculation behavior.

| ID | Setup | Expected |
|---|---|---|
| D11-FM-01 | Supplier with no findings/audits/shipments/cars/records | score computes safely (no NaN), valid level |
| D11-FM-02 | Add major+critical open findings | quality factor increases |
| D11-FM-03 | Close those findings | quality factor decreases |
| D11-FM-04 | Add failed/cancelled audits | audit factor increases |
| D11-FM-05 | Add failed shipments | delivery factor increases |
| D11-FM-06 | Keep many CARs non-closed | CAR closure factor increases |
| D11-FM-07 | Add rejected records | documentation factor increases |
| D11-FM-08 | Increase one weight in risk-weights | total score shifts according to that factor |
| D11-FM-09 | Set one weight near zero | corresponding factor impact becomes minimal |
| D11-FM-10 | Recalculate after each change | current score/level and snapshot trend update correctly |

---

## 9) UI Test Cases - Risk Page

| ID | Role | Step | Expected |
|---|---|---|---|
| D11-UI-01 | Admin | Open `/risk` | Page loads (not placeholder) |
| D11-UI-02 | QE | Open `/risk` | Page loads |
| D11-UI-03 | Viewer | Open `/risk` | Page loads read-only |
| D11-UI-04 | Buyer | Open `/risk` | Page loads, scoped suppliers only |
| D11-UI-05 | Supplier | Open `/risk` via URL | blocked/redirected |
| D11-UI-06 | Admin | Check top stats cards | score/open risks/mitigated/opportunities visible |
| D11-UI-07 | Admin | Check distribution section | Low/Medium/High counts visible |
| D11-UI-08 | Admin | Check top-risk suppliers block | sorted list present |
| D11-UI-09 | Admin | Check risk score table | supplier, score, level, factors columns |
| D11-UI-10 | Admin | Supplier filter = one supplier | all widgets/tables scope correctly |
| D11-UI-11 | Buyer | Supplier filter options | only assigned suppliers shown |
| D11-UI-12 | Admin | Click Recalculate risk | success toast + refreshed values |
| D11-UI-13 | Buyer | Recalculate button | hidden/disabled per role behavior |
| D11-UI-14 | Admin/QE/Buyer | Add new risk item form | can submit successfully |
| D11-UI-15 | Viewer | Add form visibility | not shown |
| D11-UI-16 | Admin/QE/Buyer | Edit existing item | save success + table refresh |
| D11-UI-17 | Input validation | submit empty description | blocked or API error shown |
| D11-UI-18 | Error path | simulate API 503 | clean error message shown, no crash |

---

## 10) UI Test Cases - Supplier List Risk Display

| ID | Role | Step | Expected |
|---|---|---|---|
| D11-SL-01 | Admin | Open Supplier List | Risk level column visible |
| D11-SL-02 | Buyer | Open Supplier List | Risk level visible for assigned suppliers only |
| D11-SL-03 | Viewer | Open Supplier List | Risk level visible (read-only) |
| D11-SL-04 | Supplier | Open Supplier List | route blocked per matrix |
| D11-SL-05 | Any allowed | Compare row risk vs `/risk-snapshots/current` | values consistent |
| D11-SL-06 | Admin | Update risk via recalc, refresh list | displayed risk updates |

---

## 11) UI Test Cases - Supplier Profile Risk Display

| ID | Role | Step | Expected |
|---|---|---|---|
| D11-SP-01 | Supplier | Open Supplier Profile | current risk metric visible |
| D11-SP-02 | Supplier | Compare with latest snapshot | level/score matches latest |
| D11-SP-03 | Supplier | No risk snapshots exists | fallback shown (`—`) gracefully |
| D11-SP-04 | Non-supplier | Open Supplier Profile | non-supplier message/flow unchanged |

---

## 12) RBAC and Scope Deep Checks

| ID | Case | Expected |
|---|---|---|
| D11-RB-01 | Buyer cannot read risk data for unassigned supplier via query param | 404 or empty |
| D11-RB-02 | Buyer cannot create/update risk item for unassigned supplier | 403/404 |
| D11-RB-03 | Viewer can view risk tables but cannot create/update/delete | create/edit controls absent + API 403 |
| D11-RB-04 | Supplier cannot access Risk route/APIs | blocked by route guards/page access |
| D11-RB-05 | Admin can access all risk suppliers and controls | full access |
| D11-RB-06 | QE can create/update items but cannot delete opportunity (admin-only delete) | 403 on delete |

---

## 13) Negative / Failure / Stability Cases

| ID | Case | Expected |
|---|---|---|
| D11-NG-01 | Invalid token on risk endpoints | 401 |
| D11-NG-02 | DB unavailable on risk endpoints | 503 + clean message |
| D11-NG-03 | DB unavailable on risk page load | page shows clean error; no app crash |
| D11-NG-04 | Rapid recalculate clicks | stable UI; no double-submit corruption |
| D11-NG-05 | Large supplier count | endpoint responds without timeout/crash |
| D11-NG-06 | Unexpected empty data sets | UI sections show graceful empty states |
| D11-NG-07 | Extremely long risk/opportunity text | stored/displayed safely |
| D11-NG-08 | HTML/script in description | rendered as text; no script execution |

---

## 14) Performance/Behavior Observability (Optional)

| ID | Check | Expected |
|---|---|---|
| D11-PF-01 | Risk page load latency baseline | acceptable under normal DB conditions |
| D11-PF-02 | Recalculate for all suppliers | completes without server crash |
| D11-PF-03 | Server logs under normal risk load | no repeated stack spam |
| D11-PF-04 | API response sizes | reasonable payload for UI |

---

## 15) Day 11 Sign-off Matrix

| Area | Cases | Pass? |
|---|---|---|
| Risk Weights API | D11-RW-* | ☐ |
| Current Risk API | D11-RC-* | ☐ |
| Recalculate API | D11-RS-* | ☐ |
| Opportunities API | D11-OP-* | ☐ |
| Formula behavior | D11-FM-* | ☐ |
| Risk Page UI | D11-UI-* | ☐ |
| Supplier List/Profile risk display | D11-SL-*, D11-SP-* | ☐ |
| RBAC and scope | D11-RB-* | ☐ |
| Negative/stability | D11-NG-* | ☐ |

**Tester:** __________  
**Date:** __________  
**Build/Commit:** __________
