# Acceptance checklist

Source: `requirements.md` and `docs/*.md`. QA checks work against the rows that apply. `Gap` marks a rule that is open on the board or has no check yet.

## Roles and groups

- [ ] Admin registers users, assigns supervisors, removes users, manages comments (`requirements.md`, `docs/supervisors.md`).
- [ ] A supervisor creates at most 10 groups.
- [ ] A member is active in only one group at a time.
- [ ] Regular members cannot manage membership.
- [ ] Per-member permission exceptions (read only, follow the role) are enforced on every route (`docs/member-permissions.md`). Gap: F6 audits money and membership routes.
- [ ] A closed group accepts no writes: bazar, bills, payments, meals, meal-edit window, closings, final settlement (`docs/group-deactivation.md`). Gap: F9, F13.
- [ ] Closing a group frees the supervisor's slot and hides the group.

## Meals

- [ ] Members add or edit meals for today and later dates only; the supervisor can adjust any date.
- [ ] Past-day edits go through the approval request flow (`docs/meal-edit-approvals.md`).
- [ ] Meal prompts and bazar duty reminders follow their docs (`docs/meal-prompts.md`, `docs/bazar-duty-reminders.md`).

## Money (a regression here blocks a merge)

- [ ] Settlement matches `docs/settlement.md`: no money vanishes, no rounding drift, members who left mid-month stay in the report. Gap: F7, F8.
- [ ] Per-member cost-type shares sum to `billShare`, and all members' shares sum to the group bills total.
- [ ] Bills split as recorded and shares are fixed at record time (`docs/bills.md`). Gap: F9, F10, F11.
- [ ] Bill collections and vendor-paid bills follow `docs/bill-collections.md`. Gap: F12.
- [ ] Payments are positive, at least 0.01, corrected by PATCH or reversal (`docs/payments.md`). Gap: F14, F15, F16.
- [ ] Closing a month freezes its figures and carries balances forward; no double closing (`docs/month-closing.md`). Gap: F14, F17.
- [ ] Final settlement is idempotent under double submit (`docs/final-settlement.md`). Gap: F18.
- [ ] Rounding, time zones and month boundaries agree across reports and dashboards (`docs/time-zones.md`). Gap: F5.
- [ ] Any change to how money is calculated comes with a before and after from its author.

## Dashboards and reports

- [ ] Member dashboard shows meals, meal cost, balance, rent and utility dues, meal rate, month summaries, payment status.
- [ ] Group and supervisor dashboards show totals, meal rate, who has paid, due report, longest-staying members.
- [ ] Monthly expense history pages exist.

## Profile, comments, notifications

- [ ] Members edit name, email, phone and photo (`docs/profile-photo-size.md`).
- [ ] Members comment; supervisor and admin view, reply and delete, never edit (`docs/community.md`).
- [ ] Notifications and their settings follow `docs/notifications.md` and `docs/notification-settings.md`.
- [ ] Password reset follows `docs/password-reset.md`.

## Mobile (from ADR-001, `docs/agents/MOBILE-REFERENCE.md`)

- [ ] One Expo SDK 58 app that runs in Expo Go on the owner's iPhone, with a server address setting.
- [ ] Sign-in works against the API (ADR-002).
- [ ] Mobile shows the same numbers as the web for the same group and month, including the meal rate (`docs/meal-rate-on-mobile.md`).
- [ ] Mobile text comes from platform string resources.

## Code rules

- [ ] No comments in source or config; no hardcoded UI text; database changes only as new Prisma migrations.
- [ ] `npm run typecheck`, `npm run lint`, `node scripts/check-allocation.js` pass.
