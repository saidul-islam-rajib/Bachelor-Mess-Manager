# Showing the daily meal rate on a phone

The rate was being calculated correctly and shown badly. Almost every member of this app opens it on a phone, and on a
phone the number they care about most — *what did today's meal cost me* — was the hardest one to find.

## Where it was hiding

`/meals` renders two views of the same data. The `lg:` table has a `৳/meal` column per day and the month rate in its
footer; below `lg` that whole block is `hidden`. The mobile day cards carried the rate as grey 12px text appended to
the meal count, and the month rate was not on the mobile path at all. The dashboard had a single "Meal rate" tile
showing the month figure, with no per-day number anywhere.

So on mobile: the daily rate was decoration, and the headline rate did not exist.

## What replaced it

`MealRateCard` (`src/components/MealRateCard.tsx`) sits at the top of `/meals` above the day list, at every
breakpoint — not a mobile-only variant to keep in sync with a desktop one.

- **Headline** — today's rate as the largest thing on screen, with the member's own meal count and cost for today
  underneath. If today is not priced yet it falls back to the most recent priced day and says so, rather than showing
  a dash.
- **Three tiles** — month-to-date rate, the member's meals, the member's meal cost.
- **Mode line** — whether the mess prices each day on its own bazar (`DAILY`) or runs one rate for the month
  (`MONTHLY`), so the headline number is not read as something it is not.
- **Day by day** — newest first, 7 rows then a "Show all N days" toggle. Each row is date, the member's own meals,
  the rate, and their cost that day. The mess-wide meal count only appears from `sm:` up; on a narrow phone it is the
  column worth dropping.

The per-member figures are computed client-side from data the page already holds: `cells` gives the member's counts per
day, `weights` turns them into weighted units, and `summary.days[].perMealPrice` is the rate. No API change was needed
for the meals page.

## Dashboard

The member dashboard needed a server change, since it never received per-day data. `memberReport` in
`api/reports/dashboard.ts` now picks today's priced day (falling back to the latest priced one) out of
`buildGroupReport().days` and returns it as `current.dailyRate`.

The member stat grid leads with that daily rate, then the month rate, then meals, then the balance. "Your total cost"
came out of the grid — it is still in the Your balance card directly below, and the daily rate earns the slot more.

## The day cards

The inline `· ৳x/meal` on each mobile day card became a filled brand-coloured pill on its own line. Same number, but it
now reads as a value rather than as a continuation of the meal count.
