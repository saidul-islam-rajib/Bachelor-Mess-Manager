# Bazar-duty reminder

Nobody should have to remember whose turn it is to do the bazar. Each mess's
supervisor decides whether this runs at all and what time it fires (07:00
local time by default) — when it's due, the app tells that day's member three
ways: email, the notification bell, and — if they have opted in — a
phone-style push alert that arrives even with the browser closed.

Service: `src/lib/bazar-duty.ts` (`bazarDutyUserId`), `src/lib/push.ts`.
Dispatch route: `src/pages/api/bazar-duty/dispatch.ts`.

## The flow

1. **Gate.** Each `Group` has `bazarReminderEnabled` (default on) and
   `bazarReminderTime` (a `"HH:MM"` string, default `"07:00"`, interpreted in
   `APP_TIME_ZONE`). A disabled group is skipped outright. For the automatic
   cron path specifically (see below), a group is also skipped until the
   current local time reaches its configured time.
2. **Resolve.** For each remaining active group, `bazarDutyUserId(groupId, dateKey)`
   looks up who is assigned today's day-of-month in that group's
   `BazarSchedule` / `BazarDutyDay` rows, auto-generating an equal-split
   rotation via `ensureSchedule()` if the month has never been opened yet, and
   confirming the assignee is still an active member.
3. **Dedupe.** A `BazarDutyReminder` row (`userId`, `groupId`, `date`) is
   written with a `create()` guarded by a unique constraint, mirroring how
   `MealPrompt` guarantees one prompt per member per group per day. A retry or
   a manual re-trigger the same day hits the unique constraint and sends
   nothing twice.
4. **Deliver.** `notifyUsers()` writes the in-app `Notification` row and, when
   SMTP is configured, a plain email through the generic notification
   template (no bespoke email layout needed — this isn't interactive like the
   meal prompt's yes/no buttons). `sendPushToUser()` additionally pushes to
   every device the member has subscribed from.

## Per-mess settings

A supervisor (or co-supervisor, or an admin) controls this from
**Members → Settings → Bazar duty reminder**
(`src/components/members/GroupSettings.tsx`):

- **Send the daily reminder** — the `bazarReminderEnabled` toggle. Off means
  nobody in that mess gets a reminder, however the site-wide
  `BAZAR_DUTY_REMINDER` notification setting is configured (see below) — the
  two checks are independent and both must pass.
- **Reminder time** — the `bazarReminderTime` field (an HTML `<input
  type="time">`), validated server-side as `HH:MM` in `src/lib/month.ts`
  (`isTimeOfDay`). It is always interpreted in the app's configured time zone
  (`APP_TIME_ZONE`), not the browser's — a supervisor in one time zone setting
  the time for a mess in another should think in the mess's local time.

Both fields are read/written through the existing `PATCH /api/groups/[id]`
route, gated by `canManageGroup` like every other group setting.

## Push notifications ("the alarm")

Members opt in from **Profile → Bazar duty alarm**. Enabling it:

1. Asks the browser for notification permission.
2. Subscribes the service worker (`public/sw.js`, already wired for `push`
   and `notificationclick`) to the browser's push service using the VAPID
   public key.
3. Posts the subscription (`endpoint`, `p256dh`, `auth`) to
   `POST /api/push/subscribe`, stored as a `PushSubscription` row.

`POST /api/push/unsubscribe` removes it again. Both routes require a session
— there is no anonymous push subscription. A subscription that the browser
has revoked comes back from the push service as HTTP 404/410, at which point
`sendPushToUser()` deletes the stale row itself rather than retrying it forever.

Without `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` set, `isPushConfigured()` is
false: the alarm toggle stays hidden on Profile and `sendPushToUser()` is a
no-op. Email and the bell are unaffected — push is strictly additive.

Generate a keypair with:

```
node -e "console.log(require('web-push').generateVAPIDKeys())"
```

`VAPID_PUBLIC_KEY` is safe in the browser bundle (see `next.config.mjs`'s
`BROWSER_ENV_KEYS`); `VAPID_PRIVATE_KEY` must stay server-only, same treatment
as `SMTP_PASSWORD`.

## Running the job

```
BAZAR_REMINDER_DISPATCH_SECRET="..." npm run bazar:remind
```

The script posts to `/api/bazar-duty/dispatch` with the secret in the
`x-dispatch-secret` header. It reads `APP_URL` to find the app, and
`BAZAR_REMINDER_GROUP_ID` / `BAZAR_REMINDER_DATE` narrow a manual run to one
group or one day. The job is idempotent per member, per group, per day, so a
retry or an overlapping run sends nothing twice.

Because each mess can pick its own reminder time, the automatic job has to be
checked often rather than run once at a fixed hour. On Kubernetes,
`k8s/base/bazar-reminder-cronjob.yaml` runs it every 5 minutes against the
in-cluster service, and the dispatch route itself decides, per group, whether
that group's configured time has arrived yet:

```
kubectl apply -f k8s/base/bazar-reminder-cronjob.yaml
```

Like the meal-prompt, settlement and backup CronJobs it is applied on its own
rather than through the base kustomization, so a cluster can run the app
without it. Put `BAZAR_REMINDER_DISPATCH_SECRET` in the `bachelor-point-secrets`
Secret first — without it the job exits non-zero and sends nothing. Anywhere
else, any cron that can run `npm run bazar:remind` every few minutes with the
same environment will do.

**On a plain `docker compose` deployment** (the `docker-compose.yml` at the
repo root — a single VPS running `db` / `migrate` / `app`, no Kubernetes),
there is a fourth service, `cron`, built from the same image as `app` and
running `node scripts/cron-loop.js`. That script is a small, dependency-free
in-process scheduler (`setInterval`, no OS cron involved) that spawns
`scripts/send-bazar-reminders.js` every 5 minutes with `env: process.env` —
deliberately avoiding OS/container cron daemons entirely, since whether they
pass environment variables through to the jobs they spawn varies and is easy
to get wrong silently. `docker compose up -d --build` picks it up like any
other service.

This only works once `BAZAR_REMINDER_DISPATCH_SECRET` is a real secret in
whatever supplies `docker-compose.yml`'s environment on that host (its own
`.env` file, or the shell environment `docker compose` runs in) — the compose
file's checked-in fallback (`local-dev-bazar-reminder-secret`) is for local
development only, and email/push need `SMTP_*` / `VAPID_*` set there too
(the `app` service's `environment:` block now passes all of these through;
previously it passed through none of them, so on a deployment matching this
file as checked in, **no outbound mail of any kind — not just this feature —
could have been sending**, regardless of what `.env` on the host contained,
because compose only forwards variables a service's `environment:` block
explicitly names).

