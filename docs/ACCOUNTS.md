# Accounts & Access Guide

How to create the administrator, and how each role signs in.

Sign-in page for everyone: **`/auth/login`**

---

## 1. Before any of this works: the database

Every command on this page reaches PostgreSQL through Prisma. Prisma validates `DATABASE_URL`
against the provider declared in `prisma/schema.prisma` **before** it sends a query, so a URL for
the wrong engine fails on the very first call:

```
error: Error validating datasource `db`: the URL must start with the protocol
`postgresql://` or `postgres://`.
```

That means `.env` still points somewhere else — most often a leftover
`sqlserver://localhost\SQLEXPRESS;...` from before the move to PostgreSQL (see
[postgres-migration.md](postgres-migration.md)). It is never a problem with the command or its
flags: `admin:init`, `user:password`, `db:sync-roles` and `prisma:deploy` all fail identically.

### Get a database running

```bash
docker compose up -d db
```

That starts `postgres:16-alpine` on port 5432 with the credentials from `docker-compose.yml`. A
local PostgreSQL 16 install does just as well — only the URL changes.

### Point `.env` at it

```env
DATABASE_URL="postgresql://bpadmin:Local_Dev_Password_123@localhost:5432/bachelor_point?schema=public"
```

### Then run these, in this order

```bash
npm run prisma:deploy    # create every table
npm run db:sync-roles    # create the ADMIN, SUPERVISOR and MEMBER role rows
npm run admin:init       # create the administrator
```

`npm run setup` chains all three.

The order matters. `admin:init` checks for the `ADMIN` role row first and stops without it:

```
The ADMIN role is missing. Run "npm run db:sync-roles" first.
```

---

## 2. Administrator

The administrator is **never** created by the seed. You create it yourself, from environment
variables or the CLI. Every command below is idempotent — running it twice never produces a
duplicate.

### Create your own admin and take over from the bootstrap one

```bash
npm run admin:init -- --replace --email "your.email@gmail.com" --password "YourStrongPassword2026" --name "Saidul Islam Rajib"
```

`--replace` creates (or promotes) your account, then demotes every *other* administrator to a
deactivated member and revokes their sessions.

### Update `.env` — this part is not optional

```env
ADMIN_EMAIL="your.email@gmail.com"
ADMIN_PASSWORD="YourStrongPassword2026"
ADMIN_NAME="Saidul Islam Rajib"
```

`--replace` **demotes** the previous administrator; it does not delete the row. On the first
request it handles, the startup bootstrap looks up the `ADMIN_EMAIL` account by email and, finding
it in any state other than approved-administrator, promotes it straight back — it does that even
when another administrator already exists. Leave `ADMIN_EMAIL` pointing at the old address and the
account you just demoted is an approved admin again within one page load.

To switch the bootstrap off once your own admin is in place:

```env
ADMIN_BOOTSTRAP_ENABLED="false"
```

It defaults to on, and it is what makes a fresh deployment usable without shell access.

### Verify

```bash
npm run admin:init -- --list
```

You should see only your account.

### All administrator commands

| Command | What it does |
| --- | --- |
| `npm run admin:init` | Create or promote the admin using `.env` |
| `npm run admin:init -- --list` | List every admin: email, name, status, last login |
| `npm run admin:init -- --email X --password Y` | Create, or promote an existing account |
| `npm run admin:init -- --reset-password` | Rotate the password; revokes all that user's sessions |
| `npm run admin:init -- --replace` | Make this the **only** admin — demotes and deactivates the rest |
| `npm run admin:init -- --remove --email old@x.com` | Remove one admin; refuses if it is the last one |
| `npm run admin:init -- --help` | Usage |

Optional flags: `--name`, `--phone`.

Every value falls back to `.env` when its flag is absent, so bare `npm run admin:init` uses
`ADMIN_EMAIL` and `ADMIN_PASSWORD`. **`--remove` falls back too** — `npm run admin:init -- --remove`
with no `--email` targets whatever `ADMIN_EMAIL` names, which is normally your own account. Always
pass `--email` with `--remove`.

### Deleting the old admin outright

`--replace` demotes. To delete the row instead:

```bash
npm run admin:init -- --email "your.email@gmail.com" --password "YourStrongPassword2026"
npm run admin:init -- --remove --email "old.admin@example.com"
```

