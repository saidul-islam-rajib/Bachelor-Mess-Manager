# Notifications

The bell used to render pending invitations and nothing else. There was no way to tell somebody that their meals had
been changed, that a request needed their decision, or that a month had been closed.

## Model

`Notification` — `userId`, optional `actorId` and `groupId`, `type`, `title`, `body`, `link`, `readAt`.
Indexed on `(userId, readAt, createdAt)` for the unread query and `(groupId, createdAt)` for group history.

Invitations keep their own table and are merged into the bell at read time. They are not notifications — they are
actionable records with accept/decline semantics and their own lifecycle, and collapsing them would mean rebuilding
that on top of a read flag.

## Library

`src/lib/notifications.ts`:

- `createNotifications(userIds, input)` — one `createMany`, deduped.
- `notifyUsers(recipients, input)` — persist + email.
- `groupAudience(groupId, { excludeUserId })` — active members plus the supervisor, deduped.
- `notifyGroup(groupId, input, { excludeUserId, email })` — the common case.

Emails are **fire-and-forget** (`void Promise.allSettled`). A supervisor editing one past meal in a ten-person mess
should not wait ten SMTP round-trips before their save returns. Nothing user-facing depends on delivery, and the
in-app notification is already committed by then. `isMailConfigured()` short-circuits the whole thing when SMTP is not
set up, so development never blocks on it.

Bodies are trimmed to 900 characters and HTML-escaped through `escapeHtml` (added to `src/lib/xss.ts`) before going
into the email template — the titles interpolate user-supplied names.

Links are stored relative and made absolute for email using `APP_URL` / `NEXT_PUBLIC_APP_URL`; if neither is set the
email simply omits the button rather than shipping a broken link.

## API

- `GET /api/notifications?limit=20&unread=true` → `{ notifications, unreadCount }`
- `PATCH /api/notifications` with `{ ids: [...] }` or `{ all: true }` → mark read

Both are scoped to the session user, so an id from another account updates nothing.

## Client

`NotificationsProvider` polls every 60s, but only while `document.visibilityState === 'visible'`, and refreshes
immediately when the bell opens or the tab is focused. An `inFlight` ref stops overlapping requests. Marking read is
optimistic and re-syncs on failure.

Polling is the right call at this size: it is one indexed query per minute per open tab, and it needs no socket
infrastructure in a deployment that already runs behind Jenkins/k8s without a message broker. If mess sizes grow into
the thousands, this is the seam to replace with SSE.

## Types

`NOTIFICATION_TYPES` in `src/lib/constants.ts`:

| Type | Sent to | When |
| --- | --- | --- |
| `MEAL_CHANGED_BY_SUPERVISOR` | whole group | a past meal was changed and applied |
| `MEAL_CHANGE_REQUESTED` | supervisor only | a member asked to change a past meal |
| `MEAL_CHANGE_APPROVED` / `MEAL_CHANGE_REJECTED` | the requester | a decision was made |
| `MONTH_CLOSED` / `MONTH_REOPENED` | whole group | a month was frozen or unfrozen |
| `MENTIONED` | the mentioned member | reserved for the existing mention flow |
