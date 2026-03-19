# Day 9 — Step-by-step testing guide

**Theme:** Admin (audit types, risk weights, buyers/suppliers, permissions), Supplier portal (profile, records, shipment requests), supporting APIs.

**Full checklist:** [Day9-Acceptance-Test-Cases.md](./Day9-Acceptance-Test-Cases.md)

## Quick smoke (10 min)

1. **Admin** (all tabs load): Commodity / Defect / Disposition → **Audit types** → **Risk weights** (sum 100%) → **Buyers & suppliers** → **Permissions**.
2. **Create** test supplier + **Buyer** user + **assign** supplier to buyer; log in as **Buyer** → Supplier List shows supplier.
3. **Supplier** user → **Supplier Profile**: see metrics; **Submit record**; **Request shipment inspection**; confirm rows in tables.
4. Optional: `GET /risk-weights` and `PUT` with Admin token (API tool).

## Prerequisites

- Database migrated; `npx prisma db seed` recommended (risk weights row + test users).
- API and client running; `VITE_API_URL` if not same-origin.
