# Backups

Everything here is free. No paid service, no cloud bill, no extra dependency — it uses the Prisma client and Node's
built-in `zlib` and `crypto`, both already in the project.

## The short version

```bash
npm run backup:db      # take a backup now, rotate old ones
npm run restore:db     # restore the newest backup (asks for confirmation)
```

Schedule it once and forget it:

```powershell
# elevated PowerShell, from the project root
powershell -ExecutionPolicy Bypass -File scripts\schedule-backup.ps1
```

That registers a Windows Scheduled Task running daily at 02:30, logging to `backups\backup.log`.

## Rotation

`BACKUP_KEEP_COUNT` (default **2**) is how many backups survive. This is the behaviour you asked for:

| Day | Runs | Files kept afterwards |
| --- | --- | --- |
| 1 | backup1 | backup1 |
| 2 | backup2 | backup1, backup2 |
| 3 | backup3 | backup2, backup3 — **backup1 deleted** |
| 4 | backup4 | backup3, backup4 |

Verified end to end: three consecutive runs left exactly the newest two, and the oldest was rotated out.

Files are named `backup-<database>-<UTC timestamp>.json.gz`, so they sort chronologically and never collide. Each one
gets a `.sha256` sidecar, deleted with its backup when it rotates out.

### A word on keeping only two

Two days of history is thin. It protects you against a server dying, but **not** against damage you don't notice
within 48 hours — a bad migration, a bug that quietly corrupts rows, or someone deleting a group on Friday that
nobody misses until Monday. By then both good copies are gone.

The industry norm is a grandfather-father-son rotation: 7 daily, 4 weekly, 12 monthly. It costs nothing extra here
because these files are tiny (~10 KB gzipped at current data volumes — a year of daily backups is a few megabytes).

I have left the default at 2 because that is what you asked for. If you want more history, it is one environment
variable:

```env
BACKUP_KEEP_COUNT=7
```

## What gets backed up

The default is a **logical export**: every row of every table in the live database, as gzipped JSON.

It reads the table list from `INFORMATION_SCHEMA.TABLES` at runtime rather than from the Prisma schema. That matters —
an earlier version keyed off the Prisma models and broke the moment the schema and the database were one migration
apart. Reading the live catalogue means the backup captures whatever is actually there, always.

Advantages of a logical export here:

- No admin rights and no special SQL Server permissions needed.
- Works identically on SQL Server Express, a Docker container, or a managed cloud database.
- Human-readable once un-gzipped, so you can inspect or repair one row without a full restore.
- Tiny and fast: currently ~175 rows across 30 tables in 0.2s at about 10 KB.

The tradeoff is that it is a **point-in-time snapshot of data only** — not the schema, indexes, or transaction log.
Restoring needs a database whose schema is already migrated. That is fine here because the schema lives in
`prisma/migrations` and is rebuilt with `npm run prisma:deploy`.

### Native SQL Server backups

`BACKUP DATABASE` is also supported and is the stronger option if you can use it: it captures the schema, is
restorable to a point in time, and is verified by SQL Server itself.

It needs one thing the logical export does not — the **SQL Server service account** must be able to write to the
backup folder. SQL Server writes the file itself, so a folder your Windows user owns (like the project directory)
will fail with `Operating system error 5 (Access is denied)`.

To enable it, grant the service account write access to a folder once, then point the script at it:

```powershell
# elevated, once. Adjust the service account if yours differs.
icacls "C:\SqlBackups" /grant "NT SERVICE\MSSQL$SQLEXPRESS:(OI)(CI)F"
```

```env
BACKUP_MODE=native
BACKUP_NATIVE_DIR=C:\SqlBackups
```

The script runs `BACKUP DATABASE ... WITH CHECKSUM`, then `RESTORE VERIFYONLY` to prove the file is readable, then
gzips a copy into the archive directory. Express Edition has no native backup compression, which is why the gzip step
exists.

In `auto` mode (the default) a native backup is attempted only if `BACKUP_NATIVE_DIR` is set, and it falls back to a
logical export if the permission is missing rather than failing the run.

## Restoring

```bash
npm run restore:db                                    # newest backup, prompts for confirmation
npm run restore:db -- backups/backup-....json.gz --yes
npm run restore:db -- --dry-run                       # show what is in a backup, write nothing
```

The restore:

1. Verifies the `.sha256` sidecar and refuses to proceed on a mismatch — a truncated backup is worse than none.
2. Checks the target database has every table the backup expects, and tells you to run `prisma:deploy` if not.
3. Disables foreign keys, clears the tables, inserts in batches of 100, then **re-enables the constraints with
   `WITH CHECK`** so SQL Server re-validates every relationship. If the restored data had a broken reference, this
   step fails loudly rather than leaving a quietly inconsistent database.
4. Leaves `_prisma_migrations` alone, so the target keeps its own migration history. Restoring an old migration table
   onto a newer schema would make `prisma migrate deploy` try to re-run migrations that are already applied.

### Restore into a scratch database instead

Never test a restore on live data. Point it somewhere else:

```bash
npm run restore:db -- backups/backup-....json.gz --target-database=bp_restore_test --yes
node scripts/verify-restore.js bachelor_point bp_restore_test
```

`verify-restore.js` compares row counts table by table and exits non-zero on any mismatch. This is how the backup was
proven: **175 rows across 30 tables matched exactly, with foreign keys re-validated.**

Do this monthly. A backup nobody has restored is a hope, not a backup.

## Getting the files off the machine

A backup sitting on the same disk as the database does not survive that disk dying. Free ways to get a second copy:

- **`BACKUP_MIRROR_DIR`** — set it to another physical drive, a USB stick, or a synced folder (OneDrive, Google Drive,
  Dropbox all have free tiers). The script copies each backup and rotates the mirror on the same schedule.

  ```env
  BACKUP_MIRROR_DIR=D:\Backups\bachelor-point
  ```

- **rclone** to any free object-storage tier, added as a second scheduled task. rclone itself is free and supports
  most providers.

- **A private Git repository** works for files this small, but only while they stay small, and it keeps deleted data
  forever in history — a poor fit for personal data. Prefer the mirror directory.

Because these files contain live personal data (names, emails, phone numbers), `/backups/` is in `.gitignore`.
Keep it that way, and treat a backup file with the same care as the database itself.

## In Kubernetes

`k8s/base/backup-cronjob.yaml` runs the same script daily at 02:30 Asia/Dhaka against a `PersistentVolumeClaim`:

```bash
kubectl apply -f k8s/base/backup-cronjob.yaml
kubectl create job --from=cronjob/bachelor-point-backup manual-backup-1 -n bachelor-point   # run it now
kubectl logs -l component=backup -n bachelor-point
```

It reuses the app image and the existing ConfigMap and Secret, so there is no separate credential to manage. It runs
as non-root with a read-only root filesystem and all capabilities dropped, matching the other workloads.

## Configuration

| Variable | Default | Meaning |
| --- | --- | --- |
| `BACKUP_KEEP_COUNT` | `2` | How many backups to keep |
| `BACKUP_DIR` | `./backups` | Where the archive lives |
| `BACKUP_MIRROR_DIR` | *(unset)* | Optional second copy, rotated the same way |
| `BACKUP_MODE` | `auto` | `auto`, `native`, or `export` |
| `BACKUP_NATIVE_DIR` | *(unset)* | Folder the SQL Server service can write to |

## Before you run a migration

Take one first. It costs 0.2 seconds:

```bash
npm run backup:db && npm run prisma:deploy
```

That is exactly the order used when applying the settlement migration to this database.
