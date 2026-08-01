# Tests

```bash
npm run dev     # in one terminal (see the MX note below)
npm test        # in another - runs everything, prints one summary
```

```
================================================================
  TEST SUMMARY
================================================================
  SUITE           TOTAL  PASSED  FAILED   RESULT
  ------------------------------------------------------------
  allocation         28      28       0   PASS
  meal-rate          23      23       0   PASS
  e2e               108     108       0   PASS
  ------------------------------------------------------------
  TOTAL             159     159       0
================================================================
  159 of 159 checks passed (100.0%) in 34.2s

ALL TESTS PASSED
```

Exit code is `0` only when every check passes and every suite ran. A suite that cannot run because the app is not
listening is reported as `SKIPPED` and exits `1` — an incomplete run must never look like a green one.

## The suites

| Command | Suite | Needs the app running | Checks |
| --- | --- | --- | --- |
| `npm test` | everything | partly | 159 |
| `npm run test:allocation` | money allocation invariants | no | 28 |
| `npm run test:rate` | meal rate and cost split scenario | yes | 23 |
| `npm run test:e2e` | end-to-end API behaviour | yes | 108 |

`npm test --quiet` (or `node scripts/test-all.js --quiet`) prints only the summary table.

### How the summary is aggregated

Each suite prints a machine-readable line at the end:

```
TEST_SUMMARY {"suite":"e2e","total":108,"passed":108,"failed":0}
```

`scripts/test-all.js` runs each suite as a child process and parses those lines, rather than scraping human output. A
suite that crashes without emitting one is reported as `CRASHED`, not silently counted as zero.

### allocation — the money invariants

`scripts/check-allocation.js` property-tests `allocate()`, the largest-remainder distribution every share in the app
depends on. Nine hand-picked cases plus **20,000 randomised allocations**, asserting that shares always add back to
the whole, are never negative, and that a member with zero meals is charged nothing.

It does not copy the algorithm. `scripts/allocate.js` reads `src/lib/settlement.ts`, extracts the real `allocate()`
body and evaluates it, so the test can never drift from the shipped code. If the signature changes the extraction
fails loudly rather than testing a stale copy.

This was verified by deliberately breaking `allocate()` (`remainder > 0` → `remainder > 1`) and confirming 5 checks
failed, including the fuzz test, before restoring it.

### meal-rate — the reported scenario

`scripts/check-meal-rate.js` rebuilds the exact situation from the bug report — ৳1040 of bazar on day 1 only, meals
spread across days 1-5 — and asserts the month rate is used, every member is charged in proportion to what they ate,
and the day charges add back to ৳1040 to the paisa.

## What it covers
## What it covers

| Area | Checks | Notable cases |
| --- | --- | --- |
| Public routes | 5 | `/guide` is reachable signed-out and renders real content; API rejects anonymous callers |
| Auth | 4 | login, session identity, wrong password rejected |
| Groups & membership | 9 | creation, invitation, acceptance, member count; members cannot create groups |
| Group settings | 5 | rate mode persists, invalid mode rejected, members cannot change settings |
| Meals | 5 | today applies immediately, counts clamped, past days locked, cannot edit someone else's meals |
| Past-meal approvals | 13 | edit window opens, edit becomes a *request*, table unchanged until approved, group notified, window closes |
| Expense categories | 9 | seeding, code derivation, duplicates, reserved `BAZAR`, XSS rejected, rename, delete |
| Bazar & bills | 8 | equal split sums exactly, custom split must balance, unknown type rejected |
| Settlement maths | 16 | shares tie to totals, due formula holds per member, grocery buyer credited, nothing unallocated, per-type shares tie to each member's bill share and to the bills total, day charges add back to total bazar, no day with meals priced at zero |
| Payments | 5 | recording, permissions, negative rejected, due drops by exactly the amount paid |
| Month closing | 9 | close, double-close refused, carry-forward appears next month, reopen cancels it |
| Closed groups | 7 | writes blocked, history readable, hidden from lists, visible with `includeInactive` |
| Cross-group access | 3 | non-members blocked from reading and writing |
| Notifications | 6 | feed, unread count, links, mark-all-read |
| Dashboard | 4 | supervisor and member views |

## The money assertions

These are the ones worth keeping forever, because they are what the original bug report was about:

```js
check('meal shares sum exactly to bazar spend', near(mealShareSum, totals.bazar));
check('bill shares sum exactly to bills total', near(billShareSum, totals.bills));
check('due formula holds', near(m.due, m.carryIn + m.mealCost + m.billShare - m.bazarPaid - m.collected));
check('no bazar left unallocated', near(totals.unallocatedBazar, 0));
```

If a future change reintroduces the rounding drift or the dropped-bazar bug, these fail immediately.

The `allocation` suite proves the property these depend on: that `allocate()` never loses or invents a paisa.

## Test data

Every run generates a random tag and creates its own users (`e2e-<tag>-sup@example.com`) and group, then deletes all
of it in a `finally` block — including on failure. It does not touch existing data.

## Two gotchas worth remembering

**Dates are UTC.** The server derives "today" from `todayKey()` in UTC. An early version of this suite hardcoded
`2026-08-01` as a past day and produced seven false failures because, in UTC, it was still today. Past dates are now
computed as `now - N days` from the same clock the server uses.

**Registration does not set a password.** `POST /api/auth/register` deliberately creates the user with an empty
password and emails a setup link. The suite therefore seeds the password hash directly with the same scrypt
parameters the app uses, rather than pretending registration logs you in.

**Email MX checks.** `EMAIL_REQUIRE_MX=false` is needed for `@example.com` test addresses, since that domain has no MX
record. Run the dev server with it set:

```bash
EMAIL_REQUIRE_MX=false npm run dev
```

## What is not covered

- Browser rendering and client-side interaction (no Playwright/Cypress in the project).
- Email delivery — the mailer is exercised only as far as "does not throw"; SMTP is not configured in dev.
- Load and concurrency.
- The admin panel's own screens, beyond the settings API.

If you want browser-level coverage later, Playwright is the natural addition and would reuse the same seeding
helpers.