`--remove` deletes the account when it has no linked records. If it does have linked data, the
script demotes and deactivates it instead of orphaning records, and tells you so.

### Safety rails

- It refuses to remove the last remaining administrator.
- `--replace` only demotes others **after** your account is confirmed in place, so you cannot
  lock yourself out.
- `--reset-password` and `--replace` bump `tokenVersion`, which invalidates existing session
  cookies immediately. Any browser signed in as the old admin is logged out on its next request.

### What the admin can do

Everything, at `/admin`:

| Tab | Purpose |
| --- | --- |
| Registrations | Approve or reject pending sign-ups |
| Users | Search and filter by role, status, supervisor, group; edit details; change roles |
| Groups | Filter by supervisor and status; create groups for any supervisor; add/remove members |
| Security | Login attempt limits, lockout windows, unlock accounts, recent failed sign-ins |
| Settings | Company name, tagline, contact details, social links, newsletter |

---

## 3. Supervisor

### How a supervisor account comes to exist

Registration always creates a **member**. A supervisor is made one of two ways:

**a) An admin promotes an existing member**

1. Sign in as admin → `/admin` → **Users**
2. Find the person (search by name, email, or phone)
3. **Edit** → set **Role** to `Supervisor` → **Save changes**

The promotion takes effect immediately and signs that user out of their existing sessions, so
they need to sign in again to pick up the new role.

**b) Sample data (development only)**

`npm run seed:db` creates 4 supervisors.

### How a supervisor logs in

1. Go to `/auth/login`
2. Enter their email and password
3. They land on `/dashboard`, showing their groups, spending, and outstanding dues

### What a supervisor can do

- Run up to **10 groups** (`/members` → Your groups → Create a group)
- Invite members by email, remove members (`/members`)
- Record rent, electricity, water, waste, chef, wifi and other bills (`/bills`)
- Record payments received from members (`/payments`)
- Log bazar, enter their own meals, and delete any comment in their groups

A supervisor is automatically a member of every group they run, so their own meals count.

---

## 4. Member

### Registering

1. Go to `/auth/register`
2. Fill in name, email, phone (optional), password (minimum 8 characters)
3. Submit — the account is created with status **PENDING**

> A pending member **cannot sign in yet**. Attempting to do so returns
> "Your account is awaiting admin approval."

### Getting approved

An admin signs in → `/admin` → **Registrations** → **Approve**.

### Logging in

1. Go to `/auth/login`
2. Enter the email and password from registration
3. They land on `/dashboard`

At this point they are approved but **not yet in a group**, so the dashboard says as much.

### Joining a group

1. A supervisor invites them by email
2. The member opens `/invitations` (or the bell icon in the header) and clicks **Accept**

**One group at a time.** A member can only be active in one mess. To move, they leave the
current group first (`/members` → **Leave this group**), then accept the new invitation.

### What a member can do

- Enter their own meals for **today and future dates only** — past dates are locked (`/meals`)
- Set a repeating weekly meal plan
- Log bazar they bought, and edit their own entries (`/expenses`)
- See bills, their share, and what they owe (`/bills`, `/payments`)
- Post comments and replies in **Mess comments** on `/members` (a collapsible section; deep link `/members#mess-comments`)
- Edit their profile, photo and password (`/profile`)
- Leave their group

### Fixing an account from the CLI

`admin:init` only manages administrators. For anyone else — and for an admin whose password you
want to change without touching their role — use `user:password`:

| Command | What it does |
| --- | --- |
| `npm run user:password -- --email x@y.com --password "a-long-password"` | Set the password |
| `npm run user:password -- --email x@y.com` | Set the password **to the email address itself** |
| `npm run user:password -- --email x@y.com --approve` | Set the password and approve the account |
| `npm run user:password -- --email x@y.com --create --name "Full Name"` | Create the account, already approved |
| `npm run user:password -- --help` | Usage |

`--create` takes `--role MEMBER` (the default) or `--role SUPERVISOR`, plus `--phone`. It refuses
`--role ADMIN` — administrators go through `admin:init`.

Every reset bumps `tokenVersion` and deletes that user's pending password links, so all their
sessions and any reset email already in their inbox stop working immediately. Resetting the
password of a `PENDING` or `REJECTED` account does not let them in; the script says so and tells
you to add `--approve`.

