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

**It does not auto-create collections.** Recording a bill does not assume
anybody has paid. Every collection is an explicit act by the supervisor, because
the app should never claim money changed hands when it did not.

## Recording one

Supervisor or admin only, and only in a writable group — a closed month refuses,
same as every other write.

```
POST /api/bills/[id]/collections   { userId, amount, date }
POST /api/bills/[id]/collections   { userId, settle: true }
DELETE /api/bills/[id]/collections?collectionId=...
```

`settle: true` is the **Mark paid** button: it pays exactly what that member has
left outstanding, so clicking it can never overshoot into an accidental advance,
and clicking it twice is refused with "that member has nothing left to pay on
this bill". A bare `amount` is the **Part payment** box, and it is allowed to
exceed the member's share — that is how somebody fronts money for the group.

`date` defaults to today and decides which month the credit lands in. A member
who clears an August bill in September is credited in September and carries the
August due forward, which is the honest record of what happened.

Deleting a collection is a real delete, not a reversal entry. It is there for
mistyping, and the guard checks the row actually belongs to that bill so one
bill's undo cannot remove another's money.

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

## Verified

The `/bills` API returns per-member `paid`, `outstanding`, `advance` and
`status`, and the run covering the ৳1800 case above checks 32 invariants: the
split, both advances, the three arrears, `Σ advance == Σ outstanding`, a partial
payment moving to `PARTIAL`, **Mark paid** settling exactly the remainder and
refusing a second time, a member getting 403, undo restoring the debt, and the
non-payer's ৳360 arriving in their settlement due while the meal rate stays put.
