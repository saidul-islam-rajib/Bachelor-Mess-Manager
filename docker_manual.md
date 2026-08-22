# Docker Manual

Quick reference for building and running **Bachelor Point** in Docker. Uses the existing
`Dockerfile` (multi-stage, non-root, standalone Next.js output on port `8080`) and
`docker-compose.yml` (Postgres + migrations + app) at the repo root.

For the full AWS/Kubernetes/Jenkins pipeline, see [docs/DEVOPS.md](docs/DEVOPS.md).

## Where to run these commands

- **Directory:** the repository root — the same folder that contains `Dockerfile` and
  `docker-compose.yml`. `docker build .` and `docker compose` both resolve paths relative to
  wherever you run them, so `cd` there first:

  ```powershell
  cd "C:\Users\Saidul islam rajib.BS-01696\Desktop\SoberProjects\Mess"
  ```

- **Shell:** every command below is written for **Windows PowerShell**, since that's this
  machine's default shell. The `docker`/`docker compose` commands themselves are identical in
  PowerShell, cmd.exe, and bash/Git Bash — only two things differ across shells, both called
  out where they come up:
  - **Setting an env var inline:** PowerShell uses `$env:NAME = "value"`; bash/Git Bash uses
    `export NAME="value"` or a `NAME=value` prefix on the command itself; cmd.exe uses
    `set NAME=value`.
  - **Line continuation** in a multi-line command: PowerShell uses a backtick `` ` `` at the
    end of the line; bash uses `\`; cmd.exe uses `^`. To sidestep this entirely, every
    multi-line command below also works fine typed as one long line — that's the safest option
    if you're pasting into cmd.exe.

---

## 1. Prerequisites

```powershell
docker --version
docker compose version
```

Copy the env template once, if you have not already:

```powershell
Copy-Item .env.example .env
```

*(bash/Git Bash: `cp .env.example .env`)*

---

## 2. Easiest path: full local stack with Compose

Run from the repo root. This starts Postgres, waits for it to be healthy, runs migrations +
role sync + admin creation, then starts the app. This is the recommended way to run it locally.

```powershell
docker compose up -d --build
```

```powershell
docker compose logs -f app          # follow the app's logs
docker compose ps                   # see container status
```

Open <http://localhost:8080>.

### Optional overrides

The compose file already has sane fallbacks (shown here), so this step is only needed if you
want different values. In PowerShell, set them as environment variables for the current
session, then run compose:

```powershell
$env:POSTGRES_USER = "bpadmin"
$env:POSTGRES_PASSWORD = "Local_Dev_Password_123"
$env:POSTGRES_DB = "bachelor_point"
$env:AUTH_SECRET = "local-development-secret-at-least-32-characters-long"
$env:ADMIN_EMAIL = "admin@bachelorpoint.local"
$env:ADMIN_PASSWORD = "ChangeThisAdminPassword2026"
docker compose up -d --build
```

*(bash/Git Bash equivalent: `export POSTGRES_USER=bpadmin` etc., one per line, then run
`docker compose up -d --build`.)*

Stop it:

```powershell
docker compose down          # stop, keep data volumes
docker compose down -v       # stop and delete Postgres + uploads volumes (destructive)
```

Rebuild after a code change:

```powershell
docker compose up -d --build app
```

Re-run migrations by hand (e.g. after pulling a new migration):

```powershell
docker compose run --rm migrate
```

---

## 3. Build the image by hand

Run from the repo root. The Dockerfile has three stages — `deps`, `builder`, `runner`. A
plain build targets the last stage (`runner`), which is what you want to actually run:

```powershell
docker build -t bachelor-point:local .
```

Build a specific stage (rarely needed, e.g. to debug the build):

```powershell
docker build --target builder -t bachelor-point:builder .
```

---

## 4. Run the image by hand (no Compose)

Use this against a Postgres instance you already have running (local, remote, or managed). Can
be run from any directory — it only needs the image, already built in step 3. The container
listens on `8080` and needs write access to `/data/uploads`.

```powershell
docker run -d --name bachelor-point-app -p 8080:8080 -e DATABASE_URL="postgresql://bpadmin:password@host.docker.internal:5432/bachelor_point?schema=public" -e AUTH_SECRET="a-long-random-value-at-least-32-characters" -e ADMIN_EMAIL="admin@yourdomain.com" -e ADMIN_PASSWORD="a-long-admin-password" -v bachelor-point-uploads:/data/uploads bachelor-point:local
```

Same command, split across lines with PowerShell's backtick continuation (functionally
identical to the one-liner above):

```powershell
docker run -d `
  --name bachelor-point-app `
  -p 8080:8080 `
  -e DATABASE_URL="postgresql://bpadmin:password@host.docker.internal:5432/bachelor_point?schema=public" `
  -e AUTH_SECRET="a-long-random-value-at-least-32-characters" `
  -e ADMIN_EMAIL="admin@yourdomain.com" `
  -e ADMIN_PASSWORD="a-long-admin-password" `
  -v bachelor-point-uploads:/data/uploads `
  bachelor-point:local
