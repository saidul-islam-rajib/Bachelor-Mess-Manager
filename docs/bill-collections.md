# Who actually paid a bill

A bill is one number to the outside world and five numbers inside the mess. The
gas cylinder costs ৳1800; five people owe ৳360 each. Those are different
questions, and before this change the app could only answer the first one.

Page: `/bills`. API: `POST` and `DELETE /api/bills/[id]/collections`.
Maths: `src/lib/bill-collections.ts`.

## The problem

`ExpenseEntry.isReceived` is a single boolean for the whole bill. It means "the
landlord/shop/utility has been paid" — see [bills.md](bills.md). It says nothing
about which members have chipped in, and a mess spends far more time arguing
about the second thing than the first.

The `/payments` page could record that a member handed over ৳500, but the money
landed in a group-wide pool with nothing tying it to the gas cylinder. So a
supervisor could see *that* somebody paid and *that* a bill exists, but never
that this payment was for that bill.

## The model

A collection is a `PaymentStatus` row with `expenseId` set to the bill. That
column already existed on the model and was never written; it is now the whole
feature. Rows with `expenseId` null remain what they always were — general
money-in-hand payments recorded from `/payments`.

Keeping one ledger rather than adding a second table is the important decision.
The settlement engine sums `PaymentStatus.amountPaid` per member for the month
and subtracts it from what they owe. Because a collection *is* one of those
rows, a bill payment reaches a member's balance through the existing path, with
no change to `src/lib/settlement.ts` at all. There is no second source of truth
to drift.

For one bill and one member:

```
owed        = their ExpenseShare on that bill
paid        = Σ collections for (bill, member)
outstanding = max(0, owed − paid)
advance     = max(0, paid − owed)
```

Status is `PENDING` when nothing is paid, `PARTIAL` part-way, `PAID` once the
share is covered, all in integer paisa with a 1-paisa tolerance so a rounded
share never leaves somebody owing a fraction of a taka forever.

## Paying more than your share

This is the case the design turns on. Two people front the whole ৳1800:

| Member | Share | Paid | Outstanding | Advance |
| --- | --- | --- | --- | --- |
| Sajib | 360 | 500 | 0 | 140 |
| Imran | 360 | 1300 | 0 | 940 |
| Limon | 360 | 0 | **360** | 0 |
| Kamal | 360 | 0 | **360** | 0 |
| Jubayer | 360 | 0 | **360** | 0 |

The bill is **fully collected** — ৳1800 is in hand and the cylinder can be paid
for — while ৳1080 is still owed *between members*. Both facts are true at once,
so `/bills` shows both: a "collected 1800 of 1800" bar, and "3 members still owe
৳1080" beside it.

The advances are not a special case in the settlement. Imran's ৳1300 credits his
balance in full while only ৳360 of cost is charged to him, so he ends the month
৳940 in credit — status `REFUND` — and the three who did not pay end it ৳360
down each. The advances and the arrears are equal and opposite by construction:
`Σ advance == Σ outstanding` on a fully collected bill, which the verification
asserts.

That is the money the mess owes back, and the three who have not paid are where
it comes from, so the two are shown as one balance rather than as an incidental
note. Overpayment gets **its own colour** — teal, distinct from the rose of a
due, the green of a settled share, the amber of a part payment, and the indigo
that marks your own row. The row is tinted, the Due column shows `+৳940` with
"gets back" beneath it instead of a dash, the status reads **Gets back** rather
than **Paid**, and the bill header carries `৳1080 back to those who overpaid`
beside `3 members owe ৳1080`.

Teal was chosen over violet after checking the actual swatches: `violet-50` and
the `brand-50` used for your own row are nearly the same pale blue, so an
overpaying member and the reader's own row would have looked identical at a
glance. Teal is unambiguous against all four colours already in play.

## What this deliberately does not do

**It does not touch the meal rate.** The rate is bazar ÷ meal units. Bill shares
have never been part of it and still are not: an unpaid gas share does not make
anybody's meals more expensive, it just sits in their dues. Somebody who eats
four meals all month still owes their full share of the gas, and somebody who
eats sixty does not owe more of it.

