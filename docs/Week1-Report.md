# Sentinel Supplier Assurance Platform — Week 1 Report

**Period:** Week 1 (Days 1–5)  
**Theme:** Foundation, auth, app shell, API base  
**Reference:** Sentinel-Implementation-Plan.md

---

## Completed tasks

### Day 1 — Requirements and design
- Requirement traceability checklist
- Workflow mapping
- Role–page matrix (final)
- Data model draft
- Tech stack selection
- Day 1 acceptance test cases

### Day 2 — Architecture and database
- Architecture document
- Database schema (Prisma)
- ID format spec (SUP-, AUD-, TYP-, FIN-, CAR-)
- Migrations and repo structure (client/, server/)
- Day 2 acceptance test cases

### Day 3 — Auth and RBAC
- Prisma seed (roles + Admin + test users)
- Auth: POST /auth/login, POST /auth/register (JWT, bcrypt)
- Auth middleware (req.user: id, email, roleNames, roleIds, buyerId, supplierId)
- RBAC: requireRole, requirePageAccess (PAGE_ROLES)
- Scope service: getAssignedSupplierIds, getSupplierIdForUser, getAllowedSupplierIds
- GET /me, GET /suppliers (list + get one) with scope
- Day 3 acceptance test cases

### Day 4 — App shell and navigation
- Client: API client (apiFetch, apiJson, Bearer, 401 → logout)
- Role–page config (PATH_ROLES, getDefaultPath, canAccessPath)
- AuthContext (login, logout, localStorage, auth:logout)
- ProtectedRoute and Layout (role-based menu, path guards)
- Login page (Sentinel symbol, form, redirect by role)
- 15 placeholder pages + routing (Dashboard through Admin)
- Auditor/Supplier default path fix (no redirect loop on refresh)
- Day 4 acceptance test cases and step-by-step testing guide

### Day 5 — API foundations and Week 1 wrap-up
- Core API: asyncHandler for async routes, central errorHandler (JSON errors)
- Users API: GET /me (unchanged), GET /users (Admin only; id, email, name, roleNames, supplier, assignedSupplierIds)
- Suppliers API: GET /suppliers, GET /suppliers/:id with scope (Admin all; Buyer assigned; Supplier own)
- Supplier List page: fetches GET /suppliers and displays table (for scope testing)
- Day 5 acceptance test cases
- Week 1 report (this document)

---

## Risks and blockers

- **None critical.** Local PostgreSQL and seed must be run for full testing.
- **Deployment:** Not yet deployed; deployment approach documented (server + client + DB).

---

## Plan for Week 2 Day 1 (Day 6)

- **Theme:** Audits and Findings CRUD
- **Tasks:** Audits API (CRUD, schedule, results, status); Audits UI (table); Findings API (CRUD, status flow, approval); Findings list UI (stats, charts, table); Findings Record UI (form shell)
- **Deliverable:** Audits and Findings backend and list; Findings Record form in progress

---

## Sign-off

Week 1 objectives met: requirements and design (Day 1), architecture and DB (Day 2), auth and RBAC (Day 3), app shell and navigation (Day 4), API base and users/suppliers read APIs (Day 5). Ready to proceed to Week 2.
