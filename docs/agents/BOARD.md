# Board

Rules are in `PROTOCOL.md`.

Last progress report: 10%

## Tasks

| ID | Owner | Pri | Status | Depends | Task | Branch | Note |
|----|-------|-----|--------|---------|------|--------|------|
| A1 | architect | P0 | todo | | Choose the mobile stack (native Kotlin and Swift, or one shared codebase) and record ADR-001 | agents/architect/A1-mobile-stack | QA bounced: stack choice is fine, but ADR-001 ignores the owner message and MOBILE-REFERENCE.md. Fix on the existing branch: pin Expo SDK 58 (not latest), Expo Go modules only (no dev builds/config plugins needing them), add server address setting (MESS_API_URL), and Expo Go on iPhone as first test path; Checks line per reference |
| A2 | architect | P0 | todo | | Decide how the mobile apps sign in and call the API (token auth beside cookie sessions, API versioning, OpenAPI contract) and record ADR-002 | | |
| A3 | architect | P1 | todo | A1 | Repo layout for mobile code, which paths android and ios each own, and the checks each runs; ADR-003 | | |
| A4 | architect | P1 | todo | A1 | CI/CD and Docker: backend image, mobile build and release lanes, what runs on `agents/*` pushes versus `develop`; ADR-004 | | |
| A5 | architect | P1 | todo | A2,A3,A4 | Break the accepted ADRs into one-run tasks for android, ios and fixer on this board | | |
| F1 | fixer | P0 | done | | Make `npm run typecheck` and `npm run lint` pass cleanly | | Already clean on agents/integration, no change needed |
| F2 | fixer | P0 | done | | Audit meal rate and the meal cost split; add one F row per bug found | | Audit only, no code changed; found F7 and F8 |
| F3 | fixer | P0 | todo | | Audit bills, bill collections and vendor-paid bills; add one F row per bug found | | |
| F4 | fixer | P0 | todo | | Audit payments, dues, settlement, final settlement and month closing; add one F row per bug found | | |
| F5 | fixer | P1 | todo | | Audit rounding, time zones and month boundaries across reports and dashboards; add one F row per bug found | | |
| F6 | fixer | P1 | todo | | Audit permission checks on API routes that change money or membership; add one F row per bug found | | |
| F7 | fixer | P0 | todo | | In DAILY mode `src/lib/settlement.ts` charges members `allocate(totalBazarPaisa, unitsByMember)` (month pooling), not each day's `pricedByDay` share split over that day's meals as `docs/settlement.md` says. Input: 2 members, day1 A 5 meals B 0 with 1040 bazar, day2 A 0 B 5 with 0 bazar and no later shopping; DAILY gives A and B the same per-meal cost for different days, and `Σ day.cost` differs from `Σ member.mealCost`. Add a check that fails, then charge per day and pool only unallocated bazar | | |
| F8 | fixer | P1 | todo | F7 | In DAILY mode `totals.mealRate` is set to `ratioRate` (`headlineRate = ratioRate` in `src/lib/settlement.ts`); `docs/settlement.md` says it is the mean of the day rates (`averageDayRate`). Input: docs example gives 69.33 instead of 77.65. Confirm intended with qa if unclear, fix code or doc | | |
| D1 | android | P1 | todo | A1,A2,A3 | Scaffold the Android app per ADR-001 and ADR-003, with sign-in against the API | | |
| I1 | ios | P0 | todo | A1,A2,A3 | Scaffold the iOS app per ADR-001 and ADR-003, with sign-in against the API | | |
| I2 | ios | P0 | todo | I1 | Write `docs/mobile-on-iphone.md`: the owner's steps to run the backend on the laptop and open the app on the iPhone in Expo Go, and keep it true as the app changes | | |
| Q1 | qa | P1 | todo | | Turn `requirements.md` and `docs/*.md` into an acceptance checklist at `docs/agents/ACCEPTANCE.md`, and add rows for any gaps | | |

## Messages

- owner -> architect (A1,A3): I test on an iPhone in Expo Go first, Android later. Align ADR-001 and ADR-003 with `docs/agents/MOBILE-REFERENCE.md` (Expo SDK 58, Expo Go modules only, server address setting).