---

## 5. Sample accounts (development only)

`npm run seed:db` creates these. **Every seeded account's password is its own email address.**

| Account | Password | Notes |
| --- | --- | --- |
| `supervisor-1@bachelorpoint.local` … `supervisor-4@bachelorpoint.local` | same as the email | Each runs 2-3 groups |
| `member-1@bachelorpoint.local` … `member-120@bachelorpoint.local` | same as the email | Most are already in a group |
| `pending-1@bachelorpoint.local` … `pending-5@bachelorpoint.local` | same as the email | Awaiting approval — cannot sign in |
| `rejected-1@bachelorpoint.local` … `rejected-3@bachelorpoint.local` | same as the email | Rejected — cannot sign in |

Example: email `member-1@bachelorpoint.local`, password `member-1@bachelorpoint.local`.

The seed **never creates an administrator** and never touches existing admin accounts, so
re-seeding a development database will not remove yours.

The domain and all counts are configurable: `SEED_EMAIL_DOMAIN`, `SEED_SUPERVISORS`,
`SEED_MEMBERS`, `SEED_GROUPS`, `SEED_MEMBERS_PER_GROUP`, `SEED_PENDING_USERS`,
`SEED_REJECTED_USERS`.

**Production is protected.** The seed refuses to run when `NODE_ENV=production` unless
`SEED_ENABLED=true` is set explicitly.

---

## 6. Troubleshooting sign-in

| Symptom | Cause | Fix |
| --- | --- | --- |
| "Your account is awaiting admin approval." | Status is PENDING | Admin approves at `/admin` → Registrations |
| "Your account is not active. Please contact an admin." | Status is REJECTED | Admin sets status back to Approved at `/admin` → Users |
| "Too many failed attempts. This account is locked for N minutes." | 5 failed attempts (default) | Wait it out, or admin unlocks at `/admin` → **Security** → Unlock |
| "Invalid email or password." | Wrong credentials, or the account does not exist | Deliberately identical for both cases so the login page cannot be used to discover who has an account |
| Signed out unexpectedly | Password changed, or an admin changed your role or status | Sign in again |
| Admin forgot their password | — | `npm run admin:init -- --reset-password --email you@x.com --password "NewPassword2026"` |
| Member forgot their password | — | They use **Forgot password** on `/auth/login`, which emails a reset link. See [password-reset.md](password-reset.md) |
| Member forgot their password and SMTP is not configured | No mail can go out | Reset it from the CLI: `npm run user:password -- --email them@x.com --password "NewPassword2026"` |
| Any of these commands fails with `the URL must start with the protocol postgresql://` | `DATABASE_URL` is not a PostgreSQL URL | See [section 1](#1-before-any-of-this-works-the-database) |
| `The ADMIN role is missing.` | The role rows were never created | `npm run db:sync-roles` |

### Login attempt limits

Default is **5 failed attempts**, then the account is locked for **15 minutes**. An admin can
change both, plus the per-IP limits, live at `/admin` → **Security**. Those values are stored in
the database, so they apply immediately without a restart.

---

## 7. Mentioning someone in a comment

Type `@` in any comment box — in **Mess comments** on `/members`, on a bazar entry in
**Bazar** (`/expenses`), or in the **Community** room (`/community`). A dropdown of members
appears and filters as you keep typing.

- **↑ / ↓** move, **Enter** or **Tab** picks, **Esc** dismisses, or click a name
- **Ctrl/Cmd + Enter** posts
- The `@` must be at the start or after a space
- Only active members of that group can be mentioned individually
- `@everyone` notifies the whole group. In the community room it is admin-only and capped by
  `COMMUNITY_EVERYONE_CAP`; inside a mess any member may use it

Mentions are stored by **user ID**, not by name, so if that person later renames themselves
every past mention updates automatically.

> **Mentions do not send a notification yet.** The bell icon only carries group invitations.
> A mention highlights the name in the thread; the person finds out by reading it.

## 8. First-ever account on an empty database

If the database has **no users at all**, the first person to register at `/auth/register`
automatically becomes an approved administrator and is signed in immediately. This exists so a
fresh install is usable without the CLI. Once any user exists, registration always creates a
pending member.
