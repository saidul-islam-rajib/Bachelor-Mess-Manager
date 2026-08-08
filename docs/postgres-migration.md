# PostgreSQL migration and deployment

## What changed

The app ran on Amazon RDS for SQL Server Express. It now runs on a PostgreSQL 16
pod inside the same k3s cluster as the app, and RDS has been deleted.

RDS cost about $79/month, of which roughly $52 was surplus CPU-credit charges:
SQL Server Express idles at ~35% CPU on a `db.t3.micro`, well above the 10%
baseline, so the instance burned credits continuously even though the database
held under 0.5 GB and served three connections. PostgreSQL idles near zero on
the same workload.

The Prisma schema needed no structural changes. It used no `@db.*` native types,
no `Unsupported()`, and no raw SQL outside the backup scripts, so switching the
datasource provider and regenerating a baseline migration was sufficient.

## Architecture

Caddy terminates HTTP and proxies to `bachelor-point-active`, a service whose
`color` selector is flipped between the blue and green deployments. PostgreSQL
runs as a single replica with a `local-path` PVC, reachable in-cluster at
`postgres:5432`.

`DATABASE_URL` lives in the `bachelor-point-secrets` secret. The Postgres
superuser credentials live separately in `postgres-credentials`, and the app's
URL is composed from them.

## Deploying

Pushes to `develop` run `.github/workflows/deploy.yml` on a self-hosted runner
installed on the server itself. The runner connects outbound to GitHub, so no
inbound port is exposed and no SSH allowlist is needed.

To deploy by hand:

    ./scripts/deploy.sh

To undo the last release:

    ./scripts/deploy.sh --rollback

`blue-green.sh deploy` already switches traffic once the idle colour passes its
smoke test, so `deploy.sh` must not call `switch` afterwards; doing so flips
traffic straight back onto the colour that is mid-restart.

Because the previous colour is scaled to zero after a release to save memory on
a small node, rollback scales it back up and waits for it to become ready before
switching, rather than assuming it still has running pods.

## Namespace quota

A release briefly runs both colours alongside Caddy, Postgres and the migration
job. The quota ceilings are set high enough to fit that overlap; lowering
`limits.cpu` below about 3 will make deploys fail to schedule with
`exceeded quota` rather than fail visibly in the job.

Limits are throttling ceilings, not reservations. Actual usage across all pods
is around 1.1 GiB.

## Backups

`scripts/backup-db.js` uses `pg_dump --format=custom` and verifies the result
with `pg_restore --list`. When `pg_dump` is not on PATH it falls back to a
logical JSON export driven through Prisma, so it still works inside the app
image, which does not ship the Postgres client tools.

`k8s/base/backup-cronjob.yaml` runs it nightly. Note that this cronjob was
present in the repository but absent from `base/kustomization.yaml` for some
time, so it had never actually been deployed.

## Restoring

`scripts/restore-db.js` replaces every row in the target database. It runs the
whole load inside one transaction with `session_replication_role = replica`, so
foreign keys are not enforced during the load and table order does not matter.
Pass `--target-database` to restore into a scratch database instead of the live
one.

## Moving to another host

`scripts/bootstrap-server.sh` prepares a fresh Ubuntu host: Docker, k3s with
Traefik disabled, swap, and the firewall rules. It is architecture independent.

The Prisma client is generated for both `linux-musl-openssl-3.0.x` and
`linux-musl-arm64-openssl-3.0.x`, so the image builds on x86 and arm64 hosts
without further changes.