**It does not replace `isReceived`.** A supervisor often pays the vendor out of
the mess float first and collects from members afterwards, or the reverse. The
two are independent, so the pill on the bill card now reads "Vendor paid" /
"Vendor unpaid" to stop it being read as "members have paid".

**It does not auto-create collections — with one exception.** Recording a bill
does not assume anybody has paid; every collection is an explicit act by the
supervisor. The exception is a **one-member bill with an outside payer** (see
below), where there is exactly one thing that can be true and the "Paid by"
field already says it.

## The "Paid by" credit on a one-member bill

A one-member bill (the **One member** button — `CUSTOM` split, a single share) is
often "I paid ৳200 to clear last month's due for Rajib": charged to Rajib, but
`payerId` is someone else — Shaqib. Rajib owes his ৳200 share; Shaqib fronted the
whole ৳200. There is no ambiguity and nothing to collect over time, so
`syncPayerCredit()` (`src/lib/bill-collections.ts`) writes Shaqib a real
`PaymentStatus` row for the full amount, flagged `fromPayer`, linked to the bill.

It rides the same single ledger as every other collection, so Shaqib's balance,
the `/bills` split ("Rajib owes ৳200 · Shaqib gets ৳200 back" — the overpayment
case above) and the `/payments` settlement all pick it up with no special-casing
downstream. The row is reconciled, not appended: `syncPayerCredit()` runs inside
the bill create/edit transaction and rewrites the amount, moves it to a new
payer, or deletes it if the bill stops being a one-member bill with an outside
payer. Deleting the bill drops it (`clearPayerCredit()` in the delete
transaction) rather than leaving an `expenseId`-nulled orphan.

`fromPayer` rows are managed by the bill, so `reversePayment`,
`updatePaymentDetails` and `hardDeletePayment` all refuse them — change the
bill's "Paid by" field instead. The Bills payment-history row shows them with a
`from "Paid by"` tag and no edit/reverse/delete buttons.

This only applies to **one-member** bills. A shared or custom bill split across
several people still needs the fronter's payment recorded explicitly, because
"who fronted how much" is a real question there and the app should not guess it.

Bills that predate this rule are reconciled by
`node scripts/backfill-payer-credits.js` (idempotent, `--dry-run` to preview,
`--group "<name>"` to scope).

## Recording one

Supervisor or admin only, and only in a writable group — a closed month refuses,
same as every other write.

```
POST   /api/bills/[id]/collections   { userId, amount, date }
POST   /api/bills/[id]/collections   { userId, settle: true }
DELETE /api/bills/[id]/collections?collectionId=...              reverse
DELETE /api/bills/[id]/collections?collectionId=...&hard=true    permanently delete
PATCH  /api/bills/[id]/collections?collectionId=...   { amount, date }
```

`settle: true` is the **Mark paid** button: it pays exactly what that member has
left outstanding, so clicking it can never overshoot into an accidental advance,
and clicking it twice is refused with "that member has nothing left to pay on
this bill". A bare `amount` is the **Part payment** box, and it is allowed to
exceed the member's share — that is how somebody fronts money for the group.

`date` defaults to today and decides which month the credit lands in. A member
who clears an August bill in September is credited in September and carries the
August due forward, which is the honest record of what happened.

## The ledger is append-only for members

**A member never edits or deletes an entry.** The only correction path a member
sees is reversing — and reversing does not mutate anything, it appends.

A mistake is corrected the way a ledger corrects one: by writing a second row
that reverses the first. The correction carries the negative amount and a
`reversalOfId` pointing back at the original. Both lines stay on screen — the
original struck through and marked "reversed", the correction shown as a
negative — so the history reads as *this was entered, then corrected*, never as
if the first entry had not happened.

That matters here more than in most software. The thing a mess argues about is
whether somebody paid, so the honest record — entered, then corrected — is the
default, and the one members are shown.

`DELETE /api/bills/[id]/collections?collectionId=…` therefore *reverses* by
default; it does not delete. The guards: the entry must belong to that bill, an
entry can be reversed only once, and a correction cannot itself be reversed. The
same rule and the same helper cover the general payments on `/payments`.

