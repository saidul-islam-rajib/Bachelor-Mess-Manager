# One-tap meal replies

Members stopped logging in to tick their meals. So the app asks them instead,
and the answer is one tap from wherever they already are: email, the
notification bell, or the dashboard.

Service: `src/lib/meal-prompts.ts`. Public page: `/meal-reply/<token>`.

## The flow

1. **Ask.** Once a day the dispatch job creates one `MealPrompt` per active
   member per active group for the target day (`MEAL_PROMPT_LEAD_DAYS` ahead,
   tomorrow by default). Each prompt gets a fresh random token; only its SHA-256
   hash is stored.
2. **Deliver.** Every member gets an in-app notification, and an email when SMTP
   is configured. The email has two big buttons — *Yes, count me in* and
   *No meals* — plus a *Choose meals* link.
3. **Answer.** The buttons open `/meal-reply/<token>?answer=YES|NO`, which
   applies the answer on load and shows what was saved. No sign-in, no app, no
   typing. Signed-in members get the same card on the dashboard.
4. **Change.** The link keeps working until it expires
   (`MEAL_PROMPT_VALID_HOURS`, 36h by default), so a wrong tap is one more tap
   to fix.

## What "yes" means

Yes writes the member's own meal plan for that weekday. Someone who never eats
breakfast does not get charged for one by answering yes. With no active plan for
that day, the `MEAL_PROMPT_DEFAULT_*` counts are used. No writes zeroes.
*Choose meals* opens per-meal steppers, capped at `MEAL_PROMPT_MAX_COUNT`.

Answers go through `applyMealCounts()` — the same writer the meals page uses —
so weights, totals and month maths cannot drift between the two paths.

## Running the daily job

```
MEAL_PROMPT_DISPATCH_SECRET="..." npm run meals:prompt
```

The script posts to `/api/meal-prompts/dispatch` with the secret in the
`x-dispatch-secret` header. It reads `APP_URL` to find the app, and
`MEAL_PROMPT_GROUP_ID` / `MEAL_PROMPT_DATE` narrow a manual run to one group or
one day. The job is idempotent per member, per group, per day, so a retry or an
overlapping run sends nothing twice.

On Kubernetes, `k8s/base/meal-prompt-cronjob.yaml` runs it daily at 19:00
Asia/Dhaka against the in-cluster service:

```
kubectl apply -f k8s/base/meal-prompt-cronjob.yaml
```

Like the backup CronJob it is applied on its own rather than through the base
kustomization, so a cluster can run the app without it. Put
`MEAL_PROMPT_DISPATCH_SECRET` in the `bachelor-point-secrets` Secret first —
without it the job exits non-zero and sends nothing. Anywhere else, any cron
that can run `npm run meals:prompt` with the same environment will do.

Supervisors can also trigger their own group by hand from the Meals page
("Ask everyone about meals"), and admins can trigger every active group.

## Security notes

- The token authorises exactly one thing: meal counts for one member, one group,
  one date. It creates no session and exposes no account data beyond the
  member's name, the group name and that day's counts.
- Tokens are random (`MEAL_PROMPT_TOKEN_BYTES`, 32 bytes) and stored hashed, so
  a database leak does not yield working links.
- Past days are refused, closed messes are refused, and members who have left
  the group are refused — checked server-side on every answer, not just in the
  UI.
- `/api/meal-reply/*` is the only meal-prompt route open to anonymous requests.
  `/api/meal-prompts` needs a session; `/api/meal-prompts/dispatch` needs the
  secret or an admin/supervisor session. All of them are rate limited like every
  other API route.
- Expired rows can be cleared with `pruneMealPrompts()`.
