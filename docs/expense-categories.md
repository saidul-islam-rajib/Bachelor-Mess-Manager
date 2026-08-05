# Per-group cost types

The "Record a bill" dropdown used to be the hard-coded `EXPENSE_TYPES` enum: rent, electricity, water, waste, chef,
wifi, other. Every mess got the same seven whether or not they paid for any of them, and a mess that bought gas
cylinders had to file them under "Other".

Cost types are now per group and owned by the supervisor.

## Model

`ExpenseCategory` — `groupId`, `code`, `label`, `isSystem`, `sortOrder`, `archivedAt`, unique on `(groupId, code)`.

`ExpenseEntry.type` is still a plain string holding the code, so no existing row had to be migrated and no join was
added to the settlement hot path.

`ensureCategories(groupId)` seeds the built-in list on first read, so groups created before this change get the same
seven options they always had, and only diverge if their supervisor edits them.

## The important consequence

"A bill" used to mean `type IN (RENT, ELECTRICITY, ...)`. With custom codes that test silently excludes any bill filed
under a new type — it would have been recorded, shown on the bills page, and then **left out of everybody's share**.

The definition is now `type != 'BAZAR'`, expressed once as `BILL_TYPE_FILTER` in `src/lib/constants.ts` and used
everywhere that splits bazar from bills:

- `src/lib/settlement.ts` — bill shares and per-type totals
- `src/lib/bills.ts` — `billSharesByUser`, `billTotalsByType`, `isBillType`
- `src/pages/api/groups/[id]/bills.ts` — the month listing
- `src/pages/api/bills/[id].ts` — the "is this actually a bill" guard

Bazar remains the one reserved code. It cannot be added as a cost type, because it is priced by meals rather than
split as a bill.

## API

| Route | Method | Who | Does |
| --- | --- | --- | --- |
| `/api/groups/[id]/categories` | GET | any member | list (supervisors also get `inUse` counts) |
| `/api/groups/[id]/categories` | POST | supervisor | add by label; code is derived (`Gas cylinder` → `GAS_CYLINDER`) |
| `/api/expense-categories/[id]` | PATCH | supervisor | rename, reorder, archive/restore |
| `/api/expense-categories/[id]` | DELETE | supervisor | archive if used, hard delete if unused |

Creating a label whose code matches an archived category restores it rather than erroring.

## Delete means archive, when it has to

A type used by real bills is **archived**, not deleted: it disappears from the dropdown, but historical bills keep the
label they were filed under. Deleting outright would leave old rows pointing at a code with no label, and reporting
would start showing raw codes for months people had already settled.

A type nothing references is deleted properly. The last remaining active type cannot be removed, or bills could not be
recorded at all.

Bills whose type has since been archived still render their label, and the edit form keeps the old value as a
`(retired)` option so saving an unrelated field does not silently reassign the bill's category.

`expenseTypeLabel()` in `src/lib/constants.ts` prettifies an unknown code (`GAS_CYLINDER` → `Gas cylinder`) for the
dashboard, which aggregates across groups and so has no single group's label map to hand.

## Limits

40 characters per label, 40 active types per group, XSS-screened via `containsXss` on the same path as other
free-text input.
