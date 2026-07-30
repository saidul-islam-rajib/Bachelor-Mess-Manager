# Jenkins Setup — step by step

Wiring the Jenkins server at **<http://16.171.254.209:8080>** so that every push to the
`develop` branch automatically builds and deploys to the k3s server at `54.251.180.71`.

Written for someone who has not set up a Jenkins pipeline before. Follow the steps in order —
each one depends on the one before it.

---

## What you are building

```
you push to develop
        ↓
GitHub fires a webhook
        ↓
Jenkins wakes up, clones the repo
        ↓
Jenkins runs typecheck + lint
        ↓
Jenkins SSHes into 54.251.180.71
        ↓
builds the Docker image there, applies manifests, migrates the DB
        ↓
blue-green switch: fills the idle colour, smoke tests it, flips live traffic
```

Three separate machines are involved. Keeping them straight makes the rest much easier:

| Machine | Address | Role |
| --- | --- | --- |
| **Jenkins** | `16.171.254.209` | Runs the pipeline. Needs to SSH out. |
| **k3s server** | `54.251.180.71` | Runs the app. Receives the SSH. |
| **Your laptop** | rotating ISP IP | Not involved once this works. |

---

## Current status

| Piece | State |
| --- | --- |
| Jenkins server running | ✅ Live, version 2.568.1 |
| `develop` branch exists | ✅ Local and on origin |
| `Jenkinsfile.free-tier` in repo | ✅ Present |
| Jenkins allowed to SSH to k3s | ❌ **Missing — Step 0** |
| Credentials in Jenkins | ❌ Not created |
| Pipeline job | ❌ Not created |
| GitHub webhook | ❌ Not created |

---

## Step 0 — Let Jenkins reach the server

**Do this first.** Without it every SSH stage fails with `Connection timed out`, and the error
gives no hint about the cause.

The k3s server's firewall (an AWS security group) only accepts SSH from addresses on an
allowlist. Jenkins is not on it.

Check what is currently allowed:

```bash
aws ec2 describe-security-group-rules --region ap-southeast-1 \
  --filters "Name=group-id,Values=sg-052bc1524a2600795" \
  --query "SecurityGroupRules[?FromPort==\`22\`].{Cidr:CidrIpv4}" --output table
```

If `16.171.254.209/32` is not listed, add it:

```bash
aws ec2 authorize-security-group-ingress --region ap-southeast-1 \
  --group-id sg-052bc1524a2600795 \
  --protocol tcp --port 22 --cidr 16.171.254.209/32
```

> **Why this keeps disappearing.** `main.tf` declares this rule as a standalone
> `aws_security_group_rule "ci_ssh"` resource, but the same security group also uses inline
> `ingress` blocks. Terraform treats inline blocks as the complete list of rules, so every
> `terraform apply` deletes rules declared separately. The permanent fix is to move *all* rules
> to standalone `aws_security_group_rule` resources, or fold `ci_ssh` into the inline blocks.
> Until then, re-run the command above after any apply.

---

## Step 1 — Check the Jenkins agent has Node

> ### ⚠️ This step is on the Jenkins machine, NOT the k3s server
>
> These two boxes need completely different software. Mixing them up is the most common
> mistake here.
>
> | Machine | Address | Shell prompt looks like | Needs Node? |
> | --- | --- | --- | --- |
> | **Jenkins** | `16.171.254.209` | *not* `ip-10-10-0-67` | ✅ **Yes** |
> | **k3s server** | `54.251.180.71` | `ubuntu@ip-10-10-0-67` | ❌ **No** |
>
> If your prompt says `ubuntu@ip-10-10-0-67`, you are on the k3s server. Type `exit` and
> connect to Jenkins instead.
>
> The k3s server builds the app *inside a Docker container*, so Node comes from the
> `Dockerfile`. It only needs Docker, k3s and tar — all already installed. Installing Node
> there does nothing.

The pipeline's `Quality gate` stage runs `npm ci`, `npx prisma generate`, `npm run typecheck`
and `npm run lint` as plain `sh` steps — no `sshagent` wrapper — which means they execute on
the Jenkins agent, before Jenkins ever contacts the k3s server. Without Node there, the build
fails at the first stage.

On the **Jenkins** machine:

```bash
node --version     # need 20.x
git --version
ssh -V
curl --version
```

If Node is missing or older than 20:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### If you cannot get a shell on the Jenkins machine

Use Jenkins' own NodeJS tool instead — it downloads Node automatically for each build, no shell
access required:

1. **Manage Jenkins → Plugins** → install **NodeJS**
2. **Manage Jenkins → Tools → NodeJS installations** → *Add NodeJS*
   - Name: `node20`
   - ☑ Install automatically
   - Version: **pick a 20.x entry**. The dropdown defaults to the newest release, which is not
     20.x. `Dockerfile` builds on `node:20-alpine`, so testing on a different major version
     means the quality gate runs against something production never uses.
   - **Save**
3. Add a `tools` block to `Jenkinsfile.free-tier`, directly after `agent any` (already done in
   this repo):

```groovy
  tools {
    nodejs 'node20'
  }
```

