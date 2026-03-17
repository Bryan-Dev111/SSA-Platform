# Day 2 Deliverable 2.3 — ID Format Specification

**Project:** Sentinel Supplier Assurance Platform  
**Date:** March 17, 2026

Display IDs (codes) for entities: format, uniqueness, and implementation approach.

---

## Required formats (from requirements)

| Entity | Format | Example |
|--------|--------|---------|
| Supplier | SUP-00001 | SUP-00001, SUP-00002, … |
| Audit | AUD-00001 | AUD-00001, AUD-00002, … |
| Audit Type | TYP-00 | TYP-01, TYP-02, … (TYP-00 reserved if needed) |
| Finding | FIN-00001 | FIN-00001, FIN-00002, … |
| CAR | CAR-00001 | CAR-00001, CAR-00002, … |

---

## Implementation approach

### Option A: Database sequences (recommended)

- Create one PostgreSQL sequence per entity (e.g. `supplier_code_seq`, `audit_code_seq`).
- On insert, get next value and format: `SUP-` + LPAD(nextval('supplier_code_seq')::text, 5, '0').
- Prisma: use `@default(dbgenerated("..."))` or raw SQL in a transaction, or generate in application after insert using a small service.

### Option B: Application-level (this project)

- **Table:** Store last used number per prefix (e.g. `id_sequences`: prefix, last_value).
- **Service:** `generateCode(prefix: string): Promise<string>`:
  1. Lock row for prefix (or use transaction).
  2. Increment last_value.
  3. Return `PREFIX-` + pad(last_value, 5).
- **Usage:** Before creating Supplier/Audit/Finding/CorrectiveAction, call `generateCode('SUP')` etc. and set `code` field.

### Option C: Prisma + trigger (PostgreSQL)

- Use a PostgreSQL trigger + sequence per table to set `code` on INSERT. Prisma schema keeps `code` without @default; DB sets it.

---

## Recommended for Sentinel (Option B in code)

- **Helper module:** `server/src/services/idGenerator.ts` (or similar).
- **Storage:** Either a small table `IdSequence` (prefix, lastValue) or per-entity max query: `SELECT MAX(CAST(SUBSTRING(code FROM 5) AS INT)) FROM suppliers` then +1 and pad (less safe under concurrency; use transaction + lock or row lock).
- **Format helpers:**
  - SUP: 5 digits (00001–99999).
  - AUD: 5 digits.
  - TYP: 2 digits (TYP-01 to TYP-99).
  - FIN: 5 digits.
  - CAR: 5 digits.

**Example (pseudo):**

```ts
async function getNextCode(prefix: string, digits: number = 5): Promise<string> {
  const next = await prisma.$transaction(async (tx) => {
    const row = await tx.idSequence.upsert({ where: { prefix }, update: { lastValue: { increment: 1 } }, create: { prefix, lastValue: 1 } });
    return row.lastValue;
  });
  return `${prefix}-${String(next).padStart(digits, '0')}`;
}
```

Requires an **IdSequence** model (prefix String @id, lastValue Int). Add to schema if using this approach.

---

## Uniqueness

- All `code` columns are `@unique` in Prisma schema.
- Database unique index enforced by Prisma migration.

---

## When to generate

- **Supplier:** On create; set `code` before `prisma.supplier.create()`.
- **Audit:** On create.
- **Finding:** On save (Draft → Waiting Disposition); assign FIN-xxxxx when status first leaves DRAFT.
- **CorrectiveAction:** On save (Draft → RCCA); assign CAR-xxxxx when status first leaves DRAFT.
- **AuditType:** On create; TYP-01, TYP-02, … (or TYP-00 if required).

---

**Sign-off:** ID format spec complete; implementation in app layer (IdSequence + service) or DB sequences.
