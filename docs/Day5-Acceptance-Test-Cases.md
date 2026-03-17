# Day 5 Acceptance Test Cases — Week 1 Wrap-up and API Foundations

**Project:** Sentinel Supplier Assurance Platform  
**Day:** 5 (Week 1)  
**Theme:** Week 1 wrap-up and API foundations  
**Reference:** Sentinel-Implementation-Plan.md (Day 5)

---

## 5.1 Core API structure

| # | Test | Steps | Expected |
|---|------|--------|----------|
| 5.1.1 | REST conventions | All read endpoints use GET; responses are JSON | GET /me, GET /users, GET /suppliers, GET /suppliers/:id return JSON. |
| 5.1.2 | Error handling | Trigger an error (e.g. invalid route, or 500 from server) | API returns JSON with `{ error: "..." }` and appropriate status. |
| 5.1.3 | User/role on requests | Call a protected endpoint with valid Bearer token | Request is authenticated; backend has access to user id, roleNames, supplierId/buyerId for scope. |

---

## 5.2 Users and profile API

| # | Test | Steps | Expected |
|---|------|--------|----------|
| 5.2.1 | GET /me (current user) | Log in, then GET /api/me with Bearer token | 200; body has id, email, name, roleNames, supplier (if Supplier), assignedSupplierIds (if Buyer). |
| 5.2.2 | GET /me without token | GET /api/me without Authorization header | 401. |
| 5.2.3 | GET /users (Admin only) | Log in as Admin, GET /api/users with Bearer token | 200; array of users with id, email, name, roleNames, supplier, assignedSupplierIds. |
| 5.2.4 | GET /users as non-Admin | Log in as Viewer/Buyer/Supplier, GET /api/users | 403 Forbidden. |
| 5.2.5 | User–Buyer/Supplier link | Inspect GET /me or GET /users response | Buyer has assignedSupplierIds; Supplier has supplier (id, code, name). |

---

## 5.3 Suppliers API (read)

| # | Test | Steps | Expected |
|---|------|--------|----------|
| 5.3.1 | GET /suppliers as Admin | Log in as Admin, GET /api/suppliers | 200; list of all suppliers (code, name, city, country, etc.). |
| 5.3.2 | GET /suppliers as Buyer | Log in as Buyer (with or without assignments), GET /api/suppliers | 200; only suppliers assigned to that buyer (or empty array). |
| 5.3.3 | GET /suppliers as Supplier | Log in as Supplier, GET /api/suppliers | 200; list containing only the supplier linked to that user. |
| 5.3.4 | GET /suppliers/:id scope | As Buyer, GET /api/suppliers/:id for an assigned supplier | 200; supplier detail. As Buyer, GET for non-assigned supplier id | 404. |
| 5.3.5 | GET /suppliers without token | GET /api/suppliers without Authorization | 401. |

---

## 5.4 Week 1 testing (manual)

| # | Test | Steps | Expected |
|---|------|--------|----------|
| 5.4.1 | Login as each role | Log in as Admin, Viewer, QE, Auditor, Buyer, Supplier | Each can log in and see role-appropriate menu and default page. |
| 5.4.2 | Menu and page access | For each role, open sidebar and try disallowed URLs | Menu shows only allowed pages; direct URL to disallowed page redirects to role default. |
| 5.4.3 | One API with Buyer scope | Assign a buyer to at least one supplier (e.g. via DB or seed). Log in as Buyer. Open Supplier List page. | Supplier List loads and shows only assigned supplier(s). Admin sees all; Supplier sees own. |

---

## 5.5 Week 1 report

- Deliverable: **docs/Week1-Report.md** with completed tasks, risks/blockers, plan for Week 2 Day 1.

---

## Sign-off

- [ ] 5.1 Core API: REST, error handling, user/role on requests.
- [ ] 5.2 Users API: GET /me, GET /users (Admin), Buyer/Supplier link in response.
- [ ] 5.3 Suppliers API: list and get one with scope (Admin/Buyer/Supplier).
- [ ] 5.4 Week 1 manual testing: login, menu, Supplier List API scope.
- [ ] 5.5 Week 1 report completed.

**End of Day 5:** Week 1 complete; APIs started; ready for Week 2.
