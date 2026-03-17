# Day 5 — Step-by-Step Testing Guide

Use this guide to verify Day 5 is aligned with requirements. Run every step and check the expected result.

---

## Prerequisites

### 1. Database and seed

```bash
cd E:\MVP\server
npx prisma migrate deploy
npx prisma db seed
```

You should see **Buyer assigned to SUP-TEST01 for scope testing** (so Buyer sees one supplier).

### 2. Start backend and frontend

**Terminal 1:** `cd E:\MVP\server` → `npm run dev`  
**Terminal 2:** `cd E:\MVP\client` → `npm run dev`  
**Browser:** http://localhost:5173

### 3. Test users

| Email                   | Password  | Role             |
|-------------------------|-----------|------------------|
| admin@sentinel.local    | Admin123! | Admin            |
| viewer@sentinel.local   | Test123!  | Viewer           |
| buyer@sentinel.local    | Test123!  | Buyer (assigned to SUP-TEST01) |
| supplier@sentinel.local | Test123!  | Supplier (linked to SUP-TEST01) |

You need a **Bearer token** for API tests. Easiest: log in in the app, then open DevTools → **Application** → **Local Storage** → key `sentinel_auth` → copy the `token` value from the JSON. Or use the steps below that use the **Supplier List page** (which calls the API with your token).

---

## 5.1 Core API structure

### 5.1.1 REST conventions — GET returns JSON

| Step | Action | Expected |
|------|--------|----------|
| 1 | Log in as **admin@sentinel.local**. Open DevTools → **Network**. | — |
| 2 | In the app, click **Supplier List** in the sidebar. | A request appears: **GET** to **auth/login** (if needed) or to **suppliers** (or similar). |
| 3 | Click the **suppliers** request; check **Response** tab. | Response is **JSON** (array of supplier objects with id, code, name, etc.). |
| 4 | (Optional) In a new tab go to **http://localhost:5173/me** — you’ll be redirected. Instead, in DevTools **Console** run: `fetch('/api/me', { headers: { 'Authorization': 'Bearer ' + JSON.parse(localStorage.getItem('sentinel_auth')).token } }).then(r=>r.json()).then(console.log)` | You see a JSON object (id, email, name, roleNames, etc.). |

**Pass / Fail:** _____

---

### 5.1.2 Error handling — API returns JSON error

| Step | Action | Expected |
|------|--------|----------|
| 1 | In DevTools **Console** run: `fetch('/api/suppliers').then(r=>r.json()).then(console.log)` (no Bearer token) | Response is JSON, e.g. `{ error: "Missing or invalid Authorization header" }` and status **401**. |
| 2 | Run: `fetch('/api/unknown-route').then(r=>r.json()).then(console.log)` | You get a 404 or similar; if the server returns JSON, body has an `error`-like field. |

**Pass / Fail:** _____

---

### 5.1.3 User/role on requests

| Step | Action | Expected |
|------|--------|----------|
| 1 | Log in as **buyer@sentinel.local**. Open **Supplier List** in the app. | Page loads; **only the supplier assigned to the buyer** (SUP-TEST01) is shown. This proves the backend used the user’s role and buyer scope. |
| 2 | Log in as **admin@sentinel.local**. Open **Supplier List**. | You see **all** suppliers (at least the seeded one). Proves Admin gets full scope. |

**Pass / Fail:** _____

---

## 5.2 Users and profile API

### 5.2.1 GET /me (current user)

| Step | Action | Expected |
|------|--------|----------|
| 1 | Log in as **admin@sentinel.local**. Open DevTools → **Console**. | — |
| 2 | Run: `fetch('/api/me', { headers: { 'Authorization': 'Bearer ' + JSON.parse(localStorage.getItem('sentinel_auth')).token } }).then(r=>r.json()).then(console.log)` | Status **200**; JSON has **id**, **email**, **name**, **roleNames** (e.g. ["Admin"]). |
| 3 | Log in as **buyer@sentinel.local**, run the same `fetch('/api/me', ...)` again (with new token). | Response includes **assignedSupplierIds** (array with one supplier id). |
| 4 | Log in as **supplier@sentinel.local**, run the same `fetch('/api/me', ...)`. | Response includes **supplier** (object with id, code, name). |

