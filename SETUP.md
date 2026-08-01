# Setup

How to run Bachelor Point locally, how it runs on the live site, and how the installable Android/iOS app works.

- Live: **https://bachelor-point.team-sober.com/**
- Stack: Next.js 14 (pages router) · TypeScript · Tailwind · Prisma · SQL Server
- Hosting: EC2

---

## 1. Local development

### Prerequisites

| Tool | Version | Notes |
| --- | --- | --- |
| Node.js | 20+ | `node -v` |
| SQL Server | 2019+ / Express | Local instance is fine |
| npm | 10+ | Ships with Node |

### First run

```bash
npm install                   # postinstall runs `prisma generate` for you
cp .env.example .env          # then edit the values below
npm run prisma:deploy         # create every table
npm run db:sync-roles         # roles, permissions, role-permission map
npm run admin:init            # create the administrator from your env vars
npm run dev                   # http://localhost:3000
```

`npm run setup` chains the three database steps.

### The `.env` values that matter

```env
DATABASE_URL="sqlserver://localhost\SQLEXPRESS;database=bachelor_point;integratedSecurity=true;trustServerCertificate=true"
AUTH_SECRET="a-random-string-of-at-least-32-characters"
ADMIN_EMAIL="admin@team-sober.com"
ADMIN_PASSWORD="something-long"
APP_URL="http://localhost:3000"
```

`APP_URL` is what notification emails link back to. Set it to the live domain in production or the buttons in
emails will point at localhost.

### Optional local flags

```env
EMAIL_REQUIRE_MX=false    # allow @example.com addresses; required to run the test suite
MAIL_HOST=               # leave unset locally; emails are captured in memory instead of sent
```

### Everyday commands

```bash
npm run dev            # dev server
npm run build          # production build
npm start              # serve the production build
npm run verify         # typecheck + lint + build
npm test               # every test suite, one summary
npm run backup:db      # take a database backup, rotate old ones
```

### One trap worth knowing

`next dev` and `next build` share the `.next` directory and write **incompatible** files into it. If you run a build
and then start dev (or leave two dev servers running), pages start returning 404 with
`missing required error components, refreshing...`.

Fix:

```bash
# make sure nothing else is running first
npx kill-port 3000            # or Stop-Process on any stray node.exe
rm -rf .next
npm run dev
```

If the dev server prints `⚠ Port 3000 is in use, trying 3001 instead`, you have two servers fighting over `.next`.
Kill both and start one.

---

## 2. Running the tests

The suite drives the real HTTP API, so the app must be running.

```bash
# terminal 1
EMAIL_REQUIRE_MX=false npm run dev

# terminal 2
npm test
```

```
================================================================
  TEST SUMMARY
================================================================
  SUITE           TOTAL  PASSED  FAILED   RESULT
  ------------------------------------------------------------
  allocation         39      39       0   PASS
  meal-rate          23      23       0   PASS
  e2e               138     138       0   PASS
  ------------------------------------------------------------
  TOTAL             200     200       0
================================================================
```

`EMAIL_REQUIRE_MX=false` is needed because the suite registers `@example.com` addresses, and that domain has no MX
record. Exit code is `0` only when every check passes **and** every suite ran — a skipped suite exits `1`.

Full detail in [docs/TESTING.md](docs/TESTING.md).

---

## 3. Live site (EC2)

### Deploying a change

```bash
git pull
npm ci                  # postinstall regenerates the Prisma client
npm run backup:db       # always back up before a migration
npm run prisma:deploy   # apply any new migrations
npm run build
pm2 restart bachelor-point    # or: docker compose up -d --build
```

Order matters: back up, migrate, build, restart.

### Production environment

```env
NODE_ENV=production
APP_URL="https://bachelor-point.team-sober.com"
DATABASE_URL="sqlserver://<host>;database=bachelor_point;user=<user>;password=<pw>;encrypt=true"
AUTH_SECRET="<32+ random characters, different from local>"
SESSION_COOKIE_SECURE=true
```

### HTTPS is mandatory

Service workers, install prompts and push notifications **only work over HTTPS** (localhost is the sole exception).
Your domain already has a certificate, so nothing to do — but if you ever expose the app over plain HTTP, the app
still works and the installable-app features silently switch off.

### Backups

```bash
npm run backup:db     # manual
```

Schedule the daily job once (elevated PowerShell, from the project root):

```powershell
powershell -ExecutionPolicy Bypass -File scripts\schedule-backup.ps1
```

Keeps the newest 2 by default (`BACKUP_KEEP_COUNT`). Restore and verification steps are in
[docs/BACKUPS.md](docs/BACKUPS.md).

---

## 4. The Android and iOS app

Bachelor Point is an installable **Progressive Web App**. There is no separate mobile codebase — the same site
installs to the home screen and runs full screen with its own icon, no browser bar.

### Cost

Nothing. No app store account, no build tooling, no yearly fee. Updates go live the moment you deploy — there is no
store review.

### How a user installs it

**Android (Chrome, Edge, Samsung Internet)**
1. Open https://bachelor-point.team-sober.com/
2. A dark **"Install Bachelor Point"** bar appears at the top — tap **Install**.
3. If it was dismissed, use the browser menu → **Install app** / **Add to Home screen**.

