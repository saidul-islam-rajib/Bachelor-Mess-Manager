# Caching

`src/lib/cache.ts` is the whole of it: a TTL map plus an in-flight map, usable
on the server and in the browser because it only needs `Map` and `Date`.

```ts
cached(key, ttlMs, load)   // serve from cache, else load once
invalidate(key)            // drop one entry
invalidatePrefix(prefix)   // drop a family of entries
```

Two properties matter more than the TTL:

- **One loader per key at a time.** A second caller arriving while the first
  request is still open gets the same promise instead of a second round trip.
  React 18 mounts effects twice in development, and several components ask for
  the same data on one page, so this alone removes a lot of duplicate traffic.
- **A zero TTL still dedupes.** Pass `0` when the data must always be fresh but
  concurrent callers should share one request.

## What is cached

| Key | TTL | Why |
| --- | --- | --- |
| `site-settings` (server) | `CACHE_SITE_SETTINGS_MS`, 5 min | `GET /api/settings` ran `siteSettings.upsert` on *every* page view — the footer asks for it on each render. An upsert is a write-path query; site settings change a few times a year. Invalidated on `PATCH /api/settings`. |
| `site-settings` (browser) | same | The footer is inside the layout, so a client-side navigation used to refetch it every time. |
| `/api/groups[?includeInactive=true]` (browser) | `CACHE_GROUP_LIST_MS`, 60 s | Every group-scoped page (`meals`, `bills`, `payments`, `expenses`, `comments`, `members`) loads the same list through `useGroupMonth`. Moving between them now costs nothing. |

## Freshness

Anything that changes a group — creating, reordering, closing, or moving a
member in or out — calls `reloadGroups({ fresh: true })`, which invalidates the
key before refetching. The plain `reloadGroups()` used on mount is happy with a
cached list.

Get this wrong and the symptom is a stale list after a write, so the rule is:
**a read may be cached, but every write invalidates before it reloads.**

## What is deliberately not cached

Notifications, invitations, the community feed and the meal prompts all poll on
a timer and exist to show change, so caching them would only add latency to the
thing they are for. Money — meals, bazar, bills, payments, settlements — is
never cached: it is what people argue about, and a stale number is worse than a
slow one.

## Scope

The cache lives in one process (and in one browser tab). Behind more than one
instance the entries are per-instance, which is fine at these TTLs: the worst
case is one node serving a five-minute-old company name. Reach for Redis only
if something user-visible and frequently written ever gets cached — nothing
does today.
