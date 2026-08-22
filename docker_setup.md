# Docker Setup

How to run **Bachelor Point** in Docker on this machine, using `docker compose`. All three
containers (`db`, `migrate`, `app`) are grouped together under a **bachelor-point** project in
Docker Desktop's Containers list, the same way any other Compose project shows up.

Run every command below from the repository root (the folder with `Dockerfile` and
`docker-compose.yml`):

```powershell
cd "C:\Users\Saidul islam rajib.BS-01696\Desktop\SoberProjects\Mess"
```

For the AWS/Kubernetes/Jenkins production pipeline, see [docs/DEVOPS.md](docs/DEVOPS.md) instead
— this file is local development only.

---

## 1. First-time setup

```powershell
Copy-Item .env.example .env
```

Edit `.env` and fill in at least `AUTH_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` (everything else
has a working default). `.env` is gitignored — it's yours alone.

If port `8080` or `5432` is already used by something else on your machine (see
[Troubleshooting](#4-troubleshooting) below), add these two lines to `.env` to move Bachelor
Point off the busy ports — `docker compose` reads `.env` automatically:

```
APP_PORT=8081
DB_PORT=5433
```

## 2. Start everything

```powershell
docker compose up -d --build
```

This builds the image, starts Postgres, waits for it to be healthy, runs migrations + role sync
+ admin creation, then starts the app. Open <http://localhost:8080> (or whatever you set
`APP_PORT` to).

```powershell
docker compose logs -f app     # follow the app's logs
docker compose ps              # container status
```

Stop it:

```powershell
docker compose down            # stop, keep data
docker compose down -v         # stop AND delete the Postgres + uploads data (destructive)
```

## 3. Day-to-day commands

**Rebuild after a code change:**

```powershell
docker compose up -d --build app
```

**Start containers that already exist** (fast — skips rebuilding):

```powershell
docker compose start
```

**Re-run migrations by hand** (e.g. after pulling a new migration without changing app code):

```powershell
docker compose run --rm migrate
```

**Shell into the running app container:**

```powershell
docker exec -it bachelor-point-app sh
```

**Liveness / readiness checks:**

```powershell
curl.exe http://localhost:8080/api/live     # no DB needed -> 200
curl.exe http://localhost:8080/api/health   # needs DB -> 200 once migrated
```

> PowerShell aliases `curl` to `Invoke-WebRequest`, which prints a different format. Use
> `curl.exe` for the plain-text output shown above.

---

## 4. Troubleshooting

### Docker Desktop window won't open

The CLI (`docker` command) talks straight to the backend service (`com.docker.backend`), which
is separate from the dashboard window (`Docker Desktop.exe`) — `docker ps` can work fine even
while the window is stuck or hidden. Check the system tray near the clock first.

If there's genuinely no window anywhere, kill every Docker process and relaunch. **Check nothing
important is running first** (`docker ps`) — this stops the backend too:

```powershell
docker ps
Get-Process | Where-Object { $_.ProcessName -like "*docker*" -or $_.ProcessName -like "*vpnkit*" } | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"
```

It takes 10-20 seconds after relaunching to fully boot.

### "ports are not available" on `8080`, even though nothing's using it

```
Error response from daemon: ports are not available: exposing port TCP 0.0.0.0:8080 -> 127.0.0.1:0:
listen tcp 0.0.0.0:8080: bind: An attempt was made to access a socket in a way forbidden by its
access permissions.
```

Check what actually holds the port:

```powershell
Get-NetTCPConnection -LocalPort 8080 -ErrorAction SilentlyContinue | Select-Object LocalAddress, LocalPort, State, OwningProcess
```

If the owning process is PID `4` (`System`) rather than a real app, that's not a real listener —
it's a **stale Hyper-V/WinNAT reservation**, left behind when Docker Desktop is killed forcefully
or crashes while a container had that port bound. `docker ps` won't show anything using it
either — that's the tell.

**Proper fix (needs an elevated/Administrator PowerShell):**

```powershell
net stop winnat
net start winnat
```

Right-click Start → *Terminal (Admin)*. This briefly resets Windows' NAT layer (other containers
using host ports blip for a second, then recover). Retry `docker compose up -d` afterwards.

**Quick workaround, no admin needed:** set `APP_PORT` (and/or `DB_PORT`) in `.env` to a free port
— `8081` and `5433` are good defaults — and re-run `docker compose up -d`. Compose recreates only
what changed.

### A different project's Postgres is squatting on port `5432`

If `db` fails to start with `port is already allocated`, another Docker Compose project on this
machine has its own Postgres bound to host port `5432` (check with
`docker ps --format "table {{.Names}}\t{{.Ports}}"` — a container from an unrelated project may
be listed). This only affects connecting to Postgres **from your host machine** (e.g. `psql` in a
terminal); it does not affect the app, which always talks to Postgres over the internal Docker
network as `db:5432`, never through the host port mapping. Set `DB_PORT=5433` (or any other free
port) in `.env` and re-run `docker compose up -d` to restore host access too.

### The app can't reach the database ("Can't reach database server at db:5432")

Check `db` is actually running:

```powershell
docker compose ps
```

If it's not, `docker compose up -d` restarts it (all data is preserved — it lives in the
`mess_postgres-data` volume, independent of the container). A machine sleep/reboot or a Docker
Desktop restart can leave a container stopped if nothing brought the stack back up afterward;
`restart: unless-stopped` in `docker-compose.yml` means this shouldn't happen going forward, but
if it ever does, `docker compose up -d` fixes it in one command.

---

## 5. Notes

- **Port:** the container always listens on `8080` internally (non-root containers can't bind
  port 80) — `APP_PORT` in `.env` only changes the **host-side** mapping, see §1.
- **Volumes:** Postgres data and uploaded photos live in the named volumes
  `mess_postgres-data` / `mess_uploads-data`, marked `external: true` in `docker-compose.yml` so
  they survive even though the Compose *project* is named `bachelor-point`, and so Compose never
  creates or deletes them itself — not even `docker compose down -v` touches an external volume.
  Removing them (if you ever genuinely want to) is a manual `docker volume rm`.
- **`AUTH_SECRET`** must be at least 32 characters; the app refuses to start in production
  without one.
- Image size is roughly 390 MB (Alpine base, standalone Next.js output).
