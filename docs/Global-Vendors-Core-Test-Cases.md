# Global Vendors — Core manual test cases

Manual checks for the **Global Vendors** area (`/global-vendors` and sub-routes). APIs involved include `/farms`, `/farms/map`, `/purchase-orders`, `/samples`, `/expenses`, and `/farm-profile/...`.

Use a **Pass / Fail / Notes** column when you run the suite. Repeat access cases per role where permissions differ (see `server/src/lib/permissions.ts` and **Global Vendors — Permissions** at `/global-vendors/admin`).

---

## Access and navigation

| ID | Test case | Expected result |
|----|-----------|-----------------|
| A1 | Log in as a user **with** Global Vendors page roles (e.g. Farmer Information). Open Product Hub or go to `/global-vendors`. | Redirect lands on first allowed sub-page (typically **Farmer Information**), or each submenu opens without “no access”. |
| A2 | Log in as a user **without** any Global Vendors permissions. | **No access** (or redirect to default allowed area), not a broken page. |
| A3 | As Admin (or permitted role), open `/global-vendors/admin`. | **Global Vendors — Permissions** loads; role/page matrix behaves per `AdminPermissionsPanel` (view/update). |

---

## Farmer Information (`/global-vendors/farmers`)

| ID | Test case | Expected result |
|----|-----------|-----------------|
| F1 | Open the page. | Table lists farms from `GET /farms`; loading state, then data or empty state. |
| F2 | **Add farmer** (modal): fill required fields (farm name, farmer name, country; city optional), submit. | Success toast; new row appears; farm has a **code**. |
| F3 | Expand/edit a row: change extended fields (region, crops, lat/long, contact, etc.), **Save**. | `PATCH /farms/:id` succeeds; values persist after refresh. |
| F4 | From a row, open **Profile** and **Processing** links. | Navigate to `/global-vendors/farmers/:id/profile` and `/global-vendors/farmers/:id/processing` with correct farm. |

---

## Approved Farm List (`/global-vendors/approved`)

| ID | Test case | Expected result |
|----|-----------|-----------------|
| AP1 | With farms in the database. | Table shows farms with columns: Farm ID (code), name, category, country, region, main crop, elevation, production style. |
| AP2 | With no farms. | Message directs users to **Farmer Information** to add farms. |

---

## Farms Map (`/global-vendors/map`)

| ID | Test case | Expected result |
|----|-----------|-----------------|
| M1 | Farms **with** valid latitude and longitude. | `GET /farms/map` drives markers; map fits bounds or centers appropriately. |
| M2 | Farms missing coordinates or invalid numbers. | Those farms omitted from the map; page still loads without errors. |
| M3 | Marker / tooltip interaction. | Identifying info visible (e.g. code, farm name). |

---

## Relationship & Trust (`/global-vendors/relationship`)

| ID | Test case | Expected result |
|----|-----------|-----------------|
| R1 | Load the page. | All farms listed with relationship fields (first contact, last visit, visit count, status). |
| R2 | Edit fields for one farm, **Save**. | `PATCH /farms/:id` with relationship fields; success toast; values persist after reload. |

---

## Farmer Profile (`/global-vendors/farmers/:farmId/profile`)

| ID | Test case | Expected result |
|----|-----------|-----------------|
| P1 | Non-admin user. | Profile content and images display read-only where applicable. |
| P2 | **Admin**: edit body text, **Save**. | `PUT /farm-profile/:farmId/content` (section Profile); toast; text persists after reload. |
| P3 | **Admin**: upload an image. | Upload succeeds; image displays (correct API / image base URL). |

---

## Processing & Quality (`/global-vendors/farmers/:farmId/processing`)

| ID | Test case | Expected result |
|----|-----------|-----------------|
| PR1 | Load the page. | Four steps load: Primary processing, Secondary processing, Quality checks, Final packaging / storage (content + images per step). |
| PR2 | **Admin**: save text for each step. | `PUT` content per section; persists after reload. |
| PR3 | **Admin**: upload an image per step. | Images attach to the correct step and display after reload. |

---

## Purchase Orders (`/global-vendors/purchase-orders`)

| ID | Test case | Expected result |
|----|-----------|-----------------|
| PO1 | Load the page. | List and farm dropdown from `GET /purchase-orders` and `/farms`. |
| PO2 | **Create PO** with required fields (buyer, farm if required, dates/amounts as UI requires). | New row with **code**; appears in list. |
| PO3 | **Attach file** to an existing PO. | Upload to purchase order attachments; file listed on the row. |
| PO4 | Open or download attachment (if UI provides it). | File matches uploaded content. |

---

## Samples (`/global-vendors/samples`)

| ID | Test case | Expected result |
|----|-----------|-----------------|
| S1 | Load the page. | Samples list and farm list load. |
| S2 | **Create sample** without a notes file. | Row created; text fields stored as entered. |
| S3 | **Create sample** with a notes file. | Row shows **notes file name**; file stored; open/download if the UI exposes it. |

---

## Expenses (`/global-vendors/expenses`)

| ID | Test case | Expected result |
|----|-----------|-----------------|
| E1 | Load the page. | Only expenses with **`project === "Global Vendors"`** appear; **Total** equals the sum of those rows. |
| E2 | Add expense: description + numeric price. | `POST /expenses` with type and project **Global Vendors**; list and total update. |
| E3 | Expenses tied to **other** projects exist in the system. | They **do not** appear on this page (scoping is correct). |

---

## Cross-cutting

| ID | Test case | Expected result |
|----|-----------|-----------------|
| X1 | Create a farm on **Farmer Information**, then open **Approved** and **Map** (set lat/long for map). | New farm visible on Approved list and on map when coordinates are valid. |
| X2 | (Optional) Session with expired token. | API errors handled gracefully; user can re-authenticate; no silent corruption of data. |

---

## Document history

| Version | Date | Notes |
|---------|------|-------|
| 1.0 | 2026-04-03 | Initial core cases for Global Vendors manual QA. |
| 1.1 | 2026-04-03 | Moved from `document/` to `docs/` alongside other project test docs. |
