# Bachelor Point

A mess management app for bachelor messes and shared flats: registration and approval,
supervisor-run groups, a monthly meal table, bazar and bill tracking, per-member dues,
payments, and comments.

Built with Next.js (pages router) + TypeScript, Tailwind CSS, Prisma, and Microsoft SQL Server.

---

## How it works

**Roles**

| Role | Can do |
| --- | --- |
| **Admin** | Approve or reject registrations, edit users, promote members to supervisor, create groups for any supervisor, add members directly, delete comments, edit site settings |
| **Supervisor** | Run up to **10 groups**, invite and remove members, record bills, record payments received, reply to and delete comments |
| **Member** | Enter their own meals (today and future only), log bazar they bought, comment, leave a group, edit their profile |

**The flow**

1. Someone registers at `/auth/register`. Their account starts **PENDING** — they cannot sign in yet.
   *(The very first account on an empty database becomes the admin automatically and is signed in straight away.)*
2. An admin approves them from `/admin` → Registrations.
3. A supervisor creates a group and invites the member by email.
4. The member accepts from `/invitations` and becomes part of the mess.
5. The member enters meals each day; anyone in the group logs the bazar they bought;
   the supervisor records rent, utilities, and other bills.
6. `/payments` shows what each person owes, and the supervisor records money received.

**One active group per member.** A member can only be active in one mess at a time — they
must leave one before joining another. Supervisors are exempt, because they belong to each
group they run so their own meals get counted.

---

## Money: how dues are calculated

Costs split into two kinds, because they behave differently:

**Bazar** (`/expenses`) — bought day to day and shared by meals eaten. Each day gets its
own rate:

```
day's meal rate  = that day's bazar total ÷ that day's total (weighted) meals
member's share   = Σ over days of (day rate × that member's weighted meals)
```

Meal weights are per group (breakfast/lunch/dinner, e.g. 0.5 / 1 / 1), so a breakfast does
not cost the same as a dinner.

**Bills** (`/bills`) — rent, electricity, water, waste, chef, Wi-Fi, other. Periodic, and
split once when recorded, either **equally** across the active roster or **assigned to
selected members** with explicit amounts. The resulting per-member amounts are written to
the `ExpenseShare` table rather than recomputed later, so somebody joining next week cannot
retroactively change what this month's rent said each person owed.

A member's balance for a month:

```
due = meal share + bills share − groceries they bought − cash they paid
```

A negative due means the mess owes *them*.

---

## Setup

### Requirements

- Node.js 18+
- Microsoft SQL Server (SQL Server Express is fine)

### 1. Install

```bash
npm install
```

### 2. Configure environment

Copy `.env.example` to `.env` and fill it in:

```env
DATABASE_URL="sqlserver://localhost\SQLEXPRESS;database=mess_db;integratedSecurity=true;trustServerCertificate=true"
AUTH_SECRET="a-long-random-string-at-least-32-characters"
```

Generate a secret with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

`AUTH_SECRET` signs the session cookie. **The app refuses to start in production without
it**, and changing it signs everyone out. In development a fallback is used with a warning.

### 3. Create the database

```bash
npx prisma migrate deploy   # or `npx prisma migrate dev` while developing
npx prisma generate
```

### 4. Seed sample data (optional)

```bash
npm run seed:db
```

This **wipes and repopulates** the database with 133 accounts, 10 groups, a month of meals,
bazar, bills, payments, and comments. Every seeded account's password is its own email address:

| Account | Password |
| --- | --- |
| `admin@gmail.com` | `admin@gmail.com` |
| `supervisor-1@gmail.com` … `supervisor-4@gmail.com` | same as the email |
| `member-1@gmail.com` … `member-120@gmail.com` | same as the email |
| `pending-1@gmail.com` | awaiting approval — cannot sign in |
| `rejected-1@gmail.com` | rejected — cannot sign in |

Seeding takes a few seconds because passwords are hashed with scrypt.

### 5. Run

```bash
npm run dev     # http://localhost:3000
```

Other scripts: `npm run build`, `npm start`, `npm run typecheck`, `npm run lint`,
`npm run db:reset` (drop, re-migrate, re-seed).

---

## Security notes

- **Passwords** are hashed with **scrypt** (salted per user, ~100 ms per verification).
  Any legacy unsalted SHA-256 rows still verify and are transparently upgraded on the
  owner's next successful login.
- **Sessions** are HMAC-SHA256-signed tokens in an `HttpOnly`, `SameSite=Lax` cookie
  (`Secure` in production), carrying the user id, a token version, and an expiry.
  They are verified in `middleware.ts` at the edge *and* re-checked against the database
  on every API request.
