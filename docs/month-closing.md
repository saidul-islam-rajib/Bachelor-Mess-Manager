# Closing a month and carrying balances forward

Before this, a month never ended. Editing a bill from March would silently rewrite March's balances even though
everyone had settled up on them, and an unpaid due at month end simply stopped being counted — April started
everybody at zero.

## Models

- `MonthClosing` — one closing event: group, `monthKey`, `closedThrough` (any date inside the month), who closed it,
  an optional note, and `reopenedAt`.
- `ClosingLine` — one member's frozen position in that closing: `carryIn`, `mealCount`, `mealCost`, `billShare`,
  `bazarPaid`, `cashPaid`, and **`carryOut`**, which is what the next month opens with.

A month can have several closings. `isFinal` on the line distinguishes a whole-group close from a partial one.

## Closing

`POST /api/groups/[id]/closings`

```json
{ "month": "2026-08", "through": "2026-08-12", "userIds": ["..."], "endMembership": true, "note": "..." }
```

- `through` defaults to the last day of the month, and must fall inside it.
- Omit `userIds` to close for everyone; pass it to close for specific people.
- `endMembership` (partial closes only) also sets `membership.isActive = false, leftAt = through`.

`closeMonth` runs `buildSettlement(group, monthKey, { through })` — the same engine as the normal report, just with a
truncated window — and writes one `ClosingLine` per member with `carryOut = due`. Members already covered by a live
closing for that month are skipped rather than double-closed. The whole thing is one transaction.

Everyone in the group is notified.

## Carrying forward

`loadCarryIn` in `src/lib/settlement.ts` reads **every** non-reopened closing for the previous month, in creation
order, and takes the last `carryOut` per user. That ordering matters: it means a partial close on the 12th followed by
a whole-group close on the 31st resolves correctly for both the person who left and the people who stayed.

Carry-in is only read when `Group.carryForwardEnabled` is on (default true, toggled in Members → Group settings). An **open**
month never carries forward — only a closed one — otherwise the balance would be counted twice the moment it settles.

## Reopening

`DELETE /api/closings/[id]` sets `reopenedAt`. The rows are kept, so the history of "this was closed, then reopened"
survives. Carry-forward stops immediately, since `loadCarryIn` filters on `reopenedAt: null`. Everyone is notified —
reopening a month people have paid against is not a quiet operation.

## The mid-month departure

This is the case the requirements asked for, and it is why `through` exists at all:

1. Supervisor opens `/payments`, picks the month, hits **Close this month**.
2. Chooses **Selected members only**, picks the person leaving, sets the date to the 12th.
3. Ticks **They are leaving the mess on this date**.

Their figures are settled through the 12th, their outstanding balance is frozen on the record with their name on it,
their membership ends, and nobody else's month is disturbed. If they owed money, it follows them into the next
month's `carryIn` rather than being absorbed by everyone who stayed.
