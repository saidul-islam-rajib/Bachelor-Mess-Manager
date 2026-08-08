# Editing meals for days that have already passed

Past days used to be flatly locked for members (`body.date < todayKey()` → 403). That is safe but wrong in practice —
people forget to log a day, and the only workaround was to ask the supervisor to type it for them.

The rule now: **a past meal can change, but never quietly.** Either a supervisor approved it, or everybody was told.

## The member route

1. On `/meals` the member ticks **Edit my past meals**. That calls `POST /api/groups/[id]/meal-edit-window` and
   creates a `MealEditWindow` row with `expiresAt = now + SiteSettings.mealEditWindowMinutes`.
2. Past-day inputs unlock. A countdown shows how long is left.
3. Editing a past day does **not** write `MealEntry`. It creates a `MealChangeRequest` holding both the current
   counts (`from*`) and the proposed ones (`to*`). The meal table keeps its old numbers.
4. The supervisor gets a notification and an email.
5. `PATCH /api/meal-changes/[id]` with `APPROVED` applies the change to `MealEntry` **inside a transaction** with the
   status update, and notifies the rest of the group. `REJECTED` notifies only the requester.
6. The member can withdraw a pending request with `DELETE /api/meal-changes/[id]`.

The window row is the authority. The client countdown is decoration — every write re-reads `expiresAt` server side, so
holding the page open past expiry does not extend anything.

## The supervisor route

A supervisor (or admin) editing a past day applies it immediately, because they are the one accountable for the
month's numbers. In exchange, `notifyGroup` fires a notification **and an email** to every active member plus the
supervisor, naming the member, the date, and the exact change (`lunch 1 → 0, dinner 1 → 2`).

This is the case the requirements called out specifically, and it is the one that matters: changing one person's past
meals moves the meal rate for everyone, so everyone hears about it.

## Admin settings

`/admin` → Settings → **Editing past meals**:

| Setting | Column | Default | Meaning |
| --- | --- | --- | --- |
| Unlock lasts for | `SiteSettings.mealEditWindowMinutes` | `5` | 5/10/15/30 min, 1 hour, 1 day, or `0` for no limit |
| Supervisor must approve | `SiteSettings.mealEditRequiresApproval` | `true` | Off means member edits apply at once and notify the group instead |

`0` minutes means the unlock never lapses — the "lifetime" option. It still has to be ticked on deliberately, and the
member can untick it.

The policy is cached for 30s alongside the security policy and invalidated on any settings save
(`invalidateSecurityPolicyCache`).

## The supervisor can override the approval rule for their own mess

Members → Group settings → **Changes to past meals** writes `Group.mealEditRequiresApproval`, which is deliberately
**nullable**:

| Value | Meaning |
| --- | --- |
| `null` | Follow the site default — this mess moves whenever the admin changes `SiteSettings.mealEditRequiresApproval` |
| `true` | Past-meal changes wait for this supervisor, whatever the site default says |
| `false` | Past-meal changes count straight away and notify the group |

A plain boolean defaulting to the site value could not express "follow the default": the moment the admin flipped the
global switch, every group that had never been touched would silently stay on the old behaviour, because a copied
default is indistinguishable from a deliberate choice. `null` keeps the two apart.

`getMealEditPolicy(groupId)` resolves it — site policy first (cached), then a single indexed lookup for the group's
override. Both `readEditWindow` and `openEditWindow` pass the group through, so the member-facing copy on `/meals`
already reflects whichever rule is in force. The unlock **duration** stays site-wide; only the approval rule is
delegated.

The override is not cached, because a supervisor toggling it expects the next member edit to obey the new rule, and
a primary-key lookup per meal write is cheaper than the confusion of a 30-second lag.

## Why a request table rather than a flag on MealEntry

A pending change has to hold *two* states at once — what the table currently says and what the member is asking for —
because the rate must keep using the old value until approval. A flag on `MealEntry` cannot express that without
either mutating the row early or duplicating the counts anyway.

Keeping it separate also means `MealChangeRequest` doubles as the audit trail of who asked for what and who decided,
which `MealEntry` has no room for.