- **Token versioning** — changing a password, or an admin changing someone's role or status,
  bumps `User.tokenVersion` and immediately invalidates that user's existing sessions.
- **Rate limiting** on login (per account and per IP) and registration (per IP).
- **Login responses** are deliberately uniform: a missing account and a wrong password give
  the same message and take the same time, so the endpoint cannot be used to discover who
  has an account.
- Every write route re-checks role and group membership server-side; the client-side guards
  are only there to avoid showing pages that would fail anyway.

---

## Project layout

```
prisma/
  schema.prisma          data model
  migrations/            SQL migration history
  seed.js                sample data
src/
  components/            shared UI (Layout, form fields, toasts, mentions, ...)
  lib/
    auth.ts              cookie helpers
    session.ts           signed session tokens (edge-safe Web Crypto)
    password.ts          scrypt hashing            (server only)
    password.client.ts   password policy           (shared with the browser)
    auth-utils.ts        getSessionUser + role/group guards
    groups.ts            one-group rule, 10-group cap, membership activation
    bills.ts             non-bazar costs and share splitting
    meal-summary.ts      per-day meal rate and bazar shares
    group-report.ts      the single source of truth for "who owes what"
    validation.ts        email/name/phone validation, password strength
    rate-limit.ts        in-process rate limiter
    uploads.ts           profile image storage
  pages/
    auth/                login, register, registration-submitted
    api/                 backend routes
    dashboard.tsx        role-aware dashboard
    meals.tsx            monthly meal table
    expenses.tsx         bazar
    bills.tsx            rent / utilities / chef / wifi / other
    payments.tsx         balances and payments received
    members.tsx          roster, stay duration, leave / re-add
    comments.tsx         group discussion
    profile.tsx          details, photo, password
    admin/               approvals, users, groups, site settings
    groups/              group list and group detail
```

### Main API routes

| Route | Methods | Notes |
| --- | --- | --- |
| `/api/auth/register`, `/api/auth/login`, `/api/auth/logout`, `/api/auth/me` | POST / GET | rate-limited |
| `/api/profile` | PATCH | name, phone, photo, password (needs current password) |
| `/api/users`, `/api/users/[id]` | GET / PATCH | admin only |
| `/api/groups`, `/api/groups/[id]`, `/api/groups/order` | GET / POST / PATCH / PUT | 10-group cap enforced |
| `/api/groups/[id]/members` | GET / POST / PATCH / DELETE | roster, add, activate/deactivate, leave |
| `/api/groups/[id]/invitations`, `/api/invitations`, `/api/invitations/[id]` | GET / POST / PATCH / DELETE | one-group rule enforced on accept |
| `/api/groups/[id]/meals`, `/api/groups/[id]/meal-plan`, `/api/groups/[id]/meal-summary` | GET / PUT | past dates locked for members |
| `/api/groups/[id]/expenses`, `/api/expenses/[id]` | GET / POST / PATCH / DELETE | bazar only |
| `/api/groups/[id]/bills`, `/api/bills/[id]` | GET / POST / PATCH / DELETE | supervisor only |
| `/api/groups/[id]/payments`, `/api/payments/[id]` | GET / POST / DELETE | supervisor records receipts |
| `/api/groups/[id]/comments`, `/api/comments/[id]`, `/api/comments/[id]/replies` | GET / POST / DELETE | members cannot be edited by others |
| `/api/reports/dashboard` | GET | scoped to the signed-in user's role |
| `/api/uploads/[file]` | GET | serves profile images; requires a session |

---

## Deployment

- Set `DATABASE_URL` and `AUTH_SECRET` in the host's environment.
- Run `npx prisma migrate deploy` on release.
- **Profile images** are written to `uploads/` at the project root (override with
  `UPLOAD_DIR`) and served back through `/api/uploads/[file]`, which requires a session.
  They are deliberately *not* in `public/` — Next.js snapshots that directory at build
  time, so files written at runtime would 404 under `next start`. On a platform with an
  ephemeral filesystem (Vercel, plain containers), point `UPLOAD_DIR` at a mounted volume
  or replace `saveProfileImage`/`readProfileImage` in `src/lib/uploads.ts` with S3/Azure
  Blob calls — they are the only functions that touch storage.
- The rate limiter in `src/lib/rate-limit.ts` counts per process. Behind more than one
  instance, back it with Redis; the call sites do not change.

## Known gaps

- No automated test suite yet (`npm run typecheck` and `npm run build` are the current gates).
- No password-reset-by-email flow; an admin has to help, or the user changes it from `/profile`.
- Meal-weighted splitting is available for bazar only. Bills split equally or by assignment.
