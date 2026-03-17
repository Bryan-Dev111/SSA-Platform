# Day 4 — Step-by-Step Testing Guide

Use this guide to verify Day 4 is aligned with requirements. Run every step and check the expected result.

---

## Prerequisites

### 1. Database and seed (with test users)

```bash
cd E:\MVP\server
npx prisma migrate deploy
npx prisma db seed
```

You should see roles seeded and:

- `Admin user created: admin@sentinel.local` (or already exists)
- Test users created: `viewer@sentinel.local`, `qe@sentinel.local`, `auditor@sentinel.local`, `buyer@sentinel.local`, `supplier@sentinel.local`

**Passwords:**

| User                    | Password  | Role             |
|-------------------------|-----------|------------------|
| admin@sentinel.local    | Admin123! | Admin            |
| viewer@sentinel.local   | Test123!  | Viewer           |
| qe@sentinel.local       | Test123!  | Quality Engineer |
| auditor@sentinel.local  | Test123!  | Auditor          |
| buyer@sentinel.local    | Test123!  | Buyer            |
| supplier@sentinel.local | Test123!  | Supplier         |

### 2. Start backend and frontend

**Terminal 1 — server:**

```bash
cd E:\MVP\server
npm run dev
```

Wait until you see the server listening (e.g. port 4000).

**Terminal 2 — client:**

```bash
cd E:\MVP\client
npm run dev
```

