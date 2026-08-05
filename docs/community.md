# Community room

One room, every approved member of the app. There is no join step and no
membership table: being approved *is* membership, so a new account can read and
post the moment it is activated, and existing accounts were already in it the
day the feature shipped.

Page: `/community`. API: `/api/community/*`. Service: `src/lib/community/`.

## What lives in the room

| Type           | Written by                        | Looks like                        |
| -------------- | --------------------------------- | --------------------------------- |
| `MEMBER`       | a signed-in member                | a normal chat message             |
| `WELCOME`      | the app, when an account is approved | "X just joined. Say hello."    |
| `ANNOUNCEMENT` | the app, from the release catalogue | pinned "What's new" card        |
| `SYSTEM`       | reserved for future notices       | neutral card                      |

Member messages support the same `@mention` tokens as mess comments (the collapsible
section on `/members`), so
`src/lib/mentions.ts` is shared rather than duplicated. Mentioned members get an
in-app notification (`MENTION_COMMUNITY`) linking back to the room.

## Announcing a new feature

Announcements are a code catalogue, not admin data entry, so shipping a feature
and announcing it are the same deploy:

1. Add copy to `strings.community.announcements` in
   `src/lib/i18n/locales/en.ts`.
2. Add an entry to `ANNOUNCEMENTS` in `src/lib/community/announcements.ts` with
   a **new, stable key** (`meal-quick-reply-v1`).

`publishPendingAnnouncements()` runs during application bootstrap. It posts only
the keys that are missing, so restarts, extra instances and redeploys never
duplicate a post. Editing the copy of an already published key does not
re-post it — bump the key if the change matters enough to notify people again.

Announcements deliberately do **not** create notifications. They are pinned and
raise the nav unread badge; a fan-out to every account on every release would be
noise and a write storm.

## Welcome messages

`ensureWelcomeMessage(user)` is called from three places: when a member sets
their password and is auto-approved, when an admin approves them, and lazily
when the room is opened. All three are safe because the message key is
`welcome:<userId>` and the column is unique — whoever gets there first wins.

## Unread badge

`CommunityRead` holds one `lastReadAt` per member. The count is messages newer
than that marker that the member did not write. System posts have no author, so
the query uses `OR: [{ authorId: null }, { authorId: { not: userId } }]` —
a plain `not` would silently drop them, because SQL comparisons against `NULL`
are never true.

## @everyone

Only admins can notify everyone. For everyone else the option is hidden in the
composer *and* ignored on the server, so a hand-crafted request cannot page the
whole app. The blast is capped by `COMMUNITY_EVERYONE_CAP`.

## Message keys

Every row carries a unique `key`, including ordinary member posts
(`message:<uuid>`). This is not decoration: SQL Server treats `NULL`s in a
unique constraint as equal to each other, so a nullable unique key would allow
exactly one member message in the entire table. Keeping the column required
gives system posts their idempotency and member posts a harmless unique value.
