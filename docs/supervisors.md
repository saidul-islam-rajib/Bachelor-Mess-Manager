# Two supervisors for one mess

A mess has one supervisor. Sometimes it needs two — the person who does the
bazar is not always the person who chases the rent, and a mess whose only
supervisor travels for a week has nobody to record anything.

Default is unchanged: **one supervisor per mess**. Two is something an admin
switches on, for every mess or for one.

Page: Admin → Settings, and Members → Group settings. API:
`/api/groups/[id]/co-supervisors`. Logic: `src/lib/supervisors.ts`.

## The model

`Group.supervisorId` stays exactly as it was: a single, required column, the
mess's **main** supervisor. A second supervisor is a row in `GroupSupervisor`.

Keeping the main supervisor out of that table is the decision worth explaining.
It means every mess always has exactly one owner — the person handover moves,
the person who cannot be removed, the one `MAX_GROUPS_PER_SUPERVISOR` counts.
Had all supervisors gone into the table, "who owns this mess" would become a
query that can return zero rows, and every one of the 70-odd places that read
`supervisorId` would need to handle that. So the table holds only the extras.

The count that the limit applies to is the total, main included: a limit of 2
means the main supervisor plus one more.

## The limit

Two settings, the same shape as past-meal approval:

| Where | Column | Meaning |
| --- | --- | --- |
| Admin → Settings | `SiteSettings.maxSupervisorsPerGroup` | The default for every mess. Ships as `1`. |
| Admin → Settings → *Limits for individual messes* | `Group.maxSupervisors` | Null follows the site default; a number overrides it for that mess alone. |
| Members → Group settings | `Group.maxSupervisors` | The same override, for an admin already looking at one mess. |

The exception list sits directly under the default, because the decision is one
decision: *this is the rule, and these messes are different*. Splitting it across
two screens would have meant an admin who wants two supervisors in two of eleven
messes had to visit each mess in turn and remember which ones they had done.

It reads as a row per mess — name, who currently supervises it, "using 1 of 2" —
with a three-way control: **Site default (n)**, **1 supervisor**, **2
supervisors**. Changes save on selection, one mess at a time, so there is no
half-applied state and no Save button to forget. A **custom** tag marks the
exceptions, an **Only exceptions** filter shows just them, and the header counts
them, so "which messes did I change?" is answerable at a glance rather than by
scrolling. The list is searchable and paged for a site with many messes.

The override works in both directions: with the default at 2, setting a mess to
1 pins that mess to a single supervisor.

`GET /api/admin/supervisor-limits` feeds the list — admin only, returning each
mess's own limit, its effective limit, how many seats are used and who holds
them. Writes reuse `PATCH /api/groups/[id]`, so the cap validation lives in one
place regardless of which screen made the change.

The admin **Groups** tab also shows the state without opening anything: a `+1`
chip beside a supervisor's name when a mess has a second one, and `· limit 2`
when that mess carries its own limit.

`getSupervisorPolicy(groupId)` in `src/lib/settings-service.ts` resolves the two,
cached for 30 seconds like its neighbours. The ceiling is `2`, enforced in one
place — `SUPERVISORS_PER_GROUP_MAX` — so raising it later is a constant, not a
migration.

**Lowering the limit is refused while a mess is over it**, rather than silently
stranding somebody with controls the settings say they should not have. The
error names the messes and their counts, so an admin knows what to fix. The
per-mess control refuses the same way.

## Who can do what

| Action | Who |
| --- | --- |
| Change the site-wide limit | admin |
| Change one mess's limit | admin |
| Add or remove the second supervisor | that mess's supervisor, or an admin |
| Hand over the main slot | that mess's supervisor, or an admin |

Deliberately, the supervisor of a mess can appoint their own second — they know
who actually helps them run it, and an admin round-trip for that is friction
with no safety gained. The *limit* stays admin-only, so a supervisor cannot
grant themselves the ability to add one.

## What the second supervisor can do

Everything the first can, inside that mess: record bazar, bills and payments,
mark who has paid a bill, approve past-meal changes, invite and remove members,
manage cost types, close the month. That falls out of `canManageGroup()`, which
now matches on either the column or the table, so every route that already used
it gained the behaviour without being touched.

What they cannot do is anything that belongs to the mess's *identity* — they are
not `Group.supervisorId`, so they are not the handover target, they do not count
towards their own `MAX_GROUPS_PER_SUPERVISOR`, and they can be removed without
the "you cannot remove the supervisor" guard firing.

Twelve routes compared `group.supervisorId === user.id` by hand instead of
calling `canManageGroup()`. Those were the real work of this change: each was a
place where a second supervisor would have been silently denied — deleting a
comment, editing group settings, removing a payment. They now all go through the
one helper.

## Roles

Adding a second supervisor promotes a `MEMBER` to the `SUPERVISOR` role, the
same as handover does, because the role is what the navigation and permission
map key off. Removing them demotes back to `MEMBER`, but only if they supervise
nothing else — neither as a main supervisor nor as a second one anywhere.

A member who leaves or is removed from the mess loses the second-supervisor row
in the same request. Otherwise somebody outside the mess would keep its
controls, which `canManageGroup` would happily honour.

## Verified

`node scripts/e2e-test.js` and the rest of `npm test` are unchanged at 209/216
(the 7 failures are pre-existing date-rollover flakes in the meal suites).

A dedicated run covers 29 invariants: the default of 1 refusing a second, the
per-mess override raising it without moving any other mess, the second
supervisor being added and promoted, a third being refused, that supervisor
actually recording a bill and a collection through the API, being refused the
admin-only limit change, an ordinary member being refused entirely, both the
site-wide and per-mess limits refusing to drop below what is in use, removal
demoting the role back, and the main supervisor being unremovable through this
route.

A second run covers the exception list itself, 21 invariants over a real
eleven-mess site: every mess starting at the default, two of them raised to 2
while **the other nine stay at 1**, the site default staying at 1 throughout,
the exception count and the custom flags, the raised mess accepting a second
supervisor while a default one refuses, search narrowing the list, lowering
refused while the seat is occupied and allowed once freed, and raising the site
default covering every mess without needing any exception at all.
