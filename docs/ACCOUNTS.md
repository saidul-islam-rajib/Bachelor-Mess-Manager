# Accounts & Access Guide

How to create the administrator, and how each role signs in.

Sign-in page for everyone: **`/auth/login`**

---

## 1. Administrator

The administrator is **never** created by the seed. You create it yourself, from environment
variables or the CLI. Every command below is idempotent — running it twice never produces a
duplicate.

### Create your own admin and remove the seeded one

```bash
npm run admin:init -- --replace --email "your.email@gmail.com" --password "YourStrongPassword2026" --name "Saidul Islam Rajib"
```

`--replace` creates (or promotes) your account, then demotes every *other* administrator to a
deactivated member and revokes their sessions.

### Update `.env`

The startup bootstrap only creates an administrator when **none exists**, so a stale
`ADMIN_EMAIL` will not resurrect an old admin behind your back. Still update it — otherwise
the variables no longer describe your real admin, and if you ever wipe the database the app
would recreate the *old* account instead of yours.

```env
ADMIN_EMAIL="your.email@gmail.com"
ADMIN_PASSWORD="YourStrongPassword2026"
ADMIN_NAME="Saidul Islam Rajib"
```

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

### Deleting the seeded admin outright

`--replace` demotes. To delete the row instead:

```bash
npm run admin:init -- --email "your.email@gmail.com" --password "YourStrongPassword2026"
npm run admin:init -- --remove --email "admin@mess.local"
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

## 2. Supervisor

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

- Run up to **10 groups** (`/groups` → Create a group)
- Invite members by email, remove members (`/members`)
- Record rent, electricity, water, waste, chef, wifi and other bills (`/bills`)
- Record payments received from members (`/payments`)
- Log bazar, enter their own meals, and delete any comment in their groups

A supervisor is automatically a member of every group they run, so their own meals count.

---

## 3. Member

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
- Post comments and replies, delete their own (`/comments`)
- Edit their profile, photo and password (`/profile`)
- Leave their group

---

## 4. Sample accounts (development only)

`npm run seed:db` creates these. **Every seeded account's password is its own email address.**

| Account | Password | Notes |
| --- | --- | --- |
| `supervisor-1@mess.local` … `supervisor-4@mess.local` | same as the email | Each runs 2-3 groups |
| `member-1@mess.local` … `member-120@mess.local` | same as the email | Most are already in a group |
| `pending-1@mess.local` … `pending-5@mess.local` | same as the email | Awaiting approval — cannot sign in |
| `rejected-1@mess.local` … `rejected-3@mess.local` | same as the email | Rejected — cannot sign in |

Example: email `member-1@mess.local`, password `member-1@mess.local`.

The seed **never creates an administrator** and never touches existing admin accounts, so
re-seeding a development database will not remove yours.

The domain and all counts are configurable: `SEED_EMAIL_DOMAIN`, `SEED_SUPERVISORS`,
`SEED_MEMBERS`, `SEED_GROUPS`, `SEED_MEMBERS_PER_GROUP`, `SEED_PENDING_USERS`,
`SEED_REJECTED_USERS`.

**Production is protected.** The seed refuses to run when `NODE_ENV=production` unless
`SEED_ENABLED=true` is set explicitly.

---

## 5. Troubleshooting sign-in

| Symptom | Cause | Fix |
| --- | --- | --- |
| "Your account is awaiting admin approval." | Status is PENDING | Admin approves at `/admin` → Registrations |
| "Your account is not active. Please contact an admin." | Status is REJECTED | Admin sets status back to Approved at `/admin` → Users |
| "Too many failed attempts. This account is locked for N minutes." | 5 failed attempts (default) | Wait it out, or admin unlocks at `/admin` → **Security** → Unlock |
| "Invalid email or password." | Wrong credentials, or the account does not exist | Deliberately identical for both cases so the login page cannot be used to discover who has an account |
| Signed out unexpectedly | Password changed, or an admin changed your role or status | Sign in again |
| Admin forgot their password | — | `npm run admin:init -- --reset-password --email you@x.com --password "NewPassword2026"` |
| Member forgot their password | No email reset flow exists yet | Admin cannot read passwords; recreate the account, or the member changes it from `/profile` while still signed in |

### Login attempt limits

Default is **5 failed attempts**, then the account is locked for **15 minutes**. An admin can
change both, plus the per-IP limits, live at `/admin` → **Security**. Those values are stored in
the database, so they apply immediately without a restart.

---

## 6. Mentioning someone in a comment

Type `@` in any comment box — on **Comments** (`/comments`) or on a bazar entry in
**Bazar** (`/expenses`). A dropdown of group members appears and filters as you keep typing.

- **↑ / ↓** move, **Enter** or **Tab** picks, **Esc** dismisses, or click a name
- **Ctrl/Cmd + Enter** posts
- The `@` must be at the start or after a space
- Only active members of that group can be mentioned; there is no `@everyone`

Mentions are stored by **user ID**, not by name, so if that person later renames themselves
every past mention updates automatically.

> **Mentions do not send a notification yet.** The bell icon only carries group invitations.
> A mention highlights the name in the thread; the person finds out by reading it.

## 7. First-ever account on an empty database

If the database has **no users at all**, the first person to register at `/auth/register`
automatically becomes an approved administrator and is signed in immediately. This exists so a
fresh install is usable without the CLI. Once any user exists, registration always creates a
pending member.
