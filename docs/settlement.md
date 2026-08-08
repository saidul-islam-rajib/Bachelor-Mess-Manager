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

## Day-by-day pricing: a shop feeds the days until the next shop

`DAILY` mode originally priced each day strictly on that day's own bazar. That is correct only if the mess shops
every day. It is not what most messes do, and the failure was severe:

```
2026-08-01   5 meals   1040 bazar   rate 208.00
2026-08-02   3 meals      0 bazar   rate   0.00
2026-08-03   2 meals      0 bazar   rate   0.00
```

The whole month's ৳1040 landed on the five meals eaten on the shopping day, at ৳208 each, while the ten meals eaten on
the other four days cost nothing. Total allocation still equalled total bazar, so the books balanced — but the
distribution was badly unfair, and the fairness bug was invisible precisely because the totals tied out.

The first fix was a fallback: detect meals on bazar-less days and revert the whole month to one flat rate. That was
safe, but it meant `DAILY` almost never actually applied — a mess that shops twice a week trips the condition every
month — and every day in the table showed the same number, which is what a supervisor reported as a bug.

### What happens now

`spreadBazarOverDays` treats a shopping trip as feeding the days until the next one. Each bazar entry is spread evenly
across the days in its span **that had meals**; days nobody ate are skipped so their share is not stranded. The first
trip of the window also reaches backwards to the window start, because meals recorded before the first recorded shop
were still eaten out of something.

```
Bazar   01: ৳1040                          (next shop: none, so the span runs to today)
Meals   01: 5   02: 3   03: 2   04: 3   05: 2

৳1040 over the 5 days that ate = ৳208 each

01   5 meals   ৳208 used   rate  41.60
02   3 meals   ৳208 used   rate  69.33
03   2 meals   ৳208 used   rate 104.00
04   3 meals   ৳208 used   rate  69.33
05   2 meals   ৳208 used   rate 104.00
```

A quiet day costs more per meal than a busy one, which is the honest reading: the same groceries fed fewer people.
`SettlementDay.bazar` is what was actually spent that day; `SettlementDay.charged` is what that day was priced on.
They differ on every day except a one-day span.

Members are charged from the day rates — each day's share is split across that day's meals by `allocate()`. So
`Σ member meal cost` still equals total bazar to the paisa, exactly as before. The fallback is gone;
`effectiveRateMode` now always equals `rateMode` and `rateModeFallbackReason` is always `null`.

Bazar whose entire span had no meals cannot be placed this way. It falls to the same pooling step that `MONTHLY` uses
and is spread across every meal in the window, so nothing is dropped.

### The headline rate is the average of the daily rates

In `DAILY` mode `totals.mealRate` is the **unweighted mean** of the day rates — `(41.60 + 69.33 + 104.00 + 69.33 +
104.00) / 5 = ৳77.65` above. `totals.ratioRate` carries the old figure (`total bazar ÷ total meals`, ৳69.33) alongside
it, and `totals.pricedDays` says how many days went into the mean.

The two differ whenever meals per day vary: the ratio is the mean weighted by each day's meal count, the headline is
not. That is deliberate — it is the number a supervisor quotes when asked "what's the rate this month?", and averaging
the days they can see on the table is what they expect it to mean.

**It is a reporting figure, not a charging figure.** `average rate × your meals` will not equal your cost, and it must
not: charging that way would collect a different amount than the mess spent. Conservation comes from the per-day
allocation, and the UI says so rather than leaving people to discover the gap.

In `MONTHLY` mode nothing changed — `totals.mealRate` is still `total bazar ÷ total meals`, and every day shows it.
A group that wants day-by-day rates has to be set to `DAILY` in Members → Group settings.

Verified by `npm run test:rate`, which reproduces the scenario above and asserts the day rates genuinely vary, that a
2-meal day is dearer than a 5-meal day, that the headline equals the mean of the rates shown, and that the day charges
add back to ৳1040 to the paisa.

## Member-wise breakdown

`SettlementMember.billShareByType` carries each member's share of each cost type (`RENT`, `ELECTRICITY`, custom
codes), alongside `bazarPaid` — what that person spent out of their own pocket.

This drives the "Who is charged what" table on `/payments`: one row per member, one column per cost type actually
used that month, plus meals, bazar bought and the total charged. The columns are derived from the group's own
`byType` totals, so a group that added "Gas cylinder" gets a Gas cylinder column and a group that never records rent
gets no rent column.

Two invariants hold and are asserted in the suite:

- each member's per-type shares sum to their `billShare`
- all members' per-type shares sum to the group's bills total

`bazarPaid` is a **credit**, not a charge. It appears in the breakdown so people can see who has been carrying the
shopping, and it is subtracted in the balances table.

## The two rate modes

Set per group in Members → Group settings (`Group.mealRateMode`).

| Mode | Rate | Good for |
| --- | --- | --- |
| `MONTHLY` (default) | total bazar ÷ total weighted meals | Simple to explain; evens out cheap and expensive weeks |
| `DAILY` | that day's bazar ÷ that day's weighted meals | Messes that shop most days |

`DAILY` falls back to `MONTHLY` for any month where meals fall on days with no bazar — see the section above.
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

### The window never runs past today

With no `through` given, the window ends at the **end of today**, not the end of the month.

This matters because meal plans pre-fill the whole month. `syncPlansForMonth` writes a `MealEntry` for every day a
member's weekly plan covers, so on the 8th of a 31-day month the table already holds meals for the 9th to the 31st.
Bazar, by contrast, only exists for days that have actually happened. Pricing the two together gives:

```
rate = bazar spent so far ÷ meals for the entire month
```

which is far too low — the reported symptom was every day of the month showing the same understated ৳/meal, future
days included. The distribution was skewed too: `allocate()` still hands out every taka of bazar, so whoever had the
most *planned* meals absorbed cost that nobody has spent yet.

Clamping the default window to today fixes both. A past month is unaffected (today is already beyond its end), and a
future month settles to nothing, which is correct — none of it has happened.

An explicit `through` is still honoured as given, because the caller has said what it means. Month closing passes one
(defaulting to the last day of the month), so closing the current month early does price whatever the plans have
already written for the rest of it. Close a month after it ends, or pass `through` as the real last day.

`Settlement.through` reports the last day actually priced. It is surfaced on `/api/groups/[id]/payments` and the meal
summary so the UI can say which days the rate covers instead of leaving people to guess.

## Performance notes

- One `Promise.all` of eight queries per settlement, no N+1.
- Per-member accumulators are `Int32Array` keyed by a dense index, so the hot loops are numeric rather than map
  lookups. A paisa amount overflows `Int32` above ~২১ million taka per member per month, well beyond the
  `maxMoneyAmount` validation ceiling of ১০ crore per single entry, but worth remembering if that limit ever moves.
- `syncPlansForMonth` still runs first; that is unchanged behaviour.

## Where the numbers surface

- `/payments` — member balances with the brought-forward column, the "Who is charged what" per-member cost-type
  breakdown, the day-wise rate table, and bazar bought per member.
- `/meals` — monthly summary. The meal grid itself counts meals straight from the entries it already loaded, so the
  Meals column and per-member totals still show the whole month including planned days; only the ৳/meal column and
  the money below it stop at `through`.
- `/dashboard` — supervisor and member roll-ups.
