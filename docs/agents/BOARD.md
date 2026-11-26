# Board

Rules are in `PROTOCOL.md`.

## Tasks

| ID | Owner | Pri | Status | Depends | Task | Branch | Note |
|----|-------|-----|--------|---------|------|--------|------|
| A1 | architect | P0 | review | | Choose the mobile stack (native Kotlin and Swift, or one shared codebase) and record ADR-001 | agents/architect/A1-mobile-stack | ADR-001 accepted: Expo React Native, EAS builds; qa to merge |
| A2 | architect | P0 | todo | | Decide how the mobile apps sign in and call the API (token auth beside cookie sessions, API versioning, OpenAPI contract) and record ADR-002 | | |
| A3 | architect | P1 | todo | A1 | Repo layout for mobile code, which paths android and ios each own, and the checks each runs; ADR-003 | | |
| A4 | architect | P1 | todo | A1 | CI/CD and Docker: backend image, mobile build and release lanes, what runs on `agents/*` pushes versus `develop`; ADR-004 | | |
| A5 | architect | P1 | todo | A2,A3,A4 | Break the accepted ADRs into one-run tasks for android, ios and fixer on this board | | |
| F1 | fixer | P0 | done | | Make `npm run typecheck` and `npm run lint` pass cleanly | | Already clean on agents/integration, no change needed |
| F2 | fixer | P0 | todo | | Audit meal rate and the meal cost split; add one F row per bug found | | |
| F3 | fixer | P0 | todo | | Audit bills, bill collections and vendor-paid bills; add one F row per bug found | | |
| F4 | fixer | P0 | todo | | Audit payments, dues, settlement, final settlement and month closing; add one F row per bug found | | |
| F5 | fixer | P1 | todo | | Audit rounding, time zones and month boundaries across reports and dashboards; add one F row per bug found | | |
| F6 | fixer | P1 | todo | | Audit permission checks on API routes that change money or membership; add one F row per bug found | | |
| D1 | android | P1 | todo | A1,A2,A3 | Scaffold the Android app per ADR-001 and ADR-003, with sign-in against the API | | |
| I1 | ios | P1 | todo | A1,A2,A3 | Scaffold the iOS app per ADR-001 and ADR-003, with sign-in against the API | | |
| Q1 | qa | P1 | todo | | Turn `requirements.md` and `docs/*.md` into an acceptance checklist at `docs/agents/ACCEPTANCE.md`, and add rows for any gaps | | |

## Messages