The name in the Jenkinsfile must match the name you gave the installation exactly.

> **This only takes effect once it is pushed.** Jenkins reads `Jenkinsfile.free-tier` from the
> `develop` branch on GitHub, never from your laptop. Editing the file locally changes nothing
> until you commit and push it to `develop`.

Jenkins also needs these plugins — **Manage Jenkins → Plugins → Installed**:

**Pipeline**, **Git**, **SSH Agent**, **GitHub**, **Credentials Binding**, **Timestamper**,
**AnsiColor**, **Workspace Cleanup**.

`SSH Agent` is the one people forget. Without it the pipeline fails with
`No such DSL method 'sshagent'`.

---

## Step 2 — Add the SSH key credential

This is the private key that lets Jenkins log into the k3s server as the `ubuntu` user.

Go to **<http://16.171.254.209:8080/manage/credentials/store/system/domain/_/>** and click
**+ Add Credentials**. You will see a list of credential types — pick
**SSH Username with private key**.

Fill it in exactly:

| Field | Value |
| --- | --- |
| Scope | `Global` |
| ID | `ssh-key-ec2` |
| Description | `k3s deploy key` (anything you like) |
| Username | `ubuntu` |
| Private Key | select **Enter directly**, then **Add**, then paste |
| Passphrase | leave empty |

To get the key text, run this on your laptop and copy **the entire output**:

```bash
cat terraform/free-tier/bachelor-point-key.pem
```

It is 53 lines. It must start with:

```
-----BEGIN OPENSSH PRIVATE KEY-----
```

and end with:

```
-----END OPENSSH PRIVATE KEY-----
```

Include both of those lines. Do not add or remove blank lines, and make sure there is a newline
after the final `-----END OPENSSH PRIVATE KEY-----`. A truncated or reformatted key produces
`Permission denied (publickey)` at deploy time, which looks like a permissions problem but is
actually a paste problem.

Click **Create**.

> **The ID is not cosmetic.** `Jenkinsfile.free-tier` looks the credential up by the exact
> string `ssh-key-ec2`. A different ID gives
> `ERROR: Could not find credentials entry with ID 'ssh-key-ec2'`.

---

## Step 3 — Add the server address credential

Same page, **+ Add Credentials** again. This time pick **Secret text**.

| Field | Value |
| --- | --- |
| Scope | `Global` |
| ID | `server-ip` |
| Secret | `54.251.180.71` |
| Description | `k3s server address` |

Click **Create**.

You should now see two credentials listed, with IDs `ssh-key-ec2` and `server-ip`.

---

## Step 4 — Add a GitHub credential (only if the repo is private)

If `https://github.com/saidul-islam-rajib/Bachelor-Mess-Manager` is public, skip this.

If it is private, Jenkins cannot clone it without credentials. Use a Personal Access Token, not
your GitHub password:

1. Create a token at <https://github.com/settings/tokens> with the **`repo`** scope
2. In Jenkins, **+ Add Credentials** → **Username with password**
   - Username: `saidul-islam-rajib`
   - Password: the token
   - ID: `github-creds`

---

## Step 5 — Create the pipeline job

Go to **<http://16.171.254.209:8080/view/all/newJob>**.

1. **Enter an item name**: `bachelor-point`

   This name must match, because the job URL becomes
   `http://16.171.254.209:8080/job/bachelor-point/`.

2. Select **Pipeline** from the list of types. Not *Freestyle project*, not *Multibranch*.

3. Click **OK**. You land on the job configuration page.

4. Scroll to **Build Triggers** and tick:

   **☑ GitHub hook trigger for GITScm polling**

   This is what lets the webhook in Step 6 start a build.

5. Scroll to the **Pipeline** section at the bottom and set:

| Field | Value |
| --- | --- |
| Definition | **Pipeline script from SCM** |
| SCM | **Git** |
| Repository URL | `https://github.com/saidul-islam-rajib/Bachelor-Mess-Manager.git` |
| Credentials | `- none -` if public, otherwise `github-creds` from Step 4 |
| Branch Specifier | `*/develop` |
| Script Path | `Jenkinsfile.free-tier` |

   **Script Path matters.** The repo contains both `Jenkinsfile` and `Jenkinsfile.free-tier`.
   The default value is `Jenkinsfile`, which is the wrong one for this server — you must change
   it to `Jenkinsfile.free-tier`.

6. Click **Save**.

If the Repository URL is wrong or the credentials are missing, Jenkins shows a red error
directly under the URL field straight away. That is the fastest way to catch a typo.

---

## Step 6 — Point GitHub at Jenkins

Go to <https://github.com/saidul-islam-rajib/Bachelor-Mess-Manager/settings/hooks> and click
**Add webhook**.

| Field | Value |
| --- | --- |
| Payload URL | `http://16.171.254.209:8080/github-webhook/` |
| Content type | `application/json` |
| Secret | leave empty |
| Events | **Just the push event** |
| Active | ☑ |

The **trailing slash** on `/github-webhook/` is required. Without it GitHub gets a 404 and
nothing ever triggers.

