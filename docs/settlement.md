# The settlement engine

`src/lib/settlement.ts` is now the single place where a month's money is worked out. `buildGroupReport`
(`src/lib/group-report.ts`) and `buildMealSummary` (`src/lib/meal-summary.ts`) are thin adapters over it, so the
dashboard, the meals page and the payments page can never disagree about what somebody owes.

## What was wrong before

The member balances table did not tie out. Four separate defects fed into it.

### 1. Money vanished in day-wise pricing

The old `buildMealSummary` priced each day as `dayExpense / dayMeals` and charged members `perMealPrice * weighted`.
If bazar landed on a day with **zero meals** — shopping on Sunday for the week, a supervisor back-dating an entry —
then `perMealPrice` was `0` and that money was charged to **nobody**. The reverse also held: meals eaten on a day with
no bazar cost nothing.

The result is that `Σ member meal cost ≠ total bazar`. The mess spent ৳9,000 and the table accounted for ৳7,400,
with no row showing where the rest went.

The fix keeps day-wise pricing (it is the fairer model, and it is what the group asked for) but pools the
un-allocatable bazar and spreads it over the month's total meals. Every taka now lands on somebody, in either mode.

### 2. Rounding drift

`round2(perMealPrice)` was rounded to two decimals and *then* multiplied by each member's meal count, and the result
rounded again. Over a month that drifts by several taka, and the drift is invisible — no row looks wrong, the total
just does not match.

The engine now works in **integer paisa** end to end. Meal weights are scaled by 1000 (`0.5` → `500`) so weighted
meal counts stay integers too. Allocation uses `allocate()`, a largest-remainder distribution: everyone gets their
floor share, then the leftover paisa go one each to the largest fractional remainders. The parts always sum back to
the whole.

`allocate()` is exported and worth keeping that way — it is the property the whole table rests on.

### 3. Members who left mid-month disappeared

The report only queried `membership.isActive: true`, but `mealEntry` rows were **not** filtered by membership. So when
somebody left, their meals stayed in the group's total meal count — pushing everyone else's share up — while their own
row, and their unpaid due, silently dropped out of the table.

The roster now includes any membership overlapping the month window, plus a defensive sweep for anyone who has meals,
bill shares, cash payments or a carry-in balance but no matching membership row. Nobody with money attached to them
can fall out of the table.

### 4. Two different rates in one report

`totals.mealRate` was computed month-wide (`expense / meals`) while member costs were computed day-wise. The headline
number and the rows were answering different questions.

Both now come from the same pass, and `rateMode` is reported so the UI can say which one is in force.

## The two rate modes

Set per group on the group page (`Group.mealRateMode`).

| Mode | Rate | Good for |
| --- | --- | --- |
| `MONTHLY` (default) | total bazar ÷ total weighted meals | Simple to explain; evens out cheap and expensive weeks |
| `DAILY` | that day's bazar ÷ that day's weighted meals | Messes whose daily spend varies a lot |

Both modes guarantee `Σ member meal cost == total bazar` exactly. `totals.unallocatedBazar` reports how much was
pooled in `DAILY` mode so the UI can be honest about it rather than hiding it.

## The member row

```
due = carryIn + mealCost + billShare − bazarPaid − cashPaid
```

- `carryIn` — what the previous month's closing carried forward (see [month-closing.md](month-closing.md)). Zero
  unless the previous month was actually closed; folding in an open month would double-count the moment it settles.
- `mealCost` — share of bazar, by weighted meals.
- `billShare` — sum of `ExpenseShare` rows, which are snapshotted when the bill is recorded.
- `bazarPaid` — bazar this member paid for out of pocket.
- `cashPaid` — cash handed to the supervisor (`PaymentStatus.amountPaid`).

### Status

`settlementStatus()` reads off `due` rather than off a rate of settlement, which is what makes the badge match the
number next to it:

| Status | Condition |
| --- | --- |
| `PAID` ("Settled") | \|due\| ≤ 1 paisa |
| `REFUND` ("Refund due") | due < 0 — the mess owes them |
| `PARTIAL` ("Partly paid") | due > 0 and they have put something in |
| `PENDING` ("Unpaid") | due > 0 and nothing has come in |

`REFUND` is new. Previously a member owed money back was labelled "Paid", which is true but unhelpful — it hid the
fact that the mess had a debt.

## Partial windows

`buildSettlement(group, monthKey, { through: 'YYYY-MM-DD' })` truncates the window at the end of that day. This is
what makes closing on any date possible, and it is the same code path as a full month — there is no second
implementation of the maths for the mid-month case.

## Performance notes

- One `Promise.all` of eight queries per settlement, no N+1.
- Per-member accumulators are `Int32Array` keyed by a dense index, so the hot loops are numeric rather than map
  lookups. A paisa amount overflows `Int32` above ~২১ million taka per member per month, well beyond the
  `maxMoneyAmount` validation ceiling of ১০ crore per single entry, but worth remembering if that limit ever moves.
- `syncPlansForMonth` still runs first; that is unchanged behaviour.

## Where the numbers surface

- `/payments` — member balances with the brought-forward column, a totals row, and the day-wise rate table.
- `/meals` — monthly summary.
- `/dashboard` — supervisor and member roll-ups.
