# Jenkins Setup — existing server

Wiring your existing Jenkins at **<http://16.171.254.209:8080>** to deploy Bachelor Point
to the k3s server at `54.251.180.71` on every push to `develop`.

Your Jenkins is public and always on, which is better than a laptop instance: it can receive
GitHub webhooks for instant builds, and it deploys whether or not your machine is on.

---

## Already done

The k3s server's security group now allows SSH from `16.171.254.209/32`. Verified:

```
103.95.99.147/32      SSH
16.171.254.209/32     SSH from the Jenkins CI server
```

---

## Step 1 — Add two credentials

**<http://16.171.254.209:8080/manage/credentials/store/system/domain/_/>** → *Add Credentials*

### Credential 1: the deploy key

| Field | Value |
| --- | --- |
| Kind | **SSH Username with private key** |
| ID | `ssh-key-ec2` |
| Username | `ubuntu` |
| Private Key | **Enter directly** → paste the whole file |

Get the key with:

```bash
cat terraform/free-tier/bachelor-point-key.pem
```

Paste **everything**, including `-----BEGIN OPENSSH PRIVATE KEY-----` and
`-----END OPENSSH PRIVATE KEY-----`. A truncated key gives `Permission denied (publickey)`.

### Credential 2: the target server

| Field | Value |
| --- | --- |
| Kind | **Secret text** |
| ID | `server-ip` |
| Secret | `54.251.180.71` |

> The IDs must match exactly — `Jenkinsfile.free-tier` looks them up by ID.

---

## Step 2 — Create the pipeline job

**<http://16.171.254.209:8080/view/all/newJob>**

1. Name: `bachelor-point`
2. Type: **Pipeline** → OK
3. **Build Triggers** → tick **GitHub hook trigger for GITScm polling**
4. **Pipeline** section:

| Field | Value |
| --- | --- |
| Definition | **Pipeline script from SCM** |
| SCM | **Git** |
| Repository URL | `https://github.com/saidul-islam-rajib/Bachelor-Mess-Manager.git` |
| Credentials | your GitHub credential (add one if the repo is private) |
| Branch Specifier | `*/develop` |
| Script Path | `Jenkinsfile.free-tier` |

5. **Save**

---

## Step 3 — Point GitHub at Jenkins

**<https://github.com/saidul-islam-rajib/Bachelor-Mess-Manager/settings/hooks>** → *Add webhook*

| Field | Value |
| --- | --- |
| Payload URL | `http://16.171.254.209:8080/github-webhook/` |
| Content type | `application/json` |
| Events | **Just the push event** |
| Active | ✅ |

The trailing slash on `/github-webhook/` matters.

GitHub shows a green tick next to the hook once it delivers successfully. You can also check
**GitHub Hook Log** in the Jenkins job sidebar.

---

## Step 4 — Deploy

```bash
git checkout -b develop      # first time only
git push -u origin develop
```

Watch it at **<http://16.171.254.209:8080/job/bachelor-point/>**

From now on, every push to `develop` deploys automatically.

---

## What the pipeline does

| Stage | What happens |
| --- | --- |
| Checkout | Clone `develop`, tag = short commit SHA |
| Quality gate | `npm ci`, `prisma generate`, `typecheck`, `lint` |
| Ship source to server | tar the repo over SSH to `~/app` |
| Build image on server | `docker build`, import into k3s |
| Apply manifests | `kubectl apply -k k8s/free-tier/` |
| Database migration | Job: migrate, sync roles, ensure admin |
| Blue-green deploy | Fill the idle colour, smoke test, flip live traffic |
| Verify live site | `curl /api/health` through the public URL |
| Free memory | Scale the old colour to zero |
| **on failure** | **Automatic rollback — live traffic returns to the previous version** |

---

## Jenkins agent requirements

The pipeline runs `npm ci` and `npx prisma generate` on the Jenkins agent, so that box needs:

```bash
node --version     # 20.x
git --version
ssh -V
curl --version
```

If Node is missing:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

Plugins needed: **Pipeline**, **Git**, **SSH Agent**, **GitHub**, **Credentials Binding**,
**Timestamper**, **AnsiColor**, **Workspace Cleanup**.

> If you would rather not install Node on the Jenkins box, tell me and I will move the quality
> gate into a Docker step instead.

---

## Verify the connection before the first build

From the Jenkins server:

```bash
ssh -i /path/to/bachelor-point-key.pem ubuntu@54.251.180.71 'sudo k3s kubectl get nodes'
```

Expect `bachelor-point-node   Ready   control-plane`.

---

## Which CI/CD is actually in charge

You now have three possible pipelines. **Only run one**, or every push deploys two or three
times and they race each other.

| Pipeline | File | Status | Recommendation |
| --- | --- | --- | --- |
| **Existing Jenkins** | `Jenkinsfile.free-tier` | Set it up above | ✅ **Use this** |
| GitHub Actions | `.github/workflows/deploy.yml` | Committed, no secrets yet | Delete or leave secret-less |
| Local Docker Jenkins | `jenkins/` | Never started | Delete the folder |

To retire the other two:

```bash
rm .github/workflows/deploy.yml
rm -rf jenkins/
git add -A && git commit -m "Use the existing Jenkins server for CI/CD"
```

---

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| `Permission denied (publickey)` | Key truncated, or username is not `ubuntu` | Re-paste the full key |
| `Connection timed out` | Security group | Confirm `16.171.254.209/32` allows port 22 |
| `npm: command not found` | Node missing on the agent | Install Node 20 |
| Webhook not firing | Wrong URL or Jenkins unreachable | Check GitHub → Settings → Hooks → Recent Deliveries |
| `credentials 'server-ip' not found` | Credential ID typo | IDs must be exactly `ssh-key-ec2` and `server-ip` |
| Build passes but site unchanged | Deployed to the idle colour, switch failed | `./scripts/blue-green.sh status` on the server |
| Migration stage hangs | RDS unreachable or a slow migration | `kubectl logs job/bachelor-point-migrate` |

### Emergency rollback

```bash
ssh -i bachelor-point-key.pem ubuntu@54.251.180.71 \
  "cd ~/app && sudo KUBECTL='k3s kubectl' ./scripts/blue-green.sh rollback"
```

---

## All the links

| Service | URL |
| --- | --- |
| **Jenkins** | <http://16.171.254.209:8080> |
| **This job** | <http://16.171.254.209:8080/job/bachelor-point/> |
| **Live site** | <http://54.251.180.71.nip.io> |
| Health | <http://54.251.180.71.nip.io/api/health> |
| Repository | <https://github.com/saidul-islam-rajib/Bachelor-Mess-Manager> |
| Webhook settings | <https://github.com/saidul-islam-rajib/Bachelor-Mess-Manager/settings/hooks> |
