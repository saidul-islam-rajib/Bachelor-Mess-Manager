# Profile photo size limit

The cap used to be a build-time constant in three unrelated places: `UPLOAD_MAX_IMAGE_BYTES` in the environment, a
literal `2 * 1024 * 1024` in `profile.tsx`, and the sentence "Up to 2 MB." typed into the page. Changing it meant a
redeploy and three edits that could disagree.

It is now one admin setting.

## The layers

| layer | value | who sets it |
| --- | --- | --- |
| floor / ceiling | `UPLOAD_MIN_CONFIGURABLE_IMAGE_BYTES` … `UPLOAD_MAX_CONFIGURABLE_IMAGE_BYTES` (64 KB … 10 MB) | deploy |
| live limit | `SiteSettings.maxProfileImageBytes` (2 MB default) | admin, at runtime |
| seed for a fresh database | `UPLOAD_MAX_IMAGE_BYTES` | deploy |

`UPLOAD_MAX_IMAGE_BYTES` only matters before the settings row exists, and as the fallback if the settings read fails.
Once the app has run, **Admin → Settings → Profile photos** is the authority.

`getUploadPolicy()` in `settings-service.ts` reads and caches it on the same 30-second TTL as the security and
meal-edit policies, clamps it to the deploy floor/ceiling, and falls back to config if the database is unreachable.
`saveProfileImage` checks against that, twice — once on the base64 length before allocating, once on the decoded
buffer.

## The request-size trap

Raising the admin limit alone would not have worked. A data-URL upload is base64, so a 2 MB image arrives as ~2.7 MB
of JSON, and two separate caps sat below that:

- `withAudit` rejected anything over `securityConfig.maxRequestBodyBytes` (1 MB) before the handler ran
- the profile route's `bodyParser.sizeLimit` was a literal `'4mb'`

The first now derives from the **ceiling**, not the live setting, because it can't consult the database:

```
uploadConfig.maxRequestBodyBytes = ceiling × 4/3 + slack
```

`withAudit` takes an optional `maxRequestBodyBytes`, and only ever raises the global cap for the route that passes it
— `Math.max` of the two, so a route can never quietly weaken the default. This is why the ceiling costs memory:
sizing it at 10 MB means the profile route will buffer ~13.4 MB per upload before rejecting anything.

The second — `bodyParser.sizeLimit` in each route's `export const config` — **cannot** derive from `uploadConfig` the
same way. Next.js extracts that object with a restricted static analyzer before the module is ever executed, and it
only understands literal strings/numbers; a `MemberExpression` like `uploadConfig.maxRequestBodyBytes` is silently
ignored and Next falls back to its own 1 MB default. (This was already happening — the field existed and was wired
up, but was never actually taking effect, so uploads above 1 MB were being rejected by Next before `withAudit` ever
ran.) The fix is a hardcoded literal (currently `'14mb'`, matching the same ceiling math above) that must be bumped
by hand if `UPLOAD_MAX_CONFIGURABLE_IMAGE_BYTES` is ever raised meaningfully. `uploadConfig.maxRequestBodyBytes`
stays the authoritative, fully dynamic check — the literal is just an outer safety valve sized generously enough
never to be the binding constraint under normal configuration.

## Units

Stored in bytes. The admin edits **KB** (an integer input, so 512 KB is expressible where a whole-MB input could not
express it), and every user-facing string renders through `formatBytes`, which picks B/KB/MB/GB and trims to one
decimal. The member sees "Up to 2 MB" on the profile page and "That image is larger than 2 MB" if they overshoot,
both fed from the same live number rather than a typed-in sentence.

The profile page fetches the limit from `GET /api/settings`, where `maxProfileImageBytes` is a public field — a
signed-out visitor learning the photo size limit is not worth an extra authenticated round trip.
