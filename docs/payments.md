# Payments

`/bills` and `/expenses` record what the mess **spent**. `/payments` records
what members actually **handed over**, and shows the one number everybody cares
about: who still owes what.

Page: `/payments`. API: `/api/groups/[id]/payments` and `/api/payments/[id]`.
The maths behind it lives in [settlement.md](settlement.md).

## The model

A payment is a `PaymentStatus` row: member, group, amount, and `dueDate` — the
day the cash changed hands, which is also what decides the month it counts in.
`amountDue` and `amountPaid` are both set to the amount and the status to
`PAID`, because this table records money *received*, not an invoice.

There is no "partially paid" record to maintain: a member who pays in three
instalments has three rows, and their outstanding balance is a calculation, not
a stored field. Nothing to keep in sync, nothing to drift.

## What the page shows

`GET` returns the whole month in one response, built by `buildGroupReport()`:
per member their meals, carry-in, meal cost, bill share, bazar they bought, cash
collected, what is still due and a status; plus group totals and the per-day
table. The page needs no second request to render, and the numbers cannot
disagree with each other because they come from one report.

Status per member:

| Status | Meaning |
| --- | --- |
| `PAID` | settled, or the mess owes them |
| `PARTIAL` | some cash in, some still due |
| `UNPAID` | nothing paid yet this month |

A **negative** due means the member is owed a refund — they bought more bazar
than they ate. `totals.refunds` sums those separately from `totals.outstanding`,
so a mess where one person is owed 500৳ and another owes 500৳ does not look
settled when it is not.

## Who can do what

| Action | Who |
| --- | --- |
| See the month, everyone's dues | any member of the group |
| Record a payment | that group's supervisor, or an admin |
| Record anything in a closed group | nobody |

Members can see what everyone owes on purpose — that transparency is the point
of a shared ledger. But only the supervisor writes: a member calling `POST` gets
a 403, asserted by `member cannot record payments`.

## Recording one

`POST /api/groups/[id]/payments` with `userId`, `amount` and `date`.

Guards: the member must belong to the group, the date must be a real
`YYYY-MM-DD`, and the amount must be **positive** and under 100,000,000. A zero
or negative payment is rejected with a 400 — asserted by `negative payment
rejected` — because "paying" a negative amount is a correction, and corrections
are made by deleting the wrong row, which leaves a trail.

## Months and closing

A payment belongs to the month of its `dueDate`, so cash handed over on 2 August
for July settles July only if it is dated in July. When a month is closed the
balance is frozen and, if the group has carry-forward on, whatever is still owed
opens the next month as `carryIn` — see [month-closing.md](month-closing.md).
Closed months reject new payments.

## Verified

`node scripts/e2e-test.js` — the payments report loading, a supervisor recording
a payment, a member being refused, a negative amount rejected, and the
settlement checks that bill shares and per-type shares add back to their totals.
`node scripts/check-meal-rate.js` — 23 checks on the rate and cost split feeding
these numbers. Both pass (138 and 23 checks respectively).
