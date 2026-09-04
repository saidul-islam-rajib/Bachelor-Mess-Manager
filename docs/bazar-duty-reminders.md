# Daily bazar-duty reminder

Nobody should have to remember whose turn it is to do the bazar. Every
morning at 7am (Asia/Dhaka), the app tells the member on duty three ways:
email, the notification bell, and — if they have opted in — a phone-style
push alert that arrives even with the browser closed.

Service: `src/lib/bazar-duty.ts` (`bazarDutyUserId`), `src/lib/push.ts`.
Dispatch route: `src/pages/api/bazar-duty/dispatch.ts`.

## The flow

1. **Resolve.** For each active group, `bazarDutyUserId(groupId, dateKey)`
   looks up who is assigned today's day-of-month in that group's
   `BazarSchedule` / `BazarDutyDay` rows, auto-generating an equal-split
   rotation via `ensureSchedule()` if the month has never been opened yet, and
   confirming the assignee is still an active member.
2. **Dedupe.** A `BazarDutyReminder` row (`userId`, `groupId`, `date`) is
   written with a `create()` guarded by a unique constraint, mirroring how
   `MealPrompt` guarantees one prompt per member per group per day. A retry or
   a manual re-trigger the same day hits the unique constraint and sends
   nothing twice.
3. **Deliver.** `notifyUsers()` writes the in-app `Notification` row and, when
   SMTP is configured, a plain email through the generic notification
   template (no bespoke email layout needed — this isn't interactive like the
   meal prompt's yes/no buttons). `sendPushToUser()` additionally pushes to
   every device the member has subscribed from.

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

## Running the daily job

```
BAZAR_REMINDER_DISPATCH_SECRET="..." npm run bazar:remind
```

The script posts to `/api/bazar-duty/dispatch` with the secret in the
`x-dispatch-secret` header. It reads `APP_URL` to find the app, and
`BAZAR_REMINDER_GROUP_ID` / `BAZAR_REMINDER_DATE` narrow a manual run to one
group or one day. The job is idempotent per member, per group, per day, so a
retry or an overlapping run sends nothing twice.

On Kubernetes, `k8s/base/bazar-reminder-cronjob.yaml` runs it daily at 07:00
Asia/Dhaka against the in-cluster service:

```
kubectl apply -f k8s/base/bazar-reminder-cronjob.yaml
```

Like the meal-prompt, settlement and backup CronJobs it is applied on its own
rather than through the base kustomization, so a cluster can run the app
without it. Put `BAZAR_REMINDER_DISPATCH_SECRET` in the `bachelor-point-secrets`
Secret first — without it the job exits non-zero and sends nothing. Anywhere
else, any cron that can run `npm run bazar:remind` with the same environment
will do.

Supervisors can also trigger their own group by hand, and admins can trigger
every active group, by calling `POST /api/bazar-duty/dispatch` from an
authenticated session instead of the secret header.

## Notification settings

`BAZAR_DUTY_REMINDER` is a normal entry in `NOTIFICATION_TYPES`
(`src/lib/constants.ts`), so an admin can switch it off entirely from
Admin → Settings → Notifications, same as any other type (see
[notification-settings.md](notification-settings.md)). The dispatch route
checks the policy before writing the dedup row, so switching the type off and
back on the same day still sends the reminder rather than treating it as
already handled.

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
