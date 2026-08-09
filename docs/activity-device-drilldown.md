# Who is on mobile

The device chips under **Which days** were a dead end: `Mobile 17 · Desktop 3` told you the shape of your audience but
not who was in it. "17 visits from mobile" is the wrong unit anyway — one member checking their meals five times a day
looks like five mobile users.

The chips are buttons now. Clicking one opens the members behind that number.

## The endpoint

`GET /api/admin/activity/devices?device=MOBILE&days=30&sort=visits&search=&page=1&pageSize=20`

It sits beside `activity/[userId].ts`; a literal segment beats a dynamic one in the Next.js router, so `devices` never
resolves as a user id.

Three grouped queries, then a join in memory:

| query | gives |
| --- | --- |
| `groupBy userId` where `device` matches | visits, seconds, first and last seen on **that** device |
| `groupBy userId, device` over the whole period | each member's total visits and which other devices they use |
| distinct `userId` seen in the online window | the online dot |

The second query is what makes the modal answer the interesting question. A row reads *"14 visits, 82% of their
visits, also uses Desktop"* — so you can tell a phone-only member apart from someone who happens to check on their
phone at the weekend. Members who only ever used this device get an **Only device** badge.

Sorting, the period and the search box are inherited from the panel rather than duplicated in the modal — open it
while filtered to "Last 7 days" and you get the last seven days. Paging is applied after sorting and filtering, so the
page-1 rows really are the top rows.

## Permissions and cost

Same gate as the rest of the panel: `security.manage`, which only Admin carries by default and which
[member-permissions.md](member-permissions.md) can grant or revoke per person.

Everything is derived from `UserSession` rows that already exist for the activity report — no new table, no new write
path, no extra column. The cost is three grouped reads per modal open.

## Resource strings

The panel used to hold about forty hardcoded English strings. They are now under `strings.admin.activity`, and two new
shared maps carry the enum labels that were previously inlined in `user-sessions.ts`:

- `strings.devices` — `MOBILE` / `TABLET` / `DESKTOP`
- `strings.timeBuckets` — `MORNING` … `NIGHT`

`TIME_BUCKETS` and `WEEKDAY_LABELS` now read their labels from the catalogue (weekdays reuse the existing
`strings.weekdays`), so the labels the API returns and the labels the UI renders can no longer drift apart.
