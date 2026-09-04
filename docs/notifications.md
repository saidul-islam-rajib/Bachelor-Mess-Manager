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

- `GET /api/notifications` → `{ notifications, unreadCount, meta }`, newest 20
- `GET /api/notifications?page=2&pageSize=20&unread=true` → the same shape, paginated and filtered
- `PATCH /api/notifications` → mark every unread one read, returns the refreshed feed
- `PATCH /api/notifications/<id>` → mark one read

Passing no `page`/`pageSize` keeps the bell's original 20-item feed, so the dropdown never pays for pagination it
does not use. Everything is scoped to the session user, so an id from another account updates nothing.

## Client

`NotificationsProvider` holds the bell feed: it polls every 60s, refreshes when the tab regains focus, and marks
read optimistically.

Two surfaces read from it:

- **The bell** — the newest 20, merged with pending invitations. On phones the panel is a sheet pinned under the
  header (`position: fixed`, measured from the button) instead of a dropdown anchored to the button's right edge,
  which used to hang off the left of the screen: the old `max-w-[calc(100vw-2rem)]` guard was invalid CSS —
  `calc()` needs spaces around its operators — so it never applied.
- **`/notifications`** — the full history, paginated, with an All/Unread filter and *Mark all read*. It fetches its
  own page rather than reading the provider, because the provider deliberately caps at 20.

Tapping any notification marks it read and follows its stored `link` to the thing it is about. The link is the
point of a notification, so neither surface intercepts it.

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
| `MENTION_COMMENT` / `MENTION_REPLY` / `MENTION_EXPENSE_COMMENT` | the mentioned member | someone wrote `@name` in a group thread |
| `MENTION_COMMUNITY` | the mentioned member | someone wrote `@name` in the [community room](community.md) |
| `COMMUNITY_WELCOME` | the new member | their account was approved |
| `MEAL_PROMPT` | one member | the daily [one-tap meal ask](meal-prompts.md); the link answers it without signing in |
| `BAZAR_DUTY_REMINDER` | the on-duty member | the [bazar duty reminder](bazar-duty-reminders.md), at each mess's own configured time (07:00 by default), sent by email, bell and push |