Click **Add webhook**. GitHub immediately sends a test ping. Refresh the page — a green tick
next to the hook means Jenkins received it. A red exclamation mark means it did not; click the
hook and open **Recent Deliveries** to see the actual response.

---

## Step 7 — Run the first build

Do not wait for a push the first time. Trigger it manually so you can watch it:

**<http://16.171.254.209:8080/job/bachelor-point/>** → **Build Now** in the left sidebar.

The build appears in **Build History** at the bottom left. Click the build number, then
**Console Output** to watch it live.

Once that works, test the automatic path:

```bash
git checkout develop
git merge feature/authentication_update
git push origin develop
```

A build should start within a few seconds.

---

## ⚠️ Known blocker: the quota deadlock

**The Blue-green deploy stage will currently hang.** This is a real, unresolved problem — fix it
before your first build or the pipeline will stall.

The namespace has a ResourceQuota capping `limits.cpu` at `2` (2000m). Right now:

| Pod | CPU limit |
| --- | --- |
| blue | 800m |
| green | 800m |
| caddy | 300m |
| **total** | **1900m** |

The deployments use `maxSurge: 1`, meaning a rolling update creates a *new* pod before removing
the old one — needing another 800m. 1900 + 800 exceeds 2000, so Kubernetes refuses to create
the pod. The rollout reports success, then silently never progresses.

The cause is drift: `k8s/free-tier/patch-resources.yaml` declares green as `replicas: 0`, but
green is running. Green is the standby colour — `bachelor-point-active` selects `color: blue`,
so green serves no users. Restore the declared state:

```bash
ssh -i bachelor-point-key.pem ubuntu@54.251.180.71
sudo k3s kubectl -n bachelor-point scale deployment/bachelor-point-green --replicas=0
```

To confirm nothing is stuck afterwards:

```bash
sudo k3s kubectl -n bachelor-point get rs
```

Any ReplicaSet showing `DESIRED 1 / CURRENT 0` is still blocked.

---

## Verify the SSH path before the first build

From the **Jenkins** machine, not your laptop:

```bash
ssh -i /path/to/bachelor-point-key.pem ubuntu@54.251.180.71 'sudo k3s kubectl get nodes'
```

Expect:

```
bachelor-point-node   Ready   control-plane
```

If this times out, Step 0 was not applied. If it says `Permission denied (publickey)`, the key
is wrong or truncated.

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

The quality gate runs on Jenkins. Everything from "Ship source" onward runs on the k3s server
over SSH.

---

## Configuration the pipeline does not manage

Deploys apply `k8s/free-tier/`, which includes the ConfigMap but **not** the Secret. Values in
`bachelor-point-secrets` — including all `SMTP_*` keys — survive deploys untouched. They are set
by hand:

```bash
sudo k3s kubectl -n bachelor-point patch secret bachelor-point-secrets -p '{"stringData":{
  "SMTP_HOST":"smtp.gmail.com"
}}'
```

ConfigMap values (`APP_NAME`, `APP_PUBLIC_URL`, …) **are** overwritten on every deploy by
whatever is in git. If you patch a ConfigMap by hand, change the git file too or the next build
reverts it.

See [EMAIL-SETUP.md](EMAIL-SETUP.md) for the SMTP values.

---

## Which CI/CD is actually in charge

There are three possible pipelines in this repo. **Only run one**, or every push deploys two or
three times and they race each other.

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
| `Connection timed out` | Jenkins IP not allowlisted | Step 0 — re-add `16.171.254.209/32` |
| `Permission denied (publickey)` | Key truncated, or username is not `ubuntu` | Re-paste the full 53-line key |
| `Could not find credentials entry with ID` | Credential ID typo | Must be exactly `ssh-key-ec2` and `server-ip` |
| `No such DSL method 'sshagent'` | SSH Agent plugin missing | Manage Jenkins → Plugins |
| `npm: command not found` | Node missing on the agent | Step 1 — install Node 20 |
| Wrong Jenkinsfile runs | Script Path left as default | Set it to `Jenkinsfile.free-tier` |
| Webhook not firing | Missing trailing slash, or Jenkins unreachable | GitHub → Settings → Hooks → Recent Deliveries |
| Deploy stage hangs forever | ResourceQuota deadlock | Scale green to 0 — see the blocker section |
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
| Credentials | <http://16.171.254.209:8080/manage/credentials/store/system/domain/_/> |
| New job | <http://16.171.254.209:8080/view/all/newJob> |
| Plugins | <http://16.171.254.209:8080/manage/pluginManager/installed> |
| **Live site** | <https://bachelor-point.team-sober.com> |
| Health | <https://bachelor-point.team-sober.com/api/health> |
| Repository | <https://github.com/saidul-islam-rajib/Bachelor-Mess-Manager> |
| Webhook settings | <https://github.com/saidul-islam-rajib/Bachelor-Mess-Manager/settings/hooks> |

> Jenkins is served over plain HTTP, so your login and any credentials you type into it cross
> the network unencrypted. Fine for a personal project on a known network; worth putting behind
> HTTPS before anyone else uses it.