**Pass / Fail:** _____

---

### 5.2.2 GET /me without token

| Step | Action | Expected |
|------|--------|----------|
| 1 | In Console run: `fetch('/api/me').then(r=>r.status)` | Returns **401**. |
| 2 | Run: `fetch('/api/me').then(r=>r.json()).then(console.log)` | Body is JSON with **error** (e.g. "Missing or invalid Authorization header"). |

**Pass / Fail:** _____

---

### 5.2.3 GET /users (Admin only)

| Step | Action | Expected |
|------|--------|----------|
| 1 | Log in as **admin@sentinel.local**. In Console run: `fetch('/api/users', { headers: { 'Authorization': 'Bearer ' + JSON.parse(localStorage.getItem('sentinel_auth')).token } }).then(r=>r.json()).then(console.log)` | Status **200**; response is an **array** of users; each has **id**, **email**, **name**, **roleNames**, and optionally **supplier** and **assignedSupplierIds**. |

**Pass / Fail:** _____

---

### 5.2.4 GET /users as non-Admin

| Step | Action | Expected |
|------|--------|----------|
| 1 | Log out; log in as **viewer@sentinel.local**. In Console run: `fetch('/api/users', { headers: { 'Authorization': 'Bearer ' + JSON.parse(localStorage.getItem('sentinel_auth')).token } }).then(r=>r.status)` | Returns **403**. |
| 2 | Log in as **buyer@sentinel.local**, run the same. | Again **403**. |
| 3 | Log in as **supplier@sentinel.local**, run the same. | Again **403**. |

**Pass / Fail:** _____

---

### 5.2.5 User–Buyer/Supplier link in response

| Step | Action | Expected |
|------|--------|----------|
| 1 | As **Admin**, run GET /users (see 5.2.3) and look at one user who has role **Buyer**. | That user has **assignedSupplierIds** (array). |
| 2 | In the same list, look at the user who has role **Supplier**. | That user has **supplier** (object with id, code, name). |

**Pass / Fail:** _____

---

## 5.3 Suppliers API (read)

### 5.3.1 GET /suppliers as Admin

| Step | Action | Expected |
|------|--------|----------|
| 1 | Log in as **admin@sentinel.local**. In the app, open **Supplier List**. | Page shows a **table** of suppliers. |
| 2 | Check the list. | You see **at least one supplier** (e.g. SUP-TEST01 – Test Supplier). Admin sees all. |

**Pass / Fail:** _____

---

### 5.3.2 GET /suppliers as Buyer

| Step | Action | Expected |
|------|--------|----------|
| 1 | Log out; log in as **buyer@sentinel.local**. Open **Supplier List**. | Page loads without error. |
| 2 | Check the table. | You see **only one supplier** (SUP-TEST01), because the buyer is assigned only to that supplier. |

**Pass / Fail:** _____

---

### 5.3.3 GET /suppliers as Supplier

| Step | Action | Expected |
|------|--------|----------|
| 1 | Log out; log in as **supplier@sentinel.local**. Open **Supplier List** (Supplier has this in the menu). | Page loads. |
| 2 | Check the table. | You see **only the supplier linked to that user** (SUP-TEST01 – Test Supplier). |

**Pass / Fail:** _____

---

### 5.3.4 GET /suppliers/:id scope (Buyer)

