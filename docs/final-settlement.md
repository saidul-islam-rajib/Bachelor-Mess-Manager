# Final settlement

`/settlement`. API: `/api/groups/[id]/final-settlement`. Logic:
`src/lib/final-settlement.ts`.

The page shows **last month's** finalized numbers — every member's total payable,
total paid, and the due or refund between them — plus the fewest transfers that
would clear everyone (`settleUp` from `src/lib/bill-view.ts`). It exists so a
mess can square up once a month without re-reading the whole `/payments` sheet.

`getFinalSettlement` auto-creates a whole-group closing for last month the first
time it is opened (`ensureFinalSettlement` → `closeMonth`), then reads two
`buildGroupReport` runs: the frozen one through `closedThrough` (`dueAtClose`,
`closeStatus`) and the live one (`liveDue`, `status`).

## Clearing a balance

Every way of clearing a balance writes ordinary `PaymentStatus` rows dated
`closedThrough`, so the member's due drops to zero through the same ledger every
other page reads — there is no separate "settled" number to keep in sync.

| Action | Who | What it writes |
| --- | --- | --- |
| **Mark my balance settled** | the member, for themselves | The matching `settleUp` legs — real "A paid B" transfer rows (payer row + offset). Refused if part of the balance has no matching member on the other side (`unmatched > 0`); the member is told to look at "Settle up" first. |
| **Settle** (one member) | supervisor, for anyone else | One adjusting row — `+due` as `PAID` for a debtor, `−|due|` as `REFUND` for someone owed. No matching needed: a supervisor settling someone else is asserting it is handled, not recording a payment path. |
| **Settle the whole month** | supervisor | The same adjusting row for **every** member still off zero, in one transaction, then `markSettled`. |
| **Mark last month as settled** | supervisor | Only the closing stamp (`settledAt`), and only once everyone is already at zero. |

The member self-serve path (`settleMemberBalance`) is the honest one and is kept
strict. The supervisor paths (`declareMemberSettled`, `settleWholeMonth`) are a
declaration: "we squared up in cash, close the books." On a mess that is short
overall — a bill nobody covered, a member who left owing money — the adjusting
rows push recorded credit past what was actually collected by exactly that
shortfall. That is the point of the button, and its confirmation says so.

## After "Settle the whole month"

Recomputing the report: every `due` is zero, every `closeStatus` is `PAID`,
`settleUp` finds nothing to transfer, and the "Settled by X" banner shows. The
carry-out written into next month is zero for everyone, so nothing follows the
month forward.

## Submission history

Every time a member's last-month balance is cleared through this flow a
`SettlementSubmission` row is written — an immutable snapshot of the numbers as
they stood (`meals`, `mealCost`, `billShare`, `totalCost`, `bazarPaid`,
`cashPaid`, `dueAtClose`, the payable/paid breakdowns by type, and the
`settleUp` legs for that member). It is written inside the same transaction as
the ledger rows, keyed `@@unique([closingId, userId])`, by all three paths:

| Path | `method` |
| --- | --- |
| `settleMemberBalance` (the member, for themselves) | `SELF` |
| `declareMemberSettled` (supervisor, one member) | `SUPERVISOR` |
| `settleWholeMonth` (supervisor) — one row per member still off zero | `SUPERVISOR` |

A member already at zero when `settleWholeMonth` runs writes no ledger row and
no submission — there was nothing to settle.

`getFinalSettlement` recomputes live and reads a settled balance as zero, so
these snapshots are the only record of what was actually owed. They surface at:

- **`/profile`** — a "Settlement history" section (`SettlementHistoryList`),
  every month the signed-in member has settled, newest first, each expandable to
  the full breakdown. Read via `GET /api/settlements/mine`
  (`listSettlementHistory` in `src/lib/settlement-history.ts`).
- **`/members/[id]`** — the same list, read-only, for that member in that group.

### Dashboard

Once a submission exists for the active closing, the member's dashboard
**Final settlement** card is hidden (`memberReport` in
`src/pages/api/reports/dashboard.ts` returns `finalSettlement: null`), and
`/api/settlement/status` stops redirecting them to `/settlement` on login. The
supervisor dashboard is unaffected — it still shows the whole group's card.

## Reopening

`DELETE /api/closings/[id]` clears `settledAt` and stops carry-forward, but the
settlement `PaymentStatus` rows stay — the balances still read as zero until
those rows are reversed or hard-deleted from `/payments`. Reopening a settled
month is for fixing the underlying data, not for undoing the settlement in one
click.

Reopening sets `reopenedAt`, so the next visit to `/settlement` auto-creates a
fresh closing. The old `SettlementSubmission` rows point at the reopened closing
and stay as history; the dashboard card reappears (no submission for the new
closing) and re-settling writes a new snapshot against it.

## Verified

`node scripts/e2e-test.js` covers the month-closing and carry-forward path. The
supervisor settle paths were exercised by hand against a seeded mess that was
~৳23,000 short: `settleAll` zeroed all twelve members and marked the month
settled; a per-member `Settle` zeroed one and left the rest; a member calling
either supervisor action got a 403; a second `settleAll` returned 409.
