# Jenkins CI/CD

Jenkins runs **on your laptop in Docker**, not on AWS. A t3.micro has 1 GB of RAM and is
already running k3s plus the app — Jenkins needs about 2 GB on its own.

Everything is pre-configured through Configuration as Code, so there is no setup wizard and
no clicking through plugin lists. Start it and the pipeline job already exists.

---

## Start it

### 1. Create `jenkins/.env`

The compose file refuses to start without these. **This file is git-ignored.**

```bash
cd jenkins

cat > .env <<EOF
JENKINS_ADMIN_ID=admin
JENKINS_ADMIN_PASSWORD=$(openssl rand -base64 24)
SERVER_IP=$(terraform -chdir=../terraform/free-tier output -raw server_public_ip)
SSH_PRIVATE_KEY="$(cat ../terraform/free-tier/bachelor-point-key.pem)"
GIT_REPO_URL=https://github.com/saidul-islam-rajib/Bachelor-Mess-Manager.git
EOF

grep JENKINS_ADMIN_PASSWORD .env      # note this down
```

> `SSH_PRIVATE_KEY` must be the whole file including the `-----BEGIN` and `-----END` lines.
> The `$(cat ...)` above handles that.

### 2. Build and start

```bash
docker compose up -d --build      # first build takes ~3 minutes
docker compose logs -f jenkins    # wait for "Jenkins is fully up and running"
```

### 3. Open it

**<http://localhost:8080>**

Sign in with `admin` and the password from your `.env`.

The job **`bachelor-point-develop`** is already there. It polls `develop` every 2 minutes.

---

## What the pipeline does

```
Checkout            git clone, tag = short commit sha
Quality gate        npm ci, prisma generate, typecheck, lint
Ship source         tar the repo over SSH to the EC2 box
Build image         docker build on the server, import into k3s
Apply manifests     kubectl apply -k k8s/free-tier/
Database migration  Job: prisma migrate deploy, sync roles, ensure admin
Blue-green deploy   fill idle colour -> smoke test -> flip live traffic
Verify              curl /api/health through the public URL
Free memory         scale the old colour to zero (t3.micro is tight)

on failure          automatic rollback, live traffic returns to the old colour
```

---

## Trigger a deploy

```bash
git checkout develop
git commit --allow-empty -m "trigger deploy"
git push
```

Within 2 minutes Jenkins picks it up. Watch at
<http://localhost:8080/job/bachelor-point-develop/>.

Or click **Build Now** to run it immediately.

---

## Why polling instead of a webhook

GitHub cannot reach `localhost:8080`, so a push webhook is impossible without exposing your
machine. Two ways to get instant builds if the 2-minute delay bothers you:

```bash
# ngrok - free tier
ngrok http 8080
# then add the https URL + /github-webhook/ to
# repo Settings -> Webhooks, event: "Just the push event"
```

Or run Jenkins on a small always-on VPS instead of your laptop.

---

## Jenkins vs GitHub Actions

Both are configured in this repo. They do the same thing; pick one.

| | Jenkins (`Jenkinsfile.free-tier`) | GitHub Actions (`.github/workflows/deploy.yml`) |
| --- | --- | --- |
| Runs on | Your laptop, in Docker | GitHub's servers |
| Cost | Free, but your machine must be on | Free (2,000 min/month private) |
| Trigger | Polls every 2 min | Instant on push |
| Deploys while laptop is off | ❌ | ✅ |
| Good for | Learning Jenkins, the CV line | Actually shipping |

**Running both will cause two deploys per push.** To use only Jenkins, either delete
`.github/workflows/deploy.yml` or disable Actions in repo Settings.

---

## Operating it

```bash
cd jenkins

docker compose logs -f jenkins
docker compose restart jenkins
docker compose down                  # stop, keeps job history
docker compose down -v               # stop and wipe everything

docker compose exec jenkins bash     # shell inside
```

Job history and configuration live in the `jenkins-home` Docker volume and survive restarts.

---

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Compose exits with "set JENKINS_ADMIN_PASSWORD" | `jenkins/.env` is missing or incomplete |
| Cannot sign in | Password comes from `.env`; `docker compose down -v` then up to reset |
| `Host key verification failed` | The pipeline uses `StrictHostKeyChecking=no`; check `SERVER_IP` is right |
| `Permission denied (publickey)` | `SSH_PRIVATE_KEY` is truncated — it needs the BEGIN/END lines |
| Job does not appear | `docker compose logs jenkins \| grep -i casc` for a config error |
| Build fails at `npm ci` | Node 20 is in the image; check the build log for the real error |
| Deploy fails, site still up | Working as designed — it rolled back. Read the stage log. |