Wait until Vite is ready (e.g. http://localhost:5173).

**Browser:** Use http://localhost:5173 (so `/api` is proxied to the server).

---

## 4.1 App shell (router, layout, protected route)

### 4.1.1 Router — unauthenticated redirect

| Step | Action | Expected |
|------|--------|----------|
| 1 | Open a new browser window (or incognito). | — |
| 2 | Go to **http://localhost:5173/** | Page loads. |
| 3 | Check URL and screen. | URL becomes **http://localhost:5173/login** and you see the **login page** (not the app layout). |

**Pass / Fail:** _____

---

### 4.1.2 Layout structure (Admin)

| Step | Action | Expected |
|------|--------|----------|
| 1 | On the login page, enter **admin@sentinel.local** and **Admin123!**, click **Sign in**. | You are redirected into the app. |
| 2 | Check URL. | URL is **http://localhost:5173/dashboard** (or similar). |
| 3 | Check left side. | **Sidebar** with “Sentinel” at top and a list of menu links (Dashboard, Risk, …). |
| 4 | Check top bar. | **Header** with “Supplier Assurance Platform”, your email, role(s), and a **Logout** button. |
| 5 | Check main area. | **Main content** shows a “Dashboard” heading and “Placeholder — content in later days.” |

**Pass / Fail:** _____

---

### 4.1.3 Protected route — no auth

| Step | Action | Expected |
|------|--------|----------|
| 1 | Click **Logout**. | You are on the login page. |
| 2 | In the address bar, type **http://localhost:5173/dashboard** and press Enter. | Page loads. |
| 3 | Check URL and screen. | You are **redirected to http://localhost:5173/login** (you do not see the dashboard). |

**Pass / Fail:** _____

---

### 4.1.4 Protected route — with auth (Dashboard)

| Step | Action | Expected |
|------|--------|----------|
| 1 | Log in again as **admin@sentinel.local** / **Admin123!**. | You land on the app. |
| 2 | Click **Dashboard** in the sidebar (or go to **http://localhost:5173/dashboard**). | URL is `/dashboard`. |
| 3 | Check main content. | Title “Dashboard” and text “Placeholder — content in later days.” inside the same layout (sidebar + header). |

**Pass / Fail:** _____

---

## 4.2 Navigation and menu (role-based)

For each role, log in and confirm the sidebar shows **only** the menu items listed below.

### 4.2.1 Admin menu

| Step | Action | Expected |
|------|--------|----------|
| 1 | Log in as **admin@sentinel.local** / **Admin123!**. | — |
| 2 | Look at the sidebar menu. | **All 15 items** visible: Dashboard, Risk, Corrective Actions, CAR Record, Findings, Findings Record, Audits, Supplier Profile, Supplier List, Suppliers Map, Records, Shipments, Documents, Internal Management, Admin. |

**Pass / Fail:** _____

---

### 4.2.2 Viewer menu

| Step | Action | Expected |
|------|--------|----------|
| 1 | Log out, then log in as **viewer@sentinel.local** / **Test123!**. | — |
| 2 | Look at the sidebar. | Same as Admin **except**: **no** “Internal Management”, **no** “Admin”. So 13 items. |

**Pass / Fail:** _____

---

### 4.2.3 Buyer menu

| Step | Action | Expected |
|------|--------|----------|
| 1 | Log out, then log in as **buyer@sentinel.local** / **Test123!**. | — |
| 2 | Look at the sidebar. | Same as Viewer (13 items). **No** Documents, **no** Internal Management, **no** Admin. |

**Pass / Fail:** _____

---

### 4.2.4 Quality Engineer menu

| Step | Action | Expected |
|------|--------|----------|
| 1 | Log out, then log in as **qe@sentinel.local** / **Test123!**. | — |
| 2 | Look at the sidebar. | Same as **Viewer**: 13 items (all except Internal Management and Admin). |

**Pass / Fail:** _____

---

### 4.2.5 Auditor menu

| Step | Action | Expected |
|------|--------|----------|
| 1 | Log out, then log in as **auditor@sentinel.local** / **Test123!**. | — |
| 2 | Look at the sidebar. | **Only 6 items**: CAR Record, Findings Record, Audits, Supplier Profile, Records, Documents. **No** Dashboard, Risk, Corrective Actions, Findings, Supplier List, Suppliers Map, Shipments. |

**Pass / Fail:** _____

---

### 4.2.6 Supplier menu

| Step | Action | Expected |
|------|--------|----------|
| 1 | Log out, then log in as **supplier@sentinel.local** / **Test123!**. | — |
| 2 | Check URL after login. | Redirected to **/supplier-profile** (not /dashboard). |
| 3 | Look at the sidebar. | **Only 3 items**: Supplier Profile, Records, Shipments. |

**Pass / Fail:** _____

---

## 4.3 Route guards

### 4.3.1 Supplier — direct URL to disallowed page

| Step | Action | Expected |
|------|--------|----------|
| 1 | Stay logged in as **supplier@sentinel.local**. | — |
| 2 | In the address bar go to **http://localhost:5173/dashboard**, press Enter. | URL changes to **http://localhost:5173/supplier-profile**; you see Supplier Profile placeholder, not Dashboard. |
| 3 | Go to **http://localhost:5173/risk**, press Enter. | Again redirected to **/supplier-profile**. |

**Pass / Fail:** _____

---

### 4.3.2 Supplier — allowed pages

| Step | Action | Expected |
|------|--------|----------|
| 1 | As Supplier, click **Records** in the sidebar. | Page shows “Records” and “Placeholder — content in later days.” |
| 2 | Click **Shipments**. | Page shows “Shipments” placeholder. |
| 3 | Click **Supplier Profile**. | Page shows “Supplier Profile” placeholder. |

**Pass / Fail:** _____

---

### 4.3.3 Buyer — no Documents

| Step | Action | Expected |
|------|--------|----------|
| 1 | Log out, log in as **buyer@sentinel.local** / **Test123!**. | — |
| 2 | In the address bar go to **http://localhost:5173/documents**, press Enter. | You are **redirected to /dashboard**; you do not see the Documents page. |

**Pass / Fail:** _____

---

### 4.3.4 Viewer — no Admin

| Step | Action | Expected |
|------|--------|----------|
| 1 | Log out, log in as **viewer@sentinel.local** / **Test123!**. | — |
| 2 | Go to **http://localhost:5173/admin**, press Enter. | You are **redirected to /dashboard**; you do not see the Admin page. |

**Pass / Fail:** _____

---

### 4.3.5 Auditor — no Dashboard

| Step | Action | Expected |
|------|--------|----------|
| 1 | Log out, log in as **auditor@sentinel.local** / **Test123!**. | — |
| 2 | Go to **http://localhost:5173/dashboard**, press Enter. | You are **redirected to /dashboard** (Auditor has no Dashboard access; default redirect is dashboard). You should still see the Auditor menu (only CAR Record, Findings Record, Audits, Supplier Profile, Records, Documents). |

**Pass / Fail:** _____

---

## 4.4 Placeholder pages (reachable by correct roles)

Use an **Admin** login so you can reach every page. For each row, open the URL and confirm the page title and placeholder text.

| # | Page              | Path to open                    | Expected title / content                    |
|---|-------------------|----------------------------------|---------------------------------------------|
| 1 | Dashboard         | /dashboard                       | “Dashboard” + placeholder text              |
| 2 | Risk              | /risk                            | “Risk” + placeholder                        |
| 3 | Corrective Actions| /corrective-actions              | “Corrective Actions” + placeholder         |
| 4 | CAR Record        | /car-record                      | “CAR Record” + placeholder                  |
| 5 | Findings          | /findings                        | “Findings” + placeholder                   |
| 6 | Findings Record   | /findings-record                 | “Findings Record” + placeholder            |
| 7 | Audits            | /audits                          | “Audits” + placeholder                      |
| 8 | Supplier Profile  | /supplier-profile                | “Supplier Profile” + placeholder           |
| 9 | Supplier List     | /supplier-list                   | “Supplier List” + placeholder               |
|10 | Suppliers Map     | /suppliers-map                   | “Suppliers Map” + placeholder               |
|11 | Records           | /records                         | “Records” + placeholder                     |
|12 | Shipments         | /shipments                       | “Shipments” + placeholder                   |
|13 | Documents         | /documents                       | “Documents” + placeholder                   |
|14 | Internal Management | /internal-management           | “Internal Management” + placeholder        |
|15 | Admin             | /admin                           | “Admin” + placeholder                       |

**Steps:** Log in as **admin@sentinel.local**. For each path above, type in the URL (e.g. http://localhost:5173/dashboard) and confirm the matching title and “Placeholder — content in later days.”

**Pass / Fail:** _____

---

## 4.5 Login page and flow

### 4.5.1 Sentinel symbol

| Step | Action | Expected |
|------|--------|----------|
| 1 | Log out if needed; go to **http://localhost:5173/login**. | Login page is visible. |
| 2 | Look for the Sentinel symbol. | A Sentinel symbol (e.g. “S” badge) is visible on the page. |

**Pass / Fail:** _____

---

### 4.5.2 Login form

| Step | Action | Expected |
|------|--------|----------|
| 1 | On the login page, check fields and button. | **Email** field, **Password** field, and **Sign in** button are present. |

**Pass / Fail:** _____

---

### 4.5.3 Auth API (valid credentials)

| Step | Action | Expected |
|------|--------|----------|
| 1 | Open DevTools (F12) → **Network** tab. | — |
| 2 | Enter **admin@sentinel.local** and **Admin123!**, click **Sign in**. | A request to **auth/login** (or **/api/auth/login**) with method **POST**; status **200**; response body contains **token** and **user** (with **roleNames**). You are redirected into the app (e.g. /dashboard). |

**Pass / Fail:** _____

---

### 4.5.4 Redirect — non-Supplier

| Step | Action | Expected |
|------|--------|----------|
| 1 | Log in as **admin@sentinel.local**. | Redirected to **/dashboard** (or the page you came from). |
| 2 | Log in as **viewer@sentinel.local**. | Redirected to **/dashboard**. |
| 3 | Log in as **buyer@sentinel.local**. | Redirected to **/dashboard**. |

**Pass / Fail:** _____

---

### 4.5.5 Redirect — Supplier

| Step | Action | Expected |
|------|--------|----------|
| 1 | Log in as **supplier@sentinel.local** / **Test123!**. | Immediately redirected to **/supplier-profile** (not /dashboard). |

**Pass / Fail:** _____

---

### 4.5.6 Invalid credentials

| Step | Action | Expected |
|------|--------|----------|
| 1 | Log out; go to login. | — |
| 2 | Enter **admin@sentinel.local** and **wrongpassword**, click **Sign in**. | An **error message** appears (e.g. “Invalid email or password” or “Login failed”). You **remain on the login page**; no redirect; no app layout. |
| 3 | Enter **nobody@sentinel.local** and **Test123!**, click **Sign in**. | Same: error, stay on login. |

**Pass / Fail:** _____

---

### 4.5.7 Already logged in

| Step | Action | Expected |
|------|--------|----------|
| 1 | Log in as **admin@sentinel.local**. | You are in the app (e.g. /dashboard). |
| 2 | In the address bar go to **http://localhost:5173/login**, press Enter. | You are **redirected away from login** (e.g. to /dashboard). You do not see the login form again. |
| 3 | Log in as **supplier@sentinel.local**, then go to **/login**. | Redirected to **/supplier-profile**. |

**Pass / Fail:** _____

---

## 4.6 API client and token

### 4.6.1 Bearer token on requests

| Step | Action | Expected |
|------|--------|----------|
| 1 | Log in as **admin@sentinel.local**. | — |
| 2 | Open DevTools → **Network**. | — |
| 3 | In the app, click a menu item that triggers an API call (e.g. **Supplier List** if it calls `/api/suppliers`). | A request is sent; in **Request Headers** you see **Authorization: Bearer &lt;token&gt;** (long string). |

**Pass / Fail:** _____

---

### 4.6.2 401 → logout (optional)

This needs a way to force 401 (e.g. invalidate token or stop server). Optional for Day 4.

| Step | Action | Expected |
|------|--------|----------|
| 1 | Log in, then in DevTools **Application** → **Local Storage** remove the key **sentinel_auth** (or change the token). | — |
| 2 | In the app, trigger an API call (e.g. refresh or open a page that fetches data). | Backend returns 401; client clears auth and redirects to **/login** (or shows login). |

**Pass / Fail:** _____ (or skip if not testing)

---

## Sign-off

- [ ] 4.1 App shell: router, layout, protected route
- [ ] 4.2 Menu matches role for Admin, Viewer, Buyer, QE, Auditor, Supplier
- [ ] 4.3 Route guards: Supplier restricted; Buyer no Documents; Viewer no Admin; Auditor no Dashboard
- [ ] 4.4 All 15 placeholder pages reachable (as Admin)
- [ ] 4.5 Login: symbol, form, API, redirect by role, error on invalid, redirect when already logged in
- [ ] 4.6 API sends Bearer token (4.6.2 optional)

When all sections pass, **Day 4 is aligned with requirements.**