**iPhone and iPad (Safari — this must be Safari, not Chrome)**
1. Open https://bachelor-point.team-sober.com/ in **Safari**.
2. Tap the **Share** button at the bottom.
3. Scroll down and tap **Add to Home Screen**, then **Add**.

The app shows iOS users these exact steps: the banner's **How** button expands them, because iOS gives no
programmatic install prompt.

**Desktop (Chrome/Edge)** — an install icon appears in the address bar.

### What users get

- Full-screen app with the Bachelor Point icon, no browser chrome
- Long-press shortcuts straight to **Meals**, **Bazar** and **Payments**
- A proper offline screen instead of the browser's dinosaur
- An in-app **"A new version is ready — Reload now"** banner after a deploy

### What is deliberately *not* cached

Money is never served stale. The service worker **never caches `/api/` responses**, so meals, balances and dues are
always fetched live. Only the app shell, icons and uploaded images are cached. Offline, you get the offline screen
rather than yesterday's numbers — the wrong figure is worse than no figure in a mess.

Logging out clears every cache, so the next person to use the phone cannot see the previous user's screens.

### The logo and icons

`public/logo.svg` is the **single source of truth** for the brand mark. Everything else is generated from it:

```bash
npm run icons:generate
```

That writes the app icons (regular, Android maskable with safe-zone padding, monochrome, and the iOS
`apple-touch-icon.png`), plus `logo.png` as a raster fallback and `og-image.png` for link previews.

The mark is also inlined in `src/components/Logo.tsx` so the nav and footer render it without a network request.
That means two copies of the path data, so the test suite asserts they match — if you edit `logo.svg` without
syncing the component (or vice versa), `npm test` fails with
*"Logo.tsx and logo.svg have drifted"*.

**To change the logo:** edit `public/logo.svg`, copy the two path strings into `LOGO_RING_PATH` and
`LOGO_PORTION_PATH` in `Logo.tsx`, then run `npm run icons:generate`.

### Files involved

| File | Purpose |
| --- | --- |
| `public/manifest.json` | App name, icons, colours, shortcuts |
| `public/sw.js` | Service worker: caching rules, offline, push handlers |
| `public/offline.html` | Shown when a page cannot be reached |
| `src/components/PwaProvider.tsx` | Registers the worker, detects platform, handles updates |
| `src/components/InstallAppBanner.tsx` | Install bar, with iOS instructions |
| `src/components/UpdateBanner.tsx` | "New version ready" bar |
| `scripts/generate-icons.js` | Builds icons from the logo |

### Verifying it works

30 checks in the test suite cover this — manifest validity, every icon being served as a real PNG, the service worker
being uncacheable, the API-never-cached rule, and the iOS meta tags. They run as part of `npm test`.

To check by hand in Chrome: **DevTools → Application → Manifest** (no errors, icons listed) and
**Application → Service Workers** (activated and running).

### Honest limits

- **Not in the Play Store or App Store.** Users install from the link. For a mess where a supervisor invites people
  anyway, that is usually fine.
- **iOS push notifications** only work after the app is added to the home screen, iOS 16.4+. The service worker
  already handles `push` events; the server side (VAPID keys and subscriptions) is not built yet — in-app
  notifications and email still work as before.
- **iOS requires Safari** to install. Chrome on iOS cannot add to the home screen.

### If you later want real store listings

Wrap this same site with [Capacitor](https://capacitorjs.com/) pointing at the live URL. One thing to know now: the
session cookie is `httpOnly; SameSite=Lax`, so the wrapper **must** load `https://bachelor-point.team-sober.com`
directly rather than bundling files locally — otherwise the cookie becomes cross-site and login breaks silently.
Budget $25 once for Google Play and $99/year for Apple, plus a Mac or macOS CI for iOS builds.

---

## 5. Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| `missing required error components` | `next dev` and `next build` shared `.next`, or two dev servers | Kill all node, `rm -rf .next`, start one server |
| Pages 404 that clearly exist | Same as above | Same as above |
| `Property 'x' does not exist on type PrismaClient` | Prisma client not regenerated after a schema change | `npx prisma generate`, then restart the TS server in your editor |
| Install banner never appears | Not HTTPS, already installed, or previously dismissed | Check the URL scheme; clear `bp-install-dismissed` from localStorage |
| iOS shows no install option | Not using Safari | Open in Safari |
| Old version keeps loading after deploy | Service worker still serving the previous shell | The update banner appears within a minute; or DevTools → Application → Service Workers → Unregister |
| Tests fail on email domain | `EMAIL_REQUIRE_MX` is on | Start dev with `EMAIL_REQUIRE_MX=false` |

---

## Related docs

| Doc | Covers |
| --- | --- |
| [docs/TESTING.md](docs/TESTING.md) | The test suites and what they assert |
| [docs/BACKUPS.md](docs/BACKUPS.md) | Backups, rotation, restore, verification |
| [docs/settlement.md](docs/settlement.md) | How the money is calculated |
| [docs/ACCOUNTS.md](docs/ACCOUNTS.md) | Admin, supervisor and member accounts |
| `/guide` | The in-app explainer for end users (public) |
