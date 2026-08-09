# Per-member permissions

Access used to be role-shaped only: `hasPermission(user, code)` looked the code up in `ROLE_DEFINITIONS`, so every
MEMBER in the system had exactly the same rights. Admins now need to bend that per person — one member read-only, one
member allowed to record bazar but not edit it, one supervisor blocked from recording payments.

## The model

`UserPermission` holds **exceptions only**, never a full copy of a member's rights:

| column | meaning |
| --- | --- |
| `userId` | who the exception belongs to |
| `permissionCode` | FK to `Permission.code`, so a permission removed from the catalogue takes its overrides with it |
| `effect` | `ALLOW` adds a permission the role does not carry, `DENY` removes one it does |
| `grantedById` | the admin who set it, nulled out if that admin is deleted |

Resolution lives in `src/lib/user-permissions.ts`:

```
effective = (role grants ∪ every ALLOW) − every DENY
```

DENY is applied last, so it always wins.

### Why exceptions and not a full set

`replaceOverrides` drops any override that agrees with the role at save time — an ALLOW for something the role already
grants, or a DENY for something it never had. That keeps the stored set to real exceptions, which means **changing a
member's role moves them with it**. Promote a MEMBER with "blocked from recording bazar" to SUPERVISOR and they get the
whole supervisor role minus that one block, rather than a frozen snapshot of their old member rights.

## How it reaches a request

`SESSION_USER_SELECT` in `src/lib/auth-utils.ts` now pulls `permissionOverrides` alongside the user row, and
`loadActiveUser` resolves them into `SessionUser.permissions`. That whole row is memoised under
`sessionUserKey(userId)`, so a permission check costs no extra query.

`hasPermission` reads `user.permissions` when present and falls back to the plain role grants when it is absent — the
signature still accepts a bare `{ role }`, so existing callers that never had a resolved set keep working.

Cache invalidation has two layers: the Prisma extension invalidates the whole session-user prefix on any `User` **or**
`UserPermission` write, and `replaceOverrides` invalidates the specific key after its transaction, because the
`createMany` inside the transaction is not covered by the extension's write hooks.

Note that changing permissions does **not** bump `tokenVersion`. The member is not signed out; their next request
picks up the new set once the cache entry expires or is invalidated. Role and status changes still bump it, as before.

## Enforcement

An override is only real if the server checks it. These endpoints now gate on a permission rather than role alone:

| endpoint | read | write |
| --- | --- | --- |
| `groups/[id]/meals` | `meal.view` | `meal.record_own` for yourself, `meal.record_any` for anyone else |
| `groups/[id]/meal-summary` | `meal.view` | — |
| `groups/[id]/meal-plan` | — | `meal.plan_manage` |
| `groups/[id]/expenses` | `expense.view` | `expense.create` |
| `expenses/[id]` | — | `expense.update_own` / `expense.update_any` |
| `groups/[id]/bills` | `bill.view` | `bill.manage` |
| `groups/[id]/payments` | `payment.view` | `payment.record` |
| `groups/[id]/comments` | `comment.view` | `comment.create` |
| `groups/[id]/invitations` | — | `membership.invite` |

These sit **after** the existing membership and supervisor checks, so a permission can only ever narrow access, never
widen it past group boundaries. Granting a member `bill.manage` does not let them touch a mess they do not belong to.

The client mirrors this for affordances only: `useCurrentUser().can(code)` hides nav links the member cannot view, the
meal-plan card, the past-meal unlock, and the meal inputs. The server is the gate; the UI just avoids showing buttons
that would 403.

## Admin UI

Admin → Users → **Permissions** on any row other than your own. The modal groups the catalogue by category and gives
each permission three states: **Role default** (labelled with what the role currently does), **Allow**, **Block**.

Two presets:

- **Read only** — blocks every permission the role grants whose code is not a `.view*`. This is the "member who can
  only look" case. Note it also blocks `membership.leave`; flip that one back to Allow if they should still be able to
  leave the mess.
- **Follow the role** — clears every exception.

A **Custom** badge appears next to the role in the users table when someone has exceptions, with the added/blocked
counts on hover.

You cannot edit your own permissions — same reasoning as the existing block on changing your own role or status.
