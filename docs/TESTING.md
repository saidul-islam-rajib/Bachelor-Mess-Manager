# End-to-end tests

`scripts/e2e-test.js` drives the running application over real HTTP — same cookies, same middleware, same
authorisation checks a browser would hit. It is not a unit test suite; it is a check that the whole system behaves.

```bash
npm run dev          # in one terminal
npm run test:e2e     # in another
```

Latest run: **101 checks, 101 passing.**

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
| Settlement maths | 9 | shares tie to totals, due formula holds per member, grocery buyer credited, nothing unallocated |
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

`scripts/allocate-check.mjs`-style fuzzing of the allocator (20,000 random cases confirming shares always sum to the
whole) was run separately during development; the invariant it proves is the one the first two assertions above
depend on.

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
