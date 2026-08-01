# Bachelor Point

Mess management for bachelor messes and shared flats: registration and approval,
supervisor-run groups, a monthly meal table, bazar and bill tracking, per-member dues,
payments, and comments.

Next.js (pages router) · TypeScript · Tailwind CSS · Prisma · Microsoft SQL Server

**Author:** Saidul Islam Rajib &lt;saidul.is.rajib@gmail.com&gt; · Released under the [MIT License](LICENSE).

---

## Quick start

```bash
npm install
cp .env.example .env          # then edit DATABASE_URL, AUTH_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD
npx prisma migrate deploy     # create every table from scratch
npm run db:sync-roles         # roles, permissions, role-permission map
npm run admin:init            # create the administrator from your env vars
npm run seed:db               # OPTIONAL: sample data (never in production)
npm run dev
```

`npm run setup` chains the three database steps (`migrate deploy`, `db:sync-roles`, `admin:init`).

> **[docs/ACCOUNTS.md](docs/ACCOUNTS.md)** — administrator commands, and how supervisors and
> members sign in. Start there for day-to-day account management.

### How the app works

`/guide` is the in-app explainer for members and supervisors — public, no sign-in needed. These are the
engineering notes behind it:

| Doc | Covers |
| --- | --- |
| [settlement.md](docs/settlement.md) | How a month's money is worked out, and the balance bugs it fixes |
| [month-closing.md](docs/month-closing.md) | Freezing a month, carrying balances forward, mid-month departures |
| [meal-edit-approvals.md](docs/meal-edit-approvals.md) | Editing past meals: unlock windows, approvals, notifications |
| [expense-categories.md](docs/expense-categories.md) | Per-group cost types for the bills dropdown |
| [notifications.md](docs/notifications.md) | The notification model, bell, and email delivery |
| [group-deactivation.md](docs/group-deactivation.md) | Closing a mess: hiding it and locking writes |

### Operations

| Doc | Covers |
| --- | --- |
| [BACKUPS.md](docs/BACKUPS.md) | Daily backups, rotation, restore, and proving a restore works |
| [TESTING.md](docs/TESTING.md) | The end-to-end suite and what it asserts |

```bash
npm run backup:db     # take a backup now, rotate old ones
npm run restore:db    # restore the newest backup
npm test              # every suite, one summary (159 checks)
npm test --quiet      # summary table only
```

---

## Creating the administrator

**The administrator is never seeded.** Two ways to create it, both idempotent — running
either twice never produces a duplicate.

### 1. Automatic (on startup)

Set these in `.env`:

| Variable | Required | Description |
| --- | --- | --- |
| `ADMIN_EMAIL` | yes | Email the administrator signs in with |
| `ADMIN_PASSWORD` | yes | At least `PASSWORD_MIN_LENGTH` (8) characters |
| `ADMIN_NAME` | no | Display name, defaults to `System Administrator` |
| `ADMIN_PHONE` | no | Contact number |
| `ADMIN_BOOTSTRAP_ENABLED` | no | Set `false` to disable automatic creation |

On the first request the server handles, the app will:

- create the account if no administrator exists,
- promote an existing account with that email to administrator,
- do nothing if that administrator already exists.

The outcome is logged as `[bootstrap] ...`. If `ADMIN_EMAIL`/`ADMIN_PASSWORD` are absent
it logs that it skipped and carries on.

### 2. Manual (CLI)

```bash
npm run admin:init
npm run admin:init -- --email admin@yourdomain.com --password "a-long-password"
npm run admin:init -- --reset-password        # rotate the password, revokes all sessions
```

> Nothing writes `ADMIN_PASSWORD` to the database in plaintext — it is hashed with scrypt
> before storage. Rotate it by changing the variable and running with `--reset-password`.

---

## Sample data

`npm run seed:db` populates every table: users, groups, memberships, invitations, group
order, bazar with line items, bills with per-member shares, expense history, expense
comments, meals, meal plans, payments, comments with replies and @mentions, failed login
attempts, site settings, and subscribers.

**Every seeded account's password is its own email address:**

