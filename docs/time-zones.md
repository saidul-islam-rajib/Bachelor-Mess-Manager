# Which day is "today"

Every mess in this app is in one physical place, and that place has one calendar. A meal on the 9th is a meal on the
9th regardless of where the server sits. So the app has **one configured zone**, not a per-user one:

```
APP_TIME_ZONE="Asia/Dhaka"
```

The default used to be `UTC`, which is wrong for a Bangladeshi mess in a way that only showed up after midnight.
Dhaka is UTC+6, so between 00:00 and 06:00 local, `new Date().toISOString().slice(0, 10)` returns **yesterday**. A
member logging a meal at 1 AM was writing it against the previous day, the meals page highlighted the wrong row as
Today, and the settlement cut-off (`through`) stopped a day short.

## Two kinds of date, two rules

This is the distinction that makes the rest of the code make sense.

**Day keys** — `"2026-08-09"`. A calendar date with no time and no zone: a meal day, a bazar date, a month boundary.
Stored in Postgres as UTC midnight so the value round-trips exactly. Formatting one **must** use
`dateConfig.dayKeyTimeZone` (`UTC`); rendering it in any other zone shifts the label off the stored date.

**Instants** — `createdAt`, `lastSeenAt`, an invitation timestamp. A real moment in time. Formatting one **must** use
`appConfig.timeZone`, or the user reads a UTC clock.

`src/lib/format.ts` is the only place that knows this:

| helper | input | zone used |
| --- | --- | --- |
| `formatDayKey(day, style)` | day key | `dateConfig.dayKeyTimeZone` |
| `formatDay`, `formatMonthLabel` | day key | same, via `formatDayKey` |
| `formatInstant(iso, style)` | instant | `appConfig.timeZone` |
| `formatDate`, `formatDateTime` | instant | same, via `formatInstant` |

Both take a named style from a fixed set (`full`, `dayMonth`, `weekdayDayMonth`, `weekdayDay`, `weekdayLong`,
`monthYear`; `date`, `dateTime`, `dayMonthTime`, `dayMonth`, `time`) rather than inline `Intl` options, so a locale or
zone change lands everywhere at once. Locale is always `appConfig.dateLocale` — pages no longer pass `'en-US'` or
`'en-GB'` of their own.

## Crossing over

`src/lib/month.ts` owns the boundary between the two:

- `zonedDayKey(instant)` — the day key an instant falls on, in the configured zone
- `todayKey()` — `zonedDayKey(now)`
- `currentMonthKey()` — the first seven characters of `todayKey()`
- `shiftDayKey(day, n)` — day-key arithmetic, used by the meals window

Everything downstream inherits the fix: `buildSettlement` computes `through` from `todayKey()`, the meals page locks
past days against it, meal prompts pick their date from it, and `monthOptions()` starts from the local current month.

`localStamp` in `src/lib/user-sessions.ts` was already zone-aware and now shares `zonedDayKey`, so activity buckets
("when do members visit") and daily-visit counts agree with the rest of the app.

## Changing the zone

Set `APP_TIME_ZONE` to any IANA name and restart. Rows already written keep the day key they were written with —
this is a going-forward setting, not a migration. The one place that stores a derived local value is
`UserSession.startDay` / `startHour` / `startWeekday`; historical rows keep the bucket they were recorded in.
