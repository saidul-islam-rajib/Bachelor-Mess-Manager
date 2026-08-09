# Visit tracking

Admin → Activity answers "who is actually using this?" — how often each member turns up, when in the day they come,
and how long they stay.

## What a "visit" is

One row in `UserSession`. A visit opens when a signed-in member first appears, and stays open while they keep using
the app. It closes after **30 minutes** with no activity (`SESSION_IDLE_GAP_MS`), or the moment they sign out.

Three things open or extend a visit:

| Trigger | Where | Behaviour |
| --- | --- | --- |
| Signing in | `POST /api/auth/login` | Always starts a **new** visit — the previous one is closed as `REPLACED` |
| Loading any page | `GET /api/auth/me` | `UserProvider` calls this on every full page load, so an already-signed-in member who just returns to the site is counted |
| Staying on a page | `POST /api/auth/heartbeat` | `PresenceTracker` pings every 60 seconds |

The `/api/auth/me` path is the one that matters for the common case. Sessions are long-lived cookies, so most people
never log in again after the first time — without it, a member who visits daily for a month would show one visit.

## How "how long they stayed" is measured

`seconds` is an accumulator, not `endedAt − startedAt`. Each heartbeat credits the gap since the last one, capped at
`SESSION_MAX_HEARTBEAT_GAP_MS` (3 minutes).

The cap is what makes the number mean anything. Without it, a tab left open over lunch and clicked once on return
would credit the whole hour. With it, a missed run of heartbeats can only ever add 3 minutes.

`PresenceTracker` reinforces this from the client side: it only sends a heartbeat if the tab is **visible** and there
has been real interaction (pointer, key, scroll, touch, focus) since the last one. A tab parked on the dashboard all
afternoon contributes nothing. So the figure is engaged time, not tab-open time — which is the honest reading of
"how long they stayed".

## Time of day

`startHour`, `startWeekday` and `startDay` are written at visit-open time in the app's display timezone
(`APP_TIME_ZONE`, now defaulting to `Asia/Dhaka` — see [time-zones.md](time-zones.md)). Denormalising them means the
analytics queries are plain `groupBy` calls with no timezone arithmetic in SQL, and no risk of the buckets drifting
because the server's `TZ` changed.

Because the value is written once and stored, rows recorded before a zone change keep the bucket they were recorded
in. That is the right trade for analytics — the alternative is re-bucketing history every time the setting moves.

## Drilling into a device

The device chips are clickable and open the members behind the count — see
[activity-device-drilldown.md](activity-device-drilldown.md).

Buckets:

| Bucket | Local hours |
| --- | --- |
| Morning | 05:00–11:00 |
| Midday | 11:00–15:00 |
| Afternoon | 15:00–18:00 |
| Evening | 18:00–22:00 |
| Night | 22:00–05:00 |

Changing `APP_TIME_ZONE` does **not** rewrite history — rows already stored keep the stamps they were written with.

## What admins see

`GET /api/admin/activity?days=30&sort=visits&search=` (permission: `security.manage`) returns one report:

- **Overview** — visits, distinct visitors, total and average time, online now (seen in the last 5 minutes), visits
  today, and how many accounts have **never** visited.
- **Time of day** — the five buckets plus a 24-hour strip.
- **Which days** — visits by weekday.
- **Devices** — mobile / tablet / desktop, from the user agent.
- **Day by day** — visits and distinct visitors per day (last 30 days when the range is "all time").
- **Top members** — ranked 1 to 100, sortable by visits, by time on site, or by most recently seen. `truncated` says
  whether anyone fell outside the hundred.

`GET /api/admin/activity/[userId]` pages through one member's individual visits: when they arrived, how long they
stayed, which part of the day, which device, and how the visit ended.

## What is deliberately not tracked

- **Anonymous visitors.** Every row is tied to a `userId`. There is no cookie for logged-out traffic, so the numbers
  are about members, not marketing.
- **Impersonation.** When an admin impersonates a member (`/api/admin/impersonate`), neither `me` nor `heartbeat`
  records anything. Otherwise an admin's support session would show up as the member being unusually active.
- **Which pages they viewed.** Only that they were present. Adding per-page tracking would mean a write on every
  navigation and a much larger table for a question nobody has asked yet.

## Retention

Nothing prunes `UserSession` today. At roughly one row per member per visit it stays small for a mess-sized
deployment, but a scheduled delete of rows older than a year is the obvious next step if it ever grows.
`deleteUserPermanently` already clears a user's rows, and the FK is `ON DELETE CASCADE` as a backstop.