| Account | Password |
| --- | --- |
| `supervisor-1@bachelorpoint.local` … `supervisor-4@bachelorpoint.local` | same as the email |
| `member-1@bachelorpoint.local` … `member-120@bachelorpoint.local` | same as the email |
| `pending-1@bachelorpoint.local` | awaiting approval — cannot sign in |
| `rejected-1@bachelorpoint.local` | rejected — cannot sign in |

The domain and every count are configurable (`SEED_EMAIL_DOMAIN`, `SEED_MEMBERS`, …).

**Production is protected.** The seed refuses to run when `NODE_ENV=production` unless
`SEED_ENABLED=true` is set explicitly. It also never touches administrator accounts, so
re-seeding a development database will not remove your admin.

---

## How it works

**Roles and permissions** live in the database (`Role`, `Permission`, `RolePermission`) and
are synced from `src/lib/permissions.ts` by `npm run db:sync-roles`. 3 roles, 35 permissions.

| Role | Summary |
| --- | --- |
| **Admin** | Everything: approvals, users, roles, groups, security policy, settings |
| **Supervisor** | Up to 10 groups; invite/remove members, record bills and payments, moderate comments |
| **Member** | Own meals (today and future only), log bazar, comment, leave a group, edit profile |

**One active group per member.** A member belongs to one mess at a time and must leave
before joining another. Supervisors are exempt — they belong to each group they run so
their own meals count.

**Money.** Bazar is shared by meals eaten. A group picks one rate for the month (total bazar
÷ total meals) or a rate per day; day-by-day pricing falls back to the monthly rate for any
month where meals fall on days with no bazar, because otherwise those meals would cost
nothing and whoever ate on shopping days would pay for everybody. Cost types are per group —
supervisors add and retire their own. Bills are split once when recorded, either equally
across the active roster or assigned to selected members, and stored as `ExpenseShare` rows
so a later membership change cannot rewrite last month's numbers.

```
due = brought forward + meal share + bills share − groceries they bought − cash they paid
```

Every allocation is done in integer paisa with largest-remainder rounding, so member shares
always add back to what the mess actually spent. See [docs/settlement.md](docs/settlement.md).

---

## Admin dashboard

Five tabs at `/admin`:

- **Registrations** — approve or reject pending sign-ups, paginated.
- **Users** — search by name/email/phone; filter by role, status, supervisor, group, or
  "no group"; sort by name, join date, or last login; paginate; edit name, email, phone,
  role and status.
- **Groups** — search by name; filter by supervisor and status; create a group on behalf
  of any supervisor; add and remove members.
- **Security** — the live security policy (see below), currently locked accounts with a
  one-click unlock, and a log of recent failed sign-ins.
- **Settings** — company name, tagline, address, contact details, social links, newsletter.

---

## Security

**Login attempt limiting is admin-configurable, default 5.** After 5 failed attempts an
account is locked for 15 minutes. Both numbers, plus the per-IP equivalents and the
registration throttle, are edited live from **Admin → Security** and stored in the database
(`SiteSettings`); the environment variables are only the initial values.

| Control | Default | Where to change it |
| --- | --- | --- |
| Failed logins per account | 5 | Admin → Security |
| Account lockout window | 15 min | Admin → Security |
| Failed logins per IP | 40 | Admin → Security |
| IP lockout window | 15 min | Admin → Security |
| Registrations per IP | 5 / hour | Admin → Security |
| Require strong passwords | off | Admin → Security |

Also in place:

- **Passwords** hashed with scrypt, salted per user, ~100 ms per verification. Legacy
  unsalted SHA-256 rows still verify and are transparently upgraded on next login.
- **Sessions** are HMAC-SHA256-signed tokens in an `HttpOnly`, `SameSite=Lax` cookie
  (`Secure` in production), verified at the edge in `middleware.ts` and re-checked against
  the database on every API request.
- **Token versioning** — changing a password, or an admin changing a role or status,
  immediately invalidates that user's existing sessions.
- **Uniform login responses** — a missing account and a wrong password return the same
  message and take the same time, so the endpoint cannot enumerate registered users.
- **Every failed sign-in is recorded** (`LoginAttempt`) with email, IP, reason and time.
- **Security headers** on every response: CSP, `X-Frame-Options: DENY`, `nosniff`,
  `Referrer-Policy`, `Permissions-Policy`, HSTS in production, and `X-Powered-By` removed.
