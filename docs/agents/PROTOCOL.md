# Agent protocol

Five agents work on this repo in parallel as scheduled cloud runs: `architect`, `fixer`, `android`, `ios` and `qa`. A run starts with no memory. Everything an agent knows comes from this file, its role file `.claude/agents/<role>.md`, `docs/agents/BOARD.md` and `docs/agents/DECISIONS.md`.

## Branches

- `agents/integration` is the shared branch. The board and the decisions live there, and every run starts from it.
- Work happens on `agents/<role>/<task-id>-<slug>`, branched from `agents/integration`.
- Only `qa` merges work branches into `agents/integration`.
- Never push to `develop`, `main` or any other branch. A push to `develop` deploys production. The owner squash-merges `agents/integration` into `develop` by hand, so commits on `develop` carry the owner's name.

## Every run

1. `git fetch origin && git checkout agents/integration && git pull --ff-only`
2. Read your role file and `BOARD.md`. Read `DECISIONS.md` only when your task depends on a decision.
3. Find your work: a `doing` or `todo` row owned by your role whose `Depends` rows are all `done`, or a message addressed to you. If there is none, stop and reply `idle`. Do not explore the code looking for something to do.
4. Take one task. `doing` before `todo`, `P0` before `P1` before `P2`, then table order.
5. `git checkout -b agents/<role>/<id>-<slug>`, or check out the branch already named in the row.
6. Do the work and run the checks. If the task is bigger than one run, finish a coherent slice, push it, and split the rest into new rows.
7. Commit (see Commits) and `git push -u origin <branch>`.
8. Switch back to `agents/integration` and `git pull --rebase` first. Change the board only with targeted edits to single rows or lines, never by writing out a copy of the file made earlier in the run, so other agents' updates survive. Update your row (status, branch, one-line note), add any new rows or messages, commit, `git pull --rebase`, push. If the push is rejected, pull with rebase and retry up to three times. If the rebase stops on a conflict in `BOARD.md` or `REPORTS.md`, keep both sides' changes, `git add` the file and `git rebase --continue`.
9. If the run changed anything, send the owner one push notification of at most three lines: the task ID, what you did, the branch, and anything the owner must decide. An `idle` run sends nothing.

## Board rules

- Statuses: `todo`, `doing`, `blocked`, `review`, `done`.
- Edit only your own rows. You may add rows owned by another role. `qa` may edit any row.
- New task IDs take the next free number after the role letter: `A` architect, `F` fixer, `D` android, `I` ios, `Q` qa.
- Messages go under `## Messages`: `- <from> -> <to> (<task id>): <at most two lines>`. Delete a message addressed to you once you have acted on it.
- Long write-ups go in `docs/agents/notes/<task-id>.md`, linked from the row. Keep the board short.

## Checks

The sandbox has no database and no running server. Before pushing web or backend changes:

    npm ci --no-audit --no-fund
    npm run typecheck
    npm run lint
    node scripts/check-allocation.js

Add new checks in the same `scripts/check-*.js` style, runnable without a database where possible. Mobile checks are whatever the `Checks:` line of the relevant ADR says.

If a check fails for a reason that is not yours, say so on the board instead of working around it.

## Commits

- Commit with the sandbox's own git identity. Never set or override `user.name` or `user.email`.
- Do not add a `Co-Authored-By` trailer or any other attribution line.
- First line in the imperative, saying what changes for a user of the app. A short body with the reason.
- Never commit `.env`, credentials, or anything under `uploads/`, `backups/`, `.next/` or `node_modules/`.

## Code rules

- No comments in source or config files. The reasoning goes in the commit body or in `docs/`.
- No hardcoded UI text. Web text goes through `strings.*` in `src/lib/i18n/locales/en.ts`. Mobile apps use their platform's string resources.
- Database changes are new Prisma migration files only. Never run `migrate dev`, `migrate reset`, `db:reset`, or any script that writes to a database.
- Before changing a feature, read its file in `docs/` if one exists and follow the patterns already in the code.

## Spending

Tokens are limited. On every run:

- stop with `idle` when there is nothing for you,
- take one task,
- read only the files the task needs, and use Grep and Glob instead of reading whole directories,
- never read `node_modules/`, `.next/`, `package-lock.json`, `tsconfig.tsbuildinfo`, `backups/` or `uploads/`,
- do not start subagents,
- keep board updates short.
