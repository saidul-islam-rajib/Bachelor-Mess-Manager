# Handing over supervision

A group has exactly one **main** supervisor. That is structural: `Group.supervisorId`
is a single required column, so handing over is a move, never an addition.

A group may also have a **second** supervisor, if an admin has raised the limit.
That one lives in a separate table and does not touch anything on this page —
see [supervisors.md](supervisors.md). Handover always moves the main slot, and
if the incoming person was the second supervisor their extra row is dropped so
nobody holds both.

## Where it lives

Members → Roster. Every active member other than the current supervisor gets a
**Make supervisor** button, visible to the group's supervisor and to admins. It
asks for confirmation, then posts to:

```
POST /api/groups/:id/supervisor   { "userId": "<member id>" }
```

The work is in `transferSupervision()` in `src/lib/groups.ts`.

## What happens

In one transaction:

1. `Group.supervisorId` moves to the new person.
2. The outgoing supervisor is given an active membership row if they somehow
   lacked one, so they stay in the group as an ordinary member.
3. The incoming supervisor's global role is raised from `MEMBER` to
   `SUPERVISOR`.
4. The outgoing supervisor's global role drops to `MEMBER` — but only if they
   now supervise no groups at all **and** are an active member of just one
   group.

Then every other member of the group gets a `SUPERVISOR_CHANGED` notification.

## Why the role changes are conditional

`Group.supervisorId` and `User.role` answer different questions.
`canManageGroup()` — which gates every supervisor action in the app — only
checks `supervisorId`, so the person named on the group can run it regardless of
their global role. `User.role` gates things that are not about one specific
group: creating new groups, the supervisor view of the dashboard, and the
one-group-at-a-time rule in `canJoinGroup()`.

`role-requests.ts` already assumes `role === MEMBER` implies supervising nothing
— it refuses to let a supervisor step down to member while they still run
groups. The conditions above keep that assumption true from the other direction.

The two guards on demotion matter:

- **Still supervises another group.** Someone running two messes who hands over
  one is still a supervisor. Demoting them would strip their remaining group's
  controls from the dashboard and stop them creating groups.
- **Active in more than one group.** Only supervisors and admins may belong to
  several groups at once. Demoting someone in that position would leave a
  `MEMBER` sitting in two groups, which the join rules forbid. Their group
  membership is left alone and their role is not touched.

Admins are never demoted or promoted by a handover.

## Sessions are not invalidated

`applyRole()` in the role-request flow bumps `tokenVersion`, which signs the
user out. A handover deliberately does not.

Nothing in a session token carries authority. The token holds only a user id and
a version; `loadActiveUser()` reads `role` from the database on every request,
and the short-lived session-user cache is cleared whenever any `User` row is
written. Both parties therefore see their new permissions on their very next
request. Bumping `tokenVersion` would log both of them out — including the
person who just pressed the button — and buy nothing.

## Rejected handovers

All return 409 except the first, which is 403:

| Case | Message |
| --- | --- |
| Caller is not the supervisor or an admin | Only this group's supervisor or an admin can hand over supervision. |
| Target already supervises the group | That member already supervises this group. |
| Target is not an active member | Only an active member of this group can take it over. |
| Target's account is not approved | That account has not been approved yet. |
| Target already supervises the maximum number of groups | *N* already supervises *max* groups, which is the limit. |
| Target does not exist | That user no longer exists. |