- **Request size caps** and in-process rate limiting on the auth routes.
- **Database indexes** on every hot query path so list endpoints stay fast under load.

> Behind more than one instance, back the in-process rate limiter in
> `src/lib/rate-limit.ts` with Redis — the call sites do not change. The account lockout
> is already database-backed and works across instances as-is.

---

## Project layout

```
prisma/
  schema.prisma          data model
  migrations/            SQL migration history
  reference-data.js      roles + permissions (shared by seed and sync script)
  seed.js                sample data, development only
scripts/
  init-admin.js          idempotent administrator creation
  sync-roles.js          roles and permissions sync
  strip-comments.js      TypeScript-aware comment remover
src/
  config/
    defaults.ts          every default value in one place
    index.ts             typed, env-driven configuration
  lib/
    i18n/                all user-facing strings (locales/en.ts)
    permissions.ts       permission codes, role map, hasPermission()
    settings-service.ts  database-backed security policy, cached
    login-attempts.ts    lockout evaluation and admin unlock
    api-client.ts        typed fetch wrapper with unified error handling
    query.ts             filter/sort/pagination parsing
    format.ts            currency, dates, durations, labels
    validation.ts        shared validation rules
    bootstrap/           administrator + reference data initialisation
  components/
    ui/                  reusable kit — Button, Input, Select, Checkbox, RadioGroup,
                         Modal, ConfirmDialog, DataTable, Pagination, FilterBar,
                         Card, StatCard, Badge, Alert, Loader, EmptyState, Avatar
  pages/                 routes and API handlers
```

### Conventions

- **No comments in source.** Names and structure carry the meaning. `npm run lint`
  and `node scripts/strip-comments.js` keep it that way.
- **No hardcoded values.** Everything configurable comes from `src/config`, the string
  catalogue, `src/lib/constants.ts`, or the database.
- **All user-facing text** lives in `src/lib/i18n/locales/en.ts`. Add a locale by adding a
  file next to it and registering it in `src/lib/i18n/index.ts`.
- **No `console.*` anywhere.** The application runtime is silent: API failures return a
  JSON 500 and nothing is written to stdout. Startup results are exposed on
  `GET /api/health` instead:

  ```json
  {
    "status": "ok",
    "bootstrap": {
      "completedAt": "2026-07-30T12:00:00.000Z",
      "roles": 3,
      "permissions": 35,
      "administrator": "created",
      "administratorMessage": "Administrator account created for admin@yourdomain.com.",
      "error": null
    }
  }
  ```

  `status` becomes `degraded` with a 500 if startup initialisation failed, which makes the
  endpoint usable as a container health probe. CLI scripts still report progress to the
  operator, but only through `scripts/reporter.js` — one module, `process.stdout` /
  `process.stderr`, no scattered logging.

---

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and serve |
| `npm run typecheck` | TypeScript, no emit |
| `npm run lint` | ESLint |
| `npm run verify` | typecheck + lint + build |
| `npm run prisma:deploy` | Apply migrations |
| `npm run db:reset` | Drop, re-migrate, re-seed |
| `npm run db:sync-roles` | Sync roles and permissions |
| `npm run admin:init` | Create or promote the administrator |
| `npm run seed:db` | Sample data (development only) |

---

## Deployment

1. Set `DATABASE_URL`, `AUTH_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`.
2. `npx prisma migrate deploy`
3. `npm run db:sync-roles`
4. `npm run build && npm start` — the administrator is created on the first request, or
   run `npm run admin:init` explicitly.
5. Do **not** run `npm run seed:db`.

Profile images are written to `uploads/` (override with `UPLOAD_DIR`) and served through
`/api/uploads/[file]`, which requires a session. They are deliberately not in `public/` —
Next.js snapshots that directory at build time. On an ephemeral filesystem, point
`UPLOAD_DIR` at a mounted volume or swap `saveProfileImage`/`readProfileImage` in
`src/lib/uploads.ts` for S3/Azure Blob calls.

## Known gaps

- No automated test suite in the repo yet; `npm run verify` is the current gate.
- No password-reset-by-email flow — an admin resets, or the user changes it from `/profile`.
- Meal-weighted splitting applies to bazar only; bills split equally or by assignment.
