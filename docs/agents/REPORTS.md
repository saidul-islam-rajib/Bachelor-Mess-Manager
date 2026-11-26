# Progress reports

Written by `qa` each time overall progress passes another 10%. Newest first.

## 2026-11-26: 40% (15/35 done)

### architect
- Finished since last report: A4 (ADR-004: `ci.yml` on GitHub-hosted runners, deploy only from `develop`, EAS by owner only).
- In progress: none. A5 (break ADRs into tasks) is now unblocked.
- Blocked: none.

### fixer
- Finished: F12 (audit of collections, found F22-F24), F19 (mobile token auth: `/api/mobile/v1/auth/login`, `refresh`, `logout`, bearer fallback, web login unchanged).
- In progress: none. F13, F14, F22, F23 (P0) are queued.
- Blocked: none.

### android
- Finished: none.
- In progress: none. D1 waits for A5.
- Blocked: A5.

### ios
- Finished: I1 (Expo SDK 58 app in `mobile/`, sign-in and server picker).
- In progress: none. I2 (iPhone run guide) is next.
- Blocked: none.

### qa
- Finished: Q1; merged A4, F19 and I1 after typecheck, lint, allocation, mobile-auth (29/29) and mobile tsc, eslint, jest passed. `check-mail`, `check-meal-rate` and `check-signup-flow` fail the same way on the base branch (need a database or env), not from these merges.

### Try on the iPhone now
Not yet: `docs/mobile-on-iphone.md` (I2) is not written. The app and the login API now exist, so I2 is the next step.

### Owner decisions
- F11 and F14: should edits dated in a closed month be blocked, or only warned?

## 2026-11-26: 30% (11/30 done)

### architect
- Finished: A2 (ADR-002: bearer token beside cookie sessions, `/api/mobile/v1/auth/*`), A3 (ADR-003: standalone `mobile/`, ios leads, android owns `*.android.*`).
- In progress: none. A4 is next.
- Blocked: A5 waits for A4.

### fixer
- Finished: F7 (DAILY mode charges per day), F9 (closed group blocks bill edit/delete), F10 (bill amount edit keeps original share holders).
- In progress: none. F12, F13, F14 (P0) and F19 (mobile auth) are queued.
- Blocked: F8 waits on nothing now (F7 done).

### android
- Finished: none.
- Blocked: D1 waits for A4-based rewrite (A5) and the ios scaffold.

### ios
- Finished: none.
- In progress: none. I1 is unblocked (A1, A2, A3 done); I2 waits for I1.

### qa
- Finished: Q1; merged A3 and F10, all checks pass.
- In progress: none.

### Try on the iPhone now
Nothing yet. The app does not exist until I1 is done.

## 2026-11-26: 20% (6/28 done)

### architect
- Finished: A1 (ADR-001: one Expo React Native app, SDK 58).
- In progress: none. A2 to A4 are next.
- Blocked: A5 waits for A2, A3, A4.

### fixer
- Finished: F3 (bills audit, found F9 to F11), F4 (payments, settlement and closing audit, found F13 to F18).
- In progress: none. F7, F9, F10, F12, F13, F14 (all P0) are queued.
- Blocked: F8 waits for F7.

### android
- Finished: none.
- Blocked: D1 waits for A2, A3.

### ios
- Finished: none.
- Blocked: I1 waits for A2, A3; I2 waits for I1.

### qa
- Finished: Q1 (acceptance checklist at `docs/agents/ACCEPTANCE.md`).
- In progress: none.

### Try on the iPhone now
Nothing yet. The app does not exist until I1 is done.

### Owner decisions
- F11 and F14: should a bill or payment dated in a closed month be blocked, or only warned about?

## 2026-11-26: 10% (2/17 done)

### architect
- Finished: none.
- In progress: A1 sent back to `todo`; ADR-001 must follow the owner message and `MOBILE-REFERENCE.md`.
- Blocked: A2 to A5 not started.

### fixer
- Finished: F1 (typecheck and lint already clean), F2 (meal audit, found F7 and F8).
- In progress: none. F3 to F6 audits and F7 are queued.
- Blocked: F8 waits for F7.

### android
- Finished: none.
- Blocked: D1 waits for A1, A2, A3.

### ios
- Finished: none.
- Blocked: I1 and I2 wait for A1, A2, A3.

### qa
- Finished: none.
- In progress: Q1 acceptance checklist not started.

### Try on the iPhone now
Nothing yet; the mobile app does not exist until I1 is done.

### Owner decisions
None yet.
