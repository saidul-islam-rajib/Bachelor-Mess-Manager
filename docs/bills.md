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
settled with the outside party; it does not touch what members owe. The card
labels it "Vendor paid" for exactly that reason — who has chipped in is a
separate question, answered by [bill-collections.md](bill-collections.md).

## Who has paid their share

Each share carries its own paid/unpaid state, so a supervisor can mark that one
member cleared their ৳360 while three others have not, and that somebody paid
৳1300 toward an ৳1800 bill to cover the people who had not paid yet. That is
[bill-collections.md](bill-collections.md).

## Editing

`PATCH /api/bills/[id]` re-runs `computeShares()` and replaces the share rows
whenever the amount or the split changes, so the stored shares can never drift
from the amount. Every edit and delete is written to `ExpenseHistory` through
`recordExpenseUpdated` / `recordExpenseDeleted`, because a bill quietly changing
size is exactly the kind of thing a mess argues about.

## Reading the page

The page treats a bill's split method as the thing that decides *what kind of
bill it is*, and never mixes the two kinds in one list:

| Kind | Split method | Meaning |
| --- | --- | --- |
| Shared | `EQUAL` | Everyone active pays the same share. A ৳500 bill in a mess of five is ৳100 each; anyone who hands over more than their share is owed the difference back. |
| Assigned | `CUSTOM` | Only the picked members pay, at the amount set for each. |

`src/lib/bill-view.ts` holds the client-side view model — the API shapes, the
kind of a bill (`billKind`, `billsByKind`), and `summarizeMembers()`, which
folds every share a member holds this month into one row: share, paid,
outstanding, advance, plus the per-bill lines behind it. All of it is derived
from the same `/api/groups/[id]/bills` payload, so there is nothing new to
fetch and nothing that can disagree with the split panel of a single bill.

Three things sit on top of it:

- **Stat tiles** (`BillStats`) are buttons, not labels. Total bills opens the
  month's bills grouped by kind; Collected and Still owed open the members
  behind that number; Your share opens the member's own bill-by-bill sheet.
  Choosing a bill in a panel expands it in the list below and scrolls to it.
- **The list** nests kind → cost type → bill. Two electricity bills a fortnight
  apart are one **Electricity** block carrying the combined total, what has
  been collected and what is still owed, with a card per bill inside it. The
  cards are headed by their date, not by the cost type, because the block above
  them already says it — repeating the label on every card was what made the
  page look like it held three unrelated bills. Each card owns its own open
  state and several can stay open at once. They used to close each other: an
  open card listened for `mousedown` on the document and collapsed when the
  click landed outside it, so opening a second card collapsed the first. That
  listener is gone; only the card's own toggle, or Expand/Collapse all, changes
  it.
- **Final summary** (`FinalSummary`) closes the month, below the list.

## The final summary

Per bill, a member is either short or ahead. Across a month they are usually
both, and the two must cancel before anyone hands over cash. So the summary
nets them, per member, over every bill of the month:

```
net = paid − share        // = advance − outstanding, the same number
```

Gas of ৳500 across five people, paid ৳200 by A and ৳300 by B; electricity of
৳500 paid in full by C. C is ৳400 ahead on the electricity and ৳100 short on
the gas, so C's line reads **৳300 back** — one number, not two. D and E, who
paid nothing, read ৳200 each to pay. The nets always add to
`collected − billed`, which is zero once a month is fully collected.

Net is why the member rows carry **four** figures — share, paid, unpaid on
bills, and final — instead of the three a single bill needs. Showing only
"due ৳166.68" for a member who has paid ৳500 against a ৳470.02 share reads as a
contradiction: that ৳166.68 is real (they have not paid those two shares) but
they overpaid ৳196.66 on a third bill, so they are ৳29.98 *ahead*. Both numbers
are shown, with Final the one that decides who hands money to whom, and the
pill on every member row is driven by net rather than by the per-bill advance.

`settleUp()` then matches the members still short against the members who
fronted money, largest against largest, so the month clears in as few
hand-overs as possible (`E pays ৳200 to C`). What a debtor still owes after
every creditor is whole is money no member fronted — it belongs to the mess for
bills nobody has covered, and is called out separately rather than folded into
someone's refund.

All of it is integer paisa arithmetic, converted back to taka only for display,
so a 1000 ÷ 3 split nets to zero rather than to a stray paisa.

One component draws every member list on the page: `MemberTable` in
`src/components/bills/MemberTable.tsx`, used by the final summary and by the
Collected and Still owed drill-downs. A row is a single markup path at every
width — name and position pill on top, then the four figures as a labelled
2-up grid on phones that becomes 4-up from `sm`. There is deliberately no
hidden-on-mobile table header and no second mobile-only copy of the row to
keep in sync; each figure carries its own label, which is also what makes the
row legible when it is the third level of nesting on a 360px screen.

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
