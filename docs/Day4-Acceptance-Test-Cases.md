# Day 4 Acceptance Test Cases — Core Application Layout and Navigation

**Project:** Sentinel Supplier Assurance Platform  
**Day:** 4 (Week 1)  
**Theme:** Core application layout and navigation  
**Reference:** Sentinel-Implementation-Plan.md (Day 4), Day1-Role-Page-Matrix-Final.md

---

## 4.1 App shell (router, layout, protected route)

| # | Test | Steps | Expected |
|---|------|--------|----------|
| 4.1.1 | Router present | Open app at `/` | App loads; unauthenticated user is redirected to `/login`. |
| 4.1.2 | Layout structure | Log in as Admin | Sidebar (Sentinel branding + nav), header (title + user + Logout), main content area visible. |
| 4.1.3 | Protected route — no auth | Visit `/dashboard` while logged out | Redirect to `/login` (optionally with `from` state). |
| 4.1.4 | Protected route — with auth | Log in as Admin, visit `/dashboard` | Dashboard placeholder page renders inside layout. |

---

## 4.2 Navigation and menu (role-based)

| # | Test | Steps | Expected |
|---|------|--------|----------|
| 4.2.1 | Admin menu | Log in as Admin | All 15 app pages visible in sidebar (Dashboard through Admin). |
| 4.2.2 | Viewer menu | Log in as Viewer | All pages except Internal Management and Admin (per matrix). |
| 4.2.3 | Buyer menu | Log in as Buyer | No Documents, no Internal Management, no Admin; all others visible. |
| 4.2.4 | Quality Engineer menu | Log in as Quality Engineer | Same as Viewer (all except Internal Management, Admin). |
| 4.2.5 | Auditor menu | Log in as Auditor | Only: CAR Record, Findings Record, Audits, Supplier Profile, Records, Documents (no Dashboard, Risk, Corrective Actions, Findings, Supplier List, Suppliers Map, Shipments). |
| 4.2.6 | Supplier menu | Log in as Supplier | Only: Supplier Profile, Records, Shipments. |

---

## 4.3 Route guards

| # | Test | Steps | Expected |
|---|------|--------|----------|
| 4.3.1 | Supplier direct URL | As Supplier, navigate to `/dashboard` or `/risk` | Redirect to `/supplier-profile`. |
| 4.3.2 | Supplier allowed | As Supplier, go to `/records` or `/shipments` | Page loads (placeholder). |
| 4.3.3 | Buyer no Documents | As Buyer, navigate to `/documents` | Redirect to `/dashboard`. |
| 4.3.4 | Viewer no Admin | As Viewer, navigate to `/admin` | Redirect to `/dashboard`. |
| 4.3.5 | Auditor no Dashboard | As Auditor, navigate to `/dashboard` | Redirect to `/dashboard` (Auditor has no Dashboard access; redirect to default). |

---

## 4.4 Placeholder pages (all reachable by correct roles)

| # | Page | Path | Roles that must see it |
|---|------|------|------------------------|
| 1 | Dashboard | `/dashboard` | Admin, Viewer, Quality Engineer, Buyer |
| 2 | Risk | `/risk` | Admin, Viewer, Quality Engineer, Buyer |
| 3 | Corrective Actions | `/corrective-actions` | Admin, Viewer, Quality Engineer, Buyer |
| 4 | CAR Record | `/car-record` | Admin, Viewer, Quality Engineer, Auditor, Buyer |
| 5 | Findings | `/findings` | Admin, Viewer, Quality Engineer, Buyer |
| 6 | Findings Record | `/findings-record` | Admin, Viewer, Quality Engineer, Auditor, Buyer |
| 7 | Audits | `/audits` | Admin, Viewer, Quality Engineer, Auditor, Buyer |
| 8 | Supplier Profile | `/supplier-profile` | All (including Supplier) |
| 9 | Supplier List | `/supplier-list` | Admin, Viewer, Quality Engineer, Buyer |
| 10 | Suppliers Map | `/suppliers-map` | Admin, Viewer, Quality Engineer, Buyer |
| 11 | Records | `/records` | Admin, Viewer, Quality Engineer, Auditor, Buyer, Supplier |
| 12 | Shipments | `/shipments` | Admin, Viewer, Quality Engineer, Buyer, Supplier |
| 13 | Documents | `/documents` | Admin, Viewer, Quality Engineer, Auditor |
| 14 | Internal Management | `/internal-management` | Admin only |
| 15 | Admin | `/admin` | Admin only |
| 16 | Log in | `/login` | All (public) |

**Test:** For each role, only the pages listed in the matrix are reachable; direct URL to a disallowed page results in redirect (Supplier → `/supplier-profile`, others → `/dashboard`).

---

## 4.5 Login page and flow

| # | Test | Steps | Expected |
|---|------|--------|----------|
| 4.5.1 | Sentinel symbol | Open `/login` | Sentinel symbol (e.g. “S” badge) visible on login page. |
| 4.5.2 | Login form | On `/login` | Email and Password fields; Sign in button. |
| 4.5.3 | Auth API | Submit valid credentials (e.g. admin@sentinel.local / Admin123!) | POST to `/api/auth/login`; 200 with `user` and `token`; token and user stored; redirect. |
| 4.5.4 | Redirect — non-Supplier | Log in as Admin/Viewer/QE/Auditor/Buyer | Redirect to `/dashboard` (or `from` if present). |
| 4.5.5 | Redirect — Supplier | Log in as Supplier | Redirect to `/supplier-profile`. |
| 4.5.6 | Invalid credentials | Submit wrong email/password | Error message shown; no redirect; no token stored. |
| 4.5.7 | Already logged in | Visit `/login` when token/user present | Redirect to `/dashboard` (or `/supplier-profile` for Supplier). |

---

## 4.6 API client and token

| # | Test | Steps | Expected |
|---|------|--------|----------|
| 4.6.1 | Authenticated requests | After login, trigger any API call that uses `apiJson`/`apiFetch` | `Authorization: Bearer <token>` sent. |
| 4.6.2 | 401 handling | Backend returns 401 | Client clears auth and dispatches `auth:logout` (user sent to login). |

---

## Sign-off

- [ ] 4.1 App shell: router, layout, protected route working.
- [ ] 4.2 Menu matches role–page matrix for all six roles.
- [ ] 4.3 Route guards: Supplier restricted to profile/records/shipments; others per matrix.
- [ ] 4.4 All 16 pages exist and are reachable by correct roles.
- [ ] 4.5 Login page has Sentinel symbol, form, auth API, redirect by role.
- [ ] 4.6 API client sends Bearer token; 401 triggers logout.

**End of Day 4:** User can log in and see role-appropriate menu and placeholder pages.