## The supervisor can also edit or delete outright

Reversing keeps a paper trail, but it cannot clean up an entry that should never
have existed — a leftover one-sided row, a duplicate, a typo entered minutes ago
that nobody has acted on. So the group's supervisor (and any admin) can also:

- **`PATCH …?collectionId=…`** with `amount` and/or `date` — rewrites
  `amountPaid`/`dueDate` on the row in place. `updatePaymentDetails` refuses a
  row that is linked to another record (one leg of a transfer, a reversal, or an
  advance-funded payment); those stay reverse-only so the two sides never
  desync. The Bills page hides **edit** for such rows accordingly.
- **`DELETE …?collectionId=…&hard=true`** — removes the row and, in one
  transaction, its whole family of paired offset and reversal rows, deleting
  children before parents so the one-to-one `offsetOfId`/`reversalOfId` relations
  are never violated mid-delete.

Both need `canManageGroup` and the `payment.record` permission — the same gate
as recording and reversing. A member calling either gets a 403. Deleting a bill
still only nulls `expenseId` on its collections (`onDelete: SetNull`); a hard
delete here is the deliberate removal of one specific entry, requested by name.

Because a reversal is just another row with a negative `amountPaid`, the
settlement needs no special case: the credit nets to zero, the member's due goes
back to what it was, and the totals stay consistent by arithmetic rather than by
a flag anybody has to remember to check.

## At month closing

Nothing special happens. An unpaid share is already inside `due`:

```
due = brought forward + meal share + bills share − groceries bought − cash paid
```

An unpaid ৳360 is in `bills share` with nothing in `cash paid` to offset it, so
it is in `due`, and the closing writes it to `ClosingLine.carryOut`, which
becomes next month's `carryIn`. See [month-closing.md](month-closing.md) and
[settlement.md](settlement.md). Deleting the bill later nulls `expenseId` on its
collections rather than deleting them (`onDelete: SetNull`), so money a member
genuinely handed over never disappears from their balance because a bill was
tidied up.

## The split panel

Collapsed by default — a month of bills should read as a list, not a wall.

Opening one keeps it open. It closes when you collapse it, click outside the
card, or press Escape; **it does not close when you record a payment**, because
the whole point of opening it is to work down the members one at a time. That
took two fixes: the open/closed state lives on the page rather than inside the
row, so it survives a re-render, and refreshing after a payment no longer blanks
the list back to "Loading bills…" — which was unmounting every row and losing
their state. Scrolling deliberately does not close it, since on a phone scrolling
is how you reach the rest of the list.

**Desktop** gets a real table: member, share, paid, due, status, and the record
control, right-aligned numbers in tabular figures so columns line up and a wrong
number is visible at a glance.

**Mobile** gets one card per member instead of a squeezed table — name and status
on the first line, a progress bar with the outstanding amount beside it on the
second, and full-width tap targets. Rows are ordered with **you first**, then
whoever owes the most, so the two things a member opens the app for are the two
things at the top.

## Verified

The `/bills` API returns per-member `paid`, `outstanding`, `advance` and
`status`. Two runs cover it.

The ৳1800 case above, 32 invariants: the split, both advances, the three
arrears, `Σ advance == Σ outstanding`, a partial payment moving to `PARTIAL`,
**Mark paid** settling exactly the remainder and refusing a second time, a member
getting 403, a reversal restoring the debt, and the non-payer's ৳360 arriving in
their settlement due while the meal rate stays put.

The ledger, 20 invariants: the entry recording who entered it and when, the
**original surviving a reversal**, the correction being appended with the
negative amount, net paid returning to zero and the due restored in full,
reversing twice refused, a correction being unreversable, a member refused
outright, and the same behaviour on general payments including the settlement
credit cancelling.

The supervisor edit/delete path reuses `updatePaymentDetails` and
`hardDeletePayment` from `/payments` — same helpers, same guards against
touching a linked leg — so it inherits their coverage; only the gate changed,
from `requireAdmin` to `canManageGroup` + `payment.record`.

`npm run typecheck`, `npm run lint` and `npm run build` are clean. The e2e
suites need a running Postgres and were not re-run for this change.