**The time-of-day gate only applies to this automatic, secret-authenticated,
no-explicit-date path.** Two things bypass it and send immediately (subject
only to the group's `bazarReminderEnabled` flag and the once-per-day dedupe):
a supervisor or admin triggering `POST /api/bazar-duty/dispatch` from an
authenticated session (there is no "wait for the schedule" for a deliberate
manual send, same as meal-prompt's "Ask everyone about meals" button), and a
secret-authenticated call that passes an explicit `date` (a backfill/testing
run, not the routine tick).

## Notification settings

Two independent switches gate delivery, and both must allow it:

- **Per-mess** — `Group.bazarReminderEnabled` / `Group.bazarReminderTime`,
  set by that mess's supervisor (see above).
- **Site-wide** — `BAZAR_DUTY_REMINDER` is a normal entry in
  `NOTIFICATION_TYPES` (`src/lib/constants.ts`), so an admin can switch it off
  entirely from Admin → Settings → Notifications, same as any other type (see
  [notification-settings.md](notification-settings.md)).

The dispatch route checks both before writing the dedup row, so flipping
either switch off and back on the same day still sends the reminder rather
than treating it as already handled.

## Security notes

- `/api/bazar-duty/dispatch` accepts either the dispatch secret or a
  signed-in admin/supervisor session, identical to
  `/api/meal-prompts/dispatch`.
- `/api/push/subscribe` and `/api/push/unsubscribe` both require a session
  and only ever touch the calling user's own `PushSubscription` rows.
- A push payload carries only a title, a body and a relative URL — no account
  data beyond the group name.
- All routes go through the standard rate limiting and audit wrapper
  (`withAudit`) like every other API route.