```

`host.docker.internal` reaches a Postgres instance running on your own machine (works on
Docker Desktop for Windows/Mac; on Linux add `--add-host=host.docker.internal:host-gateway`).

### Run migrations against that database first

The app expects the schema to already be migrated. Run this once (and again after every new
migration) before — or right after — starting the container:

```powershell
docker run --rm -e DATABASE_URL="postgresql://bpadmin:password@host.docker.internal:5432/bachelor_point?schema=public" -e ADMIN_EMAIL="admin@yourdomain.com" -e ADMIN_PASSWORD="a-long-admin-password" bachelor-point:local sh -c "npx prisma migrate deploy && node scripts/sync-roles.js && node scripts/init-admin.js"
```

---

## 5. Start containers that already exist

`docker run` and `docker compose up` both **create a new container** from the image every time
you call them. If a container with that name already exists (stopped, or stuck in `Created`
state — visible in Docker Desktop's Containers tab, or via `docker ps -a`), you don't need to
rebuild or recreate anything; just start what's already there.

### The whole compose project (`bachelor-point-app` / `-migrate` / `-db`)

From the repo root:

```powershell
docker compose start
```

This starts the existing containers in dependency order (`db` → `migrate` → `app`) without
recreating them, so it's fast and doesn't re-run `npm ci`/`prisma generate`. If you've changed
`docker-compose.yml` or the Dockerfile since they were created, use `docker compose up -d`
instead — it recreates only what actually changed and starts the rest as-is.

Stop the whole project the same way:

```powershell
docker compose stop
```

### A single container by name

```powershell
docker start bachelor-point-app
docker start bachelor-point-db
docker start bachelor-point-migrate
```

`docker start` works whether the container is `Exited` or stuck in `Created` (never
successfully started) — same as clicking the ▷ **play** button next to it in Docker Desktop.
To stop+start a container that's currently running (picks up nothing new, just bounces it):

```powershell
docker restart bachelor-point-app
```

### From the Docker Desktop GUI

The ▷ icon in the **Actions** column starts that one container; the ▷ next to the `mess` group
name starts every container in that compose project at once, in the right order. The ⋮ menu
next to it has Stop/Restart/Delete.

---

## 6. Useful day-to-day commands

Can be run from any directory.

```powershell
docker ps                                   # running containers
docker ps -a                                # every container, including stopped ones
docker logs -f bachelor-point-app           # follow logs (manual run)
docker compose logs -f app                  # follow logs (compose; run from repo root)
docker exec -it bachelor-point-app sh       # shell into the running container
curl.exe http://localhost:8080/api/live     # liveness (no DB needed) -> 200
curl.exe http://localhost:8080/api/health   # readiness (needs DB) -> 200 once migrated
```

> PowerShell aliases `curl` to `Invoke-WebRequest`, which prints a different format but works
> the same for these checks. Use `curl.exe` if you want the plain-text output shown above.

Stop / remove a manually-run container:

```powershell
docker stop bachelor-point-app
docker rm bachelor-point-app
```

Clean up dangling build layers:

```powershell
docker image prune -f
```

---

## 7. Troubleshooting

### 7.1 Docker Desktop window won't open

The CLI (`docker` command) talks straight to the backend service (`com.docker.backend`), which
is a separate process from the dashboard window (`Docker Desktop.exe`). This means
`docker version` / `docker ps` can work perfectly even while the window itself is stuck,
crashed, or hidden. Check the system tray near the clock first — it may just be minimized
there.

If there's really no window anywhere, the clean fix is to kill every Docker-related process and
relaunch. **Confirm nothing important is running first** (`docker ps`) — this stops the backend
too, which would interrupt any containers currently serving traffic:

```powershell
# 1. Check nothing is actively running that you care about
docker ps

