# Bills

Bazar is what the mess *ate*. Bills are what the mess *ran on* — rent,
electricity, gas, water, wifi, the cleaner, the cook. The difference matters
because they are split differently: bazar is shared by meals eaten, a bill is
shared by people, not appetite. Somebody who ate four meals all month still owes
their share of the rent.

Page: `/bills`. API: `/api/groups/[id]/bills` and `/api/bills/[id]`.
Split logic: `src/lib/bills.ts`.

## The model

Both bazar and bills are `ExpenseEntry` rows; `type` tells them apart, and
`BILL_TYPE_FILTER` is "everything that is not `BAZAR`". The cost types
themselves are per group, so one mess can track "Gas cylinder" and another
"Generator" — see [expense-categories.md](expense-categories.md).

Every bill carries its own `ExpenseShare` rows: one per member, written **once,
at the moment the bill is recorded**.

That is the single most important decision on this page. The shares are stored,
not recalculated on read, so a member who joins in March cannot retroactively
appear in February's electricity bill, and one who leaves does not vanish from
the bills they were there for. Last month's numbers stay last month's numbers.

## Splitting

`computeShares()` handles both methods and refuses anything that does not add
up.

**Equal** — across every *active* member, in integer paisa:

```
totalPaisa = round(total * 100)
base       = floor(totalPaisa / members)
remainder  = totalPaisa - base * members    // handed out 1 paisa at a time
```

A 1000৳ bill across 3 people is 333.34 / 333.33 / 333.33, never 333.33 × 3 with
a paisa lost. The e2e suite asserts `equal split sums exactly to the bill`.

**Custom** — the supervisor assigns amounts by hand, for the wifi only four
people use. Rejected if: a member is listed twice, any amount is negative, a
listed person is not an active member, or the shares miss the total by more
than a paisa. The error says what the shares came to and what the bill was.

## Who can do what

| Action | Who |
| --- | --- |
| See the bills and their shares | any member of the group |
| Record, edit, delete a bill | that group's supervisor, or an admin |
| Anything, in a closed group | nobody — `isGroupWritable` blocks writes |

A member calling `POST` gets a 403, asserted by `member cannot record bills`.

## Recording one

`POST /api/groups/[id]/bills` with `type`, `amount`, `date` (`YYYY-MM-DD`),
optional `note`, `splitMethod`, `shares`, `isReceived` and `payerId`.

Guards, in order: the type must exist in this group's category list; the amount
must be positive and under 100,000,000; the date must be a real `YYYY-MM-DD`;
the payer, if given, must be a member. Then shares are computed and the row and
its shares are written together.

`payerId` records who actually handed over the money — the landlord was paid by
one person even though the rent is everyone's. `isReceived` marks a bill as
settled with the outside party; it does not touch what members owe.

## Editing

`PATCH /api/bills/[id]` re-runs `computeShares()` and replaces the share rows
whenever the amount or the split changes, so the stored shares can never drift
from the amount. Every edit and delete is written to `ExpenseHistory` through
`recordExpenseUpdated` / `recordExpenseDeleted`, because a bill quietly changing
size is exactly the kind of thing a mess argues about.

## Where the money goes next

The month's bill shares reach a member's dues through `billSharesByUser()`,
which sums `ExpenseShare` for the month, and `billTotalsByType()`, which feeds
the "where the money went" breakdown. From there it is
[settlement.md](settlement.md):

```
due = brought forward + meal share + bills share − groceries they bought − cash they paid
```

The suite checks that per-member and per-type bill shares both add back to the
bills total, so the breakdown on `/payments` can never disagree with `/bills`.

## Verified

`node scripts/e2e-test.js` — bills recorded and split, the equal split summing
exactly, per-type shares matching per-member shares, and members being refused.
`node scripts/check-allocation.js` — 39 allocation invariants including
largest-remainder rounding. Both pass.