| Step | Action | Expected |
|------|--------|----------|
| 1 | Log in as **buyer@sentinel.local**. | — |
| 2 | In Console run (use **code** SUP-TEST01 or the supplier’s **id**): `fetch('/api/suppliers/SUP-TEST01', { headers: { 'Authorization': 'Bearer ' + JSON.parse(localStorage.getItem('sentinel_auth')).token } }).then(r=>r.status)` | Returns **200** (Buyer can see assigned supplier). |
| 3 | Run with a **fake id/code**: `fetch('/api/suppliers/nonexistent-id-12345', { headers: { 'Authorization': 'Bearer ' + JSON.parse(localStorage.getItem('sentinel_auth')).token } }).then(r=>r.status)` | Returns **404** (Supplier not found). |

**Pass / Fail:** _____

---

### 5.3.5 GET /suppliers without token

| Step | Action | Expected |
|------|--------|----------|
| 1 | Log out (or use an incognito window). In Console run: `fetch('/api/suppliers').then(r=>r.status)` | Returns **401**. |

**Pass / Fail:** _____

---

## 5.4 Week 1 testing (manual)

### 5.4.1 Login as each role

| Step | Action | Expected |
|------|--------|----------|
| 1 | Log in as **admin@sentinel.local** | Redirected to Dashboard; full menu. |
| 2 | Log out; log in as **viewer@sentinel.local** | Redirected to Dashboard; menu without Internal Management / Admin. |
| 3 | Log out; log in as **qe@sentinel.local** | Same as Viewer (13 items). |
| 4 | Log out; log in as **auditor@sentinel.local** | Redirected to CAR Record; only 6 menu items. |
| 5 | Log out; log in as **buyer@sentinel.local** | Redirected to Dashboard; menu without Documents, Internal Management, Admin. |
| 6 | Log out; log in as **supplier@sentinel.local** | Redirected to Supplier Profile; only Supplier Profile, Records, Shipments. |

**Pass / Fail:** _____

---

### 5.4.2 Menu and page access

| Step | Action | Expected |
|------|--------|----------|
| 1 | As **Viewer**, type **http://localhost:5173/admin** in the address bar. | Redirected to **/dashboard** (no Admin access). |
| 2 | As **Supplier**, type **http://localhost:5173/dashboard**. | Redirected to **/supplier-profile**. |
| 3 | As **Auditor**, open **CAR Record** from the menu. | CAR Record placeholder page loads. |

**Pass / Fail:** _____

---

### 5.4.3 One API with Buyer scope (Supplier List)

| Step | Action | Expected |
|------|--------|----------|
| 1 | Log in as **admin@sentinel.local**. Open **Supplier List**. | Table shows **all** suppliers (at least SUP-TEST01). |
| 2 | Log in as **buyer@sentinel.local**. Open **Supplier List**. | Table shows **only** the assigned supplier (SUP-TEST01). |
| 3 | Log in as **supplier@sentinel.local**. Open **Supplier List**. | Table shows **only** the supplier linked to that user (SUP-TEST01). |

**Pass / Fail:** _____

---

## 5.5 Week 1 report

| Step | Action | Expected |
|------|--------|----------|
| 1 | Open **docs/Week1-Report.md** in the project. | File exists. |
| 2 | Skim the report. | It lists **completed tasks** for Days 1–5, **risks/blockers**, and **plan for Week 2 Day 1**. |

**Pass / Fail:** _____

---

## Sign-off

- [ ] 5.1 Core API: REST (GET/JSON), error handling (JSON error), user/role on requests (scope works).
- [ ] 5.2 Users: GET /me with token (200, profile); GET /me without token (401); GET /users Admin (200); GET /users non-Admin (403); Buyer/Supplier link in response.
- [ ] 5.3 Suppliers: Admin sees all; Buyer sees assigned; Supplier sees own; GET /suppliers/:id scope and 401 without token.
- [ ] 5.4 Week 1: Login each role; menu/redirects; Supplier List shows correct scope per role.
- [ ] 5.5 Week 1 report exists and is complete.

When all sections pass, **Day 5 is aligned with requirements.**
