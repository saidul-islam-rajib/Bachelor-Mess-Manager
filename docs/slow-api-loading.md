# Slow API loading and the 500 storm

Symptom: pages sit on "Loading..." for a long time, then the browser console
shows every API call failing at once — `/api/groups`, `/api/notifications`,
`/api/invitations`, `/api/newsletter`, `/api/community/read`,
`/api/meal-prompts`, `/api/reports/dashboard` — all returning 500.

The fact that unrelated public routes (`/api/newsletter`) fail alongside
authenticated ones is the tell: the failure is not in any one handler. It is in
the shared wrapper every route goes through, `withAudit`, and in the database
connection pool underneath it.

## What was actually slow

### 1. One Prisma client per API route in production

`src/lib/prisma.ts` only cached the client on `globalThis` when
`NODE_ENV !== 'production'`. Next.js compiles each `pages/api` route into its
own server bundle, so in production every route that got hit created its **own**
`PrismaClient` with its **own** connection pool. Fifty-seven routes meant up to
fifty-seven pools competing for the database's connection budget.

The client is now cached on `globalThis` unconditionally.

### 2. Full bootstrap on every request

`withAudit` awaits `bootstrapApplication()` before running the handler.
`syncRolesAndPermissions()` issued one `upsert` per role and per permission —
3 roles + 39 permissions + 3 `rolePermission` lookups, all sequential, about 47
round trips, plus the settings upsert, two admin lookups and the announcement
scan. Roughly 55 sequential queries.

That is paid once when it succeeds, because the resolved promise is memoised.
But on failure the old code set `applicationBootstrap = undefined`, so **the
next request started the whole 55-query sequence again**. Once the database got
slow, every incoming request queued a fresh bootstrap attempt, each one holding
connections while it waited to time out. That is the feedback loop that turned
"slow" into "everything 500s".

Three changes:

- `syncRolesAndPermissions()` now reads the current roles, permissions and
  assignments in three parallel queries and only writes rows that actually
  differ. Steady state is 3 queries instead of ~47.
- A failed bootstrap sets a 30-second cooldown before it is retried, so a
  database blip no longer multiplies itself across every request.
- Read requests (`GET`/`HEAD`/`OPTIONS`) wait at most 1.5 s for bootstrap and
  then proceed; writes still wait for it in full.

### 3. Errors were thrown away

`withAudit` caught handler errors with a bare `catch {}` and returned a generic
500 — nothing was logged, which is why the 500s had no explanation anywhere.
It now logs method, URL and the error. `next.config.mjs` keeps `console.error`
and `console.warn` in production builds, so these reach the container logs.
The Prisma client also logs at `error` and `warn` level, which is how
`P2024 Timed out fetching a new connection from the connection pool` becomes
visible.

### 4. Redundant round trips on the Bazar page

`/expenses` fires two requests. Each one used to run this sequence:

| step | queries |
| --- | --- |
| `getSessionUser` | 1 |
| `group.findUnique` | 1 |
| `isGroupMember` (re-fetched the group, then the membership) | 2 |
| the actual data | 1 |
| members + supervisor | 2 |
| mention names | 1 |

Eight queries across six sequential stages, per request, twice per page load.

Now:

- `getSessionUser` caches the user row for 5 seconds
  (`CACHE_SESSION_USER_MS`), so the ~8 API calls a page load fires share one
  lookup instead of doing eight identical ones. Any write to `User` clears the
  cache through the Prisma extension, so role changes and `tokenVersion` bumps
  still take effect.
- `isGroupMember` resolves membership-or-supervisor in a single query.
- Both group routes fetch the group, its supervisor and the caller's membership
  in one `findUnique`, then run the expense and membership queries in parallel.

Four queries across three stages, and the session lookup is usually served
from cache.

## Connection pool sizing

Prisma sizes the pool at `CPU cores × 2 + 1`. On a 1-vCPU container that is 3.
A single page load fires about eight API requests, so three connections is not
enough and requests queue until they hit the 10-second pool timeout and fail.

Two optional environment variables now feed the connection string
(`DATABASE_CONNECTION_LIMIT`, `DATABASE_POOL_TIMEOUT_SECONDS`). They are unset
by default, so nothing changes unless you set them. Set them on the deployed
instance if the logs show `P2024`:

```
DATABASE_CONNECTION_LIMIT=15
DATABASE_POOL_TIMEOUT_SECONDS=15
```

Keep the limit below the database's own maximum connection count.

## Checking it

`/api/health` reports bootstrap state without touching the database. A
`"degraded"` status with an `error` string means bootstrap is failing, and the
error is the underlying database problem.

## Unrelated console noise

The blocked `static.cloudflareinsights.com/beacon.min.js` message is
Cloudflare's Web Analytics beacon, injected by the proxy. It was blocked by the
CSP and had no effect on loading. `script-src` and `connect-src` now allow it.
