# Closing a group

A group moves between `ACTIVE` and `INACTIVE` from two places:

- **Group page** (`/groups/[groupId]`) — the "Group status" card, shown only to whoever can manage the group: its own
  supervisor, or an admin.
- **Admin → Groups** — an Activate/Deactivate button on every row.

Both call `PATCH /api/groups/[id]` with `{ status }`, validated against `GROUP_STATUS_VALUES`. The endpoint is scoped
to `group.supervisorId === sessionUser.id || requireAdmin(...)`, so a supervisor can only close their own groups.

`INACTIVE` used to be a label rather than a lock. It is now both.

## Closed groups are hidden

`GET /api/groups` defaults to `status: ACTIVE` for supervisors and members. Pass `?includeInactive=true` to get them
back; the groups page has a **Show closed** checkbox that appears only when something is actually hidden, and the
response carries `hiddenInactive` so the checkbox can show the count.

Admins are exempt — `includeInactive` is forced on for them, because the admin panel has its own status filter and
hiding rows underneath it would be confusing.

The knock-on effect is that closed groups also drop out of the group pickers on `/meals`, `/bills` and `/payments`.
That is intended: you should not be filing this month's rent against a mess that shut down.

## Writes are blocked

`isGroupWritable(group)` and `GROUP_CLOSED_MESSAGE` live in `src/lib/groups.ts` and guard:

- `POST /api/groups/[id]/expenses` — bazar
- `POST /api/groups/[id]/bills` — bills
- `POST /api/groups/[id]/payments` — cash
- `PUT /api/groups/[id]/meals` — meals
- `POST /api/groups/[id]/meal-edit-window` — unlocking past meals

Reads stay open. History has to remain readable after a mess closes — that is most of the point of closing it rather
than deleting it.

## Closing frees a slot

`canCreateGroup` counts only `status: ACTIVE` groups, so closing one genuinely frees capacity against
`groupConfig.maxGroupsPerSupervisor`. The limit message already told supervisors to "Close or hand over an existing
group before creating another"; now that is actually true. The `ownedCount` shown as "3 of 10 used" counts active
groups too, so the copy and the enforcement agree.

## Closing a group is not closing a month

Two different things with similar names:

- **Closing a group** shuts the mess down. It is a status on `Group`.
- **Closing a month** freezes one month's figures and carries unpaid balances forward. See
  [month-closing.md](month-closing.md).

Close the month first, then the group — otherwise the last month's balances are never frozen and nothing carries
forward to show who left owing what.
