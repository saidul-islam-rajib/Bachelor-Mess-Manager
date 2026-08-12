# Switching notifications off

A mess that has settled into a routine does not need a bell every time somebody
is mentioned. An admin can now turn notifications off — all of them, or one
event at a time.

Page: Admin → Settings → **Notifications**. Policy:
`getNotificationPolicy()` in `src/lib/settings-service.ts`.

## What it covers, and what it deliberately does not

Two columns on `SiteSettings`:

| Column | Meaning |
| --- | --- |
| `notificationsEnabled` | Master switch. Off means nothing is sent, whatever the per-event list says. |
| `disabledNotificationTypes` | Comma-separated `NOTIFICATION_TYPES` that are off. Absent means on. |

Storing the **disabled** set rather than the enabled one matters: a notification
type added in a later release is live by default, instead of silently arriving
switched off because it was missing from an older row.

**Sign-in, registration and password email are never affected.** That is not a
special case in the check — those messages never enter the notification
pipeline at all. `passwordSetupEmail` and `passwordResetEmail` go straight
through the mailer, so there is no setting an admin can reach that locks a
member out of their own account. The verification asserts sign-in and
forgot-password still work with the master switch off.

## Where it is enforced

Three writes create notifications, and all three are gated:

| Path | Used by |
| --- | --- |
| `createNotifications()` | every `notifyUsers` / `notifyGroup` caller — meal changes, month closing, handovers, prompts |
| `notifyMentions()` | mentions in mess comments, replies and bazar entries |
| `notifyCommunityMentions()` | mentions in the community room |

The second and third are the ones worth calling out. Both write through
`prisma.notification.createMany` **directly** rather than going through
`createNotifications`, so gating the shared helper alone left the four
`MENTION_*` types — by far the most frequent notifications — still firing with
the setting off. The verification caught exactly that: the "off" assertions
failed while the "on" ones passed. Any future notification path needs the same
check; the three call sites are the complete list today.

Emails are gated in `deliverEmails` by the same predicate, so switching an event
off stops both the bell and the mail.

## Cost

`getNotificationPolicy()` is cached for 30 seconds beside the security, meal-edit
and supervisor policies, and the settings write clears all of them. So the check
costs nothing per notification in the normal case, and an admin's change takes
effect on the next request rather than after a restart.

## Verified

Nine invariants against the running app: a mention raising a notification while
enabled, none once that event is switched off, a *different* event staying
unaffected, the master switch suppressing everything, the setting persisting,
an unknown event type being refused with a 400, sign-in still working with
notifications off, forgot-password still working, and notifications flowing
again once restored.