# 2. Force-stop every Docker Desktop related process
Get-Process | Where-Object { $_.ProcessName -like "*docker*" -or $_.ProcessName -like "*vpnkit*" } | Stop-Process -Force -ErrorAction SilentlyContinue

# 3. Give Windows a moment to release ports/handles
Start-Sleep -Seconds 2

# 4. Relaunch Docker Desktop
Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"
```

It takes 10-20 seconds after step 4 to fully boot and show its window.

### 7.2 "ports are not available" — a port is stuck even though nothing's using it

Symptom, when starting a container that maps a host port (e.g. `8080`):

```
Error response from daemon: ports are not available: exposing port TCP 0.0.0.0:8080 -> 127.0.0.1:0:
listen tcp 0.0.0.0:8080: bind: An attempt was made to access a socket in a way forbidden by its
access permissions.
```

**Diagnose** — check what actually holds the port:

```powershell
Get-NetTCPConnection -LocalPort 8080 -ErrorAction SilentlyContinue | Select-Object LocalAddress, LocalPort, State, OwningProcess
Get-Process -Id <OwningProcess from above>
```

If the owning process is PID `4` (`System`) rather than a real application or a `docker`
process, that's not a real listener — it's a **stale Hyper-V/WinNAT host-network reservation**.
This happens on Windows when Docker Desktop (or its network proxy) is killed forcefully or
crashes while a container had that port bound; Windows' own networking stack keeps the
reservation even after Docker, and even after a normal Docker Desktop restart, because the
reservation lives in Windows, not in Docker. `docker ps` won't show anything using the port
either — that's the tell.

**Fix A — proper fix (needs an elevated/Administrator PowerShell):**

```powershell
net stop winnat
net start winnat
```

Right-click Start → *Terminal (Admin)* or *PowerShell (Admin)* to get an elevated prompt. This
briefly resets Windows' NAT layer (any other containers using host-mapped ports blip for a
second, then recover). Retry your `docker start` / `docker compose up` afterwards.

**Fix B — quick workaround, no admin needed:** run the container on a different host port
instead. This recreates the container (`docker start` can't change an existing container's
port mapping), so pull its current network/volume/env first if you don't already know them:

```powershell
docker inspect bachelor-point-app --format '{{json .NetworkSettings.Networks}}'
docker inspect bachelor-point-app --format '{{range .Config.Env}}{{println .}}{{end}}'
docker inspect bachelor-point-app --format '{{json .Mounts}}'
```

Then remove the stuck container and recreate it with the same settings, mapped to a free port
(`8081` here) instead of the blocked one:

```powershell
docker rm bachelor-point-app
docker run -d `
  --name bachelor-point-app `
  --network mess_default `
  --network-alias app `
  -p 8081:8080 `
  -e DATABASE_URL="postgresql://bpadmin:Local_Dev_Password_123@db:5432/bachelor_point?schema=public" `
  -e AUTH_SECRET="replace-me-with-a-long-random-value-at-least-32-characters" `
  -e ADMIN_EMAIL="admin@team-sober.com" `
  -e ADMIN_PASSWORD="Admin@team-sober.com" `
  -e UPLOAD_DIR=/data/uploads `
  -e SECURITY_TRUST_PROXY_HEADERS=false `
  -v mess_uploads-data:/data/uploads `
  --restart unless-stopped `
  mess-app
```

Now open <http://localhost:8081> instead of `:8080`. `--network mess_default` keeps it on the
same Docker network as `bachelor-point-db` (so `db:5432` in `DATABASE_URL` still resolves), and
`-v mess_uploads-data:/data/uploads` reuses the same uploads volume the compose stack created —
nothing is lost by recreating the container this way.

Once Fix A has been run (or after a reboot) and port `8080` is free again, switch back:

```powershell
docker rm -f bachelor-point-app
docker compose up -d app
```

---

## 8. Notes

- **Port:** the container always listens on `8080` (see `docs/DEVOPS.md` §2 for why — non-root
  containers cannot bind port 80).
- **Uploads:** profile/community/listing photos are written to `/data/uploads` inside the
  container. Always mount a volume there (`-v bachelor-point-uploads:/data/uploads` or the
  compose `uploads-data` volume) or every upload is lost when the container is removed.
- **`AUTH_SECRET`** must be at least 32 characters; the app refuses to start in production
  without one.
- Image size is roughly 390 MB (Alpine base, standalone Next.js output).
