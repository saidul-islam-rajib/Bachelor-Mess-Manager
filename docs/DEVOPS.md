# DevOps Guide

Everything needed to run **Bachelor Point** in production on AWS, with Docker, Jenkins,
Kubernetes and blue-green deployment.

Read top to bottom the first time. Sections marked **YOU MUST DO THIS** are manual steps I
could not perform for you.

---

## 1. What the setup looks like

```
  git push -> develop
        |
        v
  +--------------+     build image      +---------+
  |   Jenkins    | ------------------>  |   ECR   |
  +--------------+                      +---------+
        |                                    |
        | 1. quality gate (typecheck/lint)   |
        | 2. build + scan image              |
        | 3. run migration Job               |
        | 4. deploy to the IDLE colour  <----+
        | 5. smoke test the idle colour
        | 6. flip the Service selector
        v
  +--------------------------------------------------+
  |                  EKS cluster                     |
  |                                                  |
  |   ALB (443) -> Ingress -> Service "active"       |
  |                              |                   |
  |                   +----------+----------+        |
  |                   v                     v        |
  |            Deployment BLUE       Deployment GREEN|
  |            (live)                (idle, ready)   |
  |                   \                     /        |
  |                    \                   /         |
  |                     v                 v          |
  |                   EFS (uploads)   RDS SQL Server |
  +--------------------------------------------------+
```

**Blue-green in one sentence:** two identical Deployments exist; the `active` Service points
at one of them; deploying means filling the idle one, testing it, then flipping a label
selector — an instant switch with an instant rollback.

---

## 2. Why port 8080 (you asked)

**Short answer: the port is invisible to your users, and 8080 is the container convention.
Never use 80.**

| Port | Verdict |
| --- | --- |
| 3000 | Next.js default. Works fine, but reads as "someone left the dev default in". |
| **8080** | **What we use.** The universal "HTTP alternate" port for containerised services. |
| 80 | **Do not.** Ports below 1024 are privileged — binding one needs root or `CAP_NET_BIND_SERVICE`. |

The important part is the last row. This container runs as **non-root** (`uid 1001`), which is
a hard requirement on hardened platforms like OpenShift and a baseline expectation everywhere
else. A non-root process cannot bind port 80 without granting it an extra Linux capability —
so "using port 80 because it's the real HTTP port" would actively *weaken* the container.

Nobody ever types this port. The chain is:

```
user -> https://yourdomain.com:443 -> ALB -> Service :80 -> Pod :8080
```

TLS terminates at the ALB. The container port is an internal detail.

To change it, set `PORT` in `k8s/base/configmap.yaml` and `containerPort` in both
deployment files. Nothing else depends on it.

---

## 3. Files I created

| Path | What it is |
| --- | --- |
| `Dockerfile` | Multi-stage build, non-root, ~390 MB, standalone Next.js output |
| `.dockerignore` | Keeps secrets and junk out of the build context |
| `docker-compose.yml` | Full local stack: SQL Server + migrations + app |
| `Jenkinsfile` | The whole CI/CD pipeline |
| `k8s/base/*.yaml` | Kubernetes manifests |
| `scripts/blue-green.sh` | Deploy, switch, rollback, status |
| `terraform/*.tf` | AWS infrastructure as code |

**Verified locally:** the image builds (390 MB), starts, serves `/auth/login` (200),
`/api/live` returns 200 with no database, and `/api/health` returns 500 when the database is
unreachable. That last pair is deliberate — see section 8.

---

## 4. Run it locally with Docker first

Do this before touching AWS. It proves the image works.

```bash
docker compose up -d --build
docker compose logs -f app
```

Open <http://localhost:8080>. Compose starts SQL Server, waits for it to be healthy, runs
migrations + role sync + admin creation, then starts the app.

```bash
docker compose down -v      # stop and delete the data volumes
```

---

## 5. AWS setup — **YOU MUST DO THIS**

### 5.1 Prerequisites

Install and configure locally:

```bash
aws --version          # AWS CLI v2
terraform --version    # >= 1.6
kubectl version --client
helm version

aws configure          # access key, secret, region ap-southeast-1
```

### 5.2 Terraform state backend (one time)

Terraform needs somewhere to keep its state. Create it by hand first:

```bash
aws s3api create-bucket \
  --bucket bachelor-point-tfstate-CHANGEME \
  --region ap-southeast-1 \
  --create-bucket-configuration LocationConstraint=ap-southeast-1

aws s3api put-bucket-versioning \
  --bucket bachelor-point-tfstate-CHANGEME \
  --versioning-configuration Status=Enabled

aws dynamodb create-table \
  --table-name bachelor-point-tflocks \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region ap-southeast-1
```

Then edit `terraform/versions.tf` and replace the two `REPLACE-...` values with those names.

### 5.3 Create the infrastructure

```bash
cd terraform
terraform init
terraform plan -out=tfplan
terraform apply tfplan
```

**This takes 20-30 minutes** (EKS is slow) and **costs real money** — roughly **$150-250/month**
for the default sizes: EKS control plane $73, 2 × t3.medium nodes ~$60, RDS db.t3.small ~$30,
NAT gateways ~$35, ALB ~$20, EFS a few dollars.

Cheaper for a demo: set `db_instance_class = "db.t3.micro"`, `node_desired_size = 1`, and
leave `environment = "dev"` so you get a single NAT gateway.

What it creates: VPC across 2 AZs, EKS cluster, managed node group, ECR repository,
RDS SQL Server Express, EFS for uploads, IAM roles for the ALB controller and EFS CSI driver,
and random passwords stored in Secrets Manager.

### 5.4 Connect kubectl

```bash
aws eks update-kubeconfig --region ap-southeast-1 --name bachelor-point-prod
kubectl get nodes
```

### 5.5 Install the two cluster add-ons

Terraform creates the IAM roles; Helm installs the controllers.

```bash
# AWS Load Balancer Controller (turns the Ingress into a real ALB)
helm repo add eks https://aws.github.io/eks-charts
helm repo update

kubectl create serviceaccount aws-load-balancer-controller -n kube-system
kubectl annotate serviceaccount aws-load-balancer-controller -n kube-system \
  eks.amazonaws.com/role-arn=$(terraform -chdir=terraform output -raw alb_controller_role_arn)

helm install aws-load-balancer-controller eks/aws-load-balancer-controller \
  -n kube-system \
  --set clusterName=bachelor-point-prod \
  --set serviceAccount.create=false \
  --set serviceAccount.name=aws-load-balancer-controller

# EFS CSI driver (shared uploads volume)
helm repo add aws-efs-csi-driver https://kubernetes-sigs.github.io/aws-efs-csi-driver/
helm repo update

helm install aws-efs-csi-driver aws-efs-csi-driver/aws-efs-csi-driver \
  -n kube-system \
  --set controller.serviceAccount.create=false \
  --set controller.serviceAccount.name=efs-csi-controller-sa

kubectl create serviceaccount efs-csi-controller-sa -n kube-system
kubectl annotate serviceaccount efs-csi-controller-sa -n kube-system \
  eks.amazonaws.com/role-arn=$(terraform -chdir=terraform output -raw efs_csi_role_arn)
```

### 5.6 TLS certificate

```bash
aws acm request-certificate \
  --domain-name yourdomain.com \
  --validation-method DNS \
  --region ap-southeast-1
```

Add the DNS validation record your registrar asks for, wait for status `ISSUED`, then note
the certificate ARN.

### 5.7 Fill in the placeholders

| File | Replace | With |
| --- | --- | --- |
| `k8s/production/uploads-pvc.yaml` | `REPLACE_WITH_EFS_FILESYSTEM_ID` | `terraform output efs_file_system_id` |
| `k8s/production/ingress.yaml` | `REPLACE_WITH_ACM_CERTIFICATE_ARN` | the ARN from 5.6 |
| `k8s/production/ingress.yaml` | `REPLACE_WITH_YOUR_DOMAIN` | your hostname |

### 5.8 Create the Kubernetes secret

**Never commit this.** `k8s/base/secret.example.yaml` is a template only.

```bash
kubectl create namespace bachelor-point

kubectl -n bachelor-point create secret generic bachelor-point-secrets \
  --from-literal=DATABASE_URL="$(terraform -chdir=terraform output -raw database_connection_string)" \
  --from-literal=AUTH_SECRET="$(terraform -chdir=terraform output -raw auth_secret)" \
  --from-literal=ADMIN_EMAIL="admin@yourdomain.com" \
  --from-literal=ADMIN_PASSWORD="a-long-admin-password" \
  --from-literal=ADMIN_NAME="Saidul Islam Rajib"
```

> **`AUTH_SECRET` must be identical for every pod and must never change casually.** It signs
> session cookies. Change it and every signed-in user is logged out instantly. Blue and green
> read the same Secret, which is what makes a colour switch invisible to users.

### 5.9 First deploy

```bash
kubectl apply -f k8s/base/namespace.yaml
kubectl apply -f k8s/base/configmap.yaml
kubectl apply -f k8s/production/uploads-pvc.yaml
kubectl apply -f k8s/base/deployment-blue.yaml
kubectl apply -f k8s/base/deployment-green.yaml
kubectl apply -f k8s/base/service.yaml
kubectl apply -f k8s/production/autoscaling.yaml
kubectl apply -f k8s/production/networkpolicy.yaml
kubectl apply -f k8s/production/ingress.yaml

# build and push the first image by hand
aws ecr get-login-password --region ap-southeast-1 \
  | docker login --username AWS --password-stdin $(terraform -chdir=terraform output -raw ecr_repository_url)

IMAGE=$(terraform -chdir=terraform output -raw ecr_repository_url):bootstrap
docker build -t $IMAGE .
docker push $IMAGE

# run migrations
sed "s|REPLACE_IMAGE|$IMAGE|g" k8s/base/migrate-job.yaml | kubectl apply -f -
kubectl -n bachelor-point wait --for=condition=complete job/bachelor-point-migrate --timeout=600s

# start blue
kubectl -n bachelor-point set image deployment/bachelor-point-blue app=$IMAGE
kubectl -n bachelor-point scale deployment/bachelor-point-blue --replicas=2
kubectl -n bachelor-point rollout status deployment/bachelor-point-blue
```

### 5.10 Point DNS at the ALB

```bash
kubectl -n bachelor-point get ingress bachelor-point
```

Create a CNAME (or Route 53 ALIAS) from your domain to that hostname. Your site is live.

---

## 6. Jenkins — **YOU MUST DO THIS**

### 6.1 Install

Any EC2 box with Docker will do:

```bash
sudo apt update && sudo apt install -y openjdk-17-jre docker.io
curl -fsSL https://pkg.jenkins.io/debian-stable/jenkins.io-2023.key \
  | sudo tee /usr/share/keyrings/jenkins-keyring.asc > /dev/null
echo "deb [signed-by=/usr/share/keyrings/jenkins-keyring.asc] https://pkg.jenkins.io/debian-stable binary/" \
  | sudo tee /etc/apt/sources.list.d/jenkins.list > /dev/null
sudo apt update && sudo apt install -y jenkins
sudo usermod -aG docker jenkins && sudo systemctl restart jenkins
```

Also install on the agent: `aws` CLI v2, `kubectl`, `node 20`, and optionally `trivy`.

### 6.2 Plugins

Git, Pipeline, Docker Pipeline, AWS Credentials, Timestamper, AnsiColor, GitHub Integration.

### 6.3 Credentials

Manage Jenkins → Credentials:

| ID | Type | Value |
| --- | --- | --- |
| `aws-account-id` | Secret text | Your 12-digit AWS account ID |
| `aws-credentials` | AWS Credentials | Access key + secret for the deploy user |
| `github-ssh` | SSH key | Deploy key for the repository |

The Jenkins IAM user needs: `AmazonEC2ContainerRegistryPowerUser`, plus `eks:DescribeCluster`
and a Kubernetes RBAC binding. Map the IAM user into the cluster:

```bash
eksctl create iamidentitymapping \
  --cluster bachelor-point-prod \
  --arn arn:aws:iam::ACCOUNT_ID:user/jenkins-deploy \
  --group system:masters \
  --username jenkins
```

> `system:masters` is cluster-admin. Fine to start; tighten to a scoped Role later.

### 6.4 Auto-deploy on push to `develop`

1. New Item → **Multibranch Pipeline** → name it `bachelor-point`
2. Branch source: your GitHub repo, credentials `github-ssh`
3. Behaviours → **Filter by name (with regular expression)** → `^develop$`
4. Build Configuration → by Jenkinsfile → `Jenkinsfile`
5. Scan Multibranch Pipeline Triggers → every 1 minute (or use a webhook, below)

**Webhook (instant, preferred over polling):** GitHub repo → Settings → Webhooks → Add:

- Payload URL: `http://YOUR_JENKINS/github-webhook/`
- Content type: `application/json`
- Events: **Just the push event**

Now every push to `develop` deploys automatically.

> Adjust `AWS_REGION`, `EKS_CLUSTER` and `ECR_REPOSITORY` at the top of the `Jenkinsfile` if
> you changed the Terraform defaults.

---

## 7. Blue-green: how to actually use it

```bash
./scripts/blue-green.sh status                  # which colour is live?
./scripts/blue-green.sh deploy <image>          # full deploy + smoke test + switch
./scripts/blue-green.sh switch                  # flip without deploying
./scripts/blue-green.sh rollback                # flip back — this is your panic button
./scripts/blue-green.sh scale-down-idle         # free resources once you are happy
```

`deploy` does: point idle at the new image → scale it up → wait for ready → curl
`/api/health` through the preview Service → only then flip the live selector.

**If anything fails before the flip, live traffic never moved.**

### Rollback

```bash
./scripts/blue-green.sh rollback
```

Takes about a second — it only edits a label selector. The old pods are still running, which
is the whole point of blue-green. Do not run `scale-down-idle` until you are confident.

### The one rule you must follow

**Database migrations must be backward compatible.** During a deploy, old and new pods run at
the same time against one database. So:

- Adding a nullable column, a table, or an index — safe.
- Dropping or renaming a column the old version still reads — **breaks the old pods**.

For a rename, use expand/contract across two releases:

1. Release 1: add the new column, write to both, read from the old.
2. Release 2: read from the new column.
3. Release 3: drop the old column.

---

## 8. Health probes, and why there are two

| Probe | Endpoint | Touches the DB? | If it fails |
| --- | --- | --- | --- |
| Liveness | `/api/live` | **No** | Pod is **restarted** |
| Readiness | `/api/health` | **Yes** | Pod stops receiving traffic, keeps running |

This split matters. If liveness hit the database, a 30-second RDS blip would restart every pod
at once — turning a brief outage into a full crashloop. Instead, a database problem makes pods
*unready* (they leave the load balancer) and they recover on their own when the database does.

`/api/health` also reports startup state, which is where the removed console logging went:

```json
{
  "status": "ok",
  "bootstrap": {
    "completedAt": "2026-07-30T12:00:00.000Z",
    "roles": 3, "permissions": 35,
    "administrator": "exists",
    "error": null
  }
}
```

---

## 9. Things about *this* application you must know

### 9.1 Uploads need shared storage — handled, but understand it

Profile photos are written to `UPLOAD_DIR` on local disk. With more than one pod, a photo
uploaded to pod A is a 404 on pod B, and it vanishes on restart.

**Solved here with EFS**, mounted `ReadWriteMany` so every pod in both colours shares one
directory (`k8s/production/uploads-pvc.yaml`, `reclaimPolicy: Retain`).

EFS is slower and pricier than object storage. The better long-term fix is S3 + CloudFront.
Only two functions touch storage — `saveProfileImage` and `readProfileImage` in
`src/lib/uploads.ts` — so swapping them is a contained change.

### 9.2 Rate limiting is per-pod

`src/lib/rate-limit.ts` counts in memory. With 4 pods, an IP effectively gets 4× the limit.

**The account lockout is not affected** — it is database-backed (`LoginAttempt`) and works
correctly across every pod. That is the control that actually stops password guessing.

To make IP limiting exact, back it with Redis (ElastiCache). The call sites do not change.

### 9.3 Sessions are stateless

HMAC-signed cookies, no server-side session store. Any pod can serve any user, which is why
blue-green switching does not log anyone out — **as long as `AUTH_SECRET` is identical**.

### 9.4 The admin is created automatically

On the first request each pod handles, `bootstrapApplication()` syncs roles/permissions and
creates the administrator from `ADMIN_EMAIL`/`ADMIN_PASSWORD` if none exists. Idempotent and
race-safe. The migration Job also runs it, so it is done before any pod starts.

### 9.5 Never seed production

`npm run seed:db` refuses to run when `NODE_ENV=production` unless `SEED_ENABLED=true`.
The ConfigMap sets `SEED_ENABLED: "false"`. Leave it.

---

## 10. Operating it

```bash
# what is going on
kubectl -n bachelor-point get pods -o wide
kubectl -n bachelor-point logs -l app=bachelor-point --tail=100 -f
kubectl -n bachelor-point describe pod <pod>

# is it healthy
curl https://yourdomain.com/api/health

# scale
kubectl -n bachelor-point scale deployment/bachelor-point-blue --replicas=4

# shell into a pod
kubectl -n bachelor-point exec -it <pod> -- sh

# re-run migrations by hand
kubectl -n bachelor-point delete job bachelor-point-migrate --ignore-not-found
sed "s|REPLACE_IMAGE|<image>|g" k8s/base/migrate-job.yaml | kubectl apply -f -
```

### Database backups

RDS keeps 7 days of automated backups (`db_backup_retention_days`). Take a manual snapshot
before anything risky:

```bash
aws rds create-db-snapshot \
  --db-instance-identifier bachelor-point-prod-sqlserver \
  --db-snapshot-identifier before-release-$(date +%Y%m%d)
```

---

## 11. Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Pods `CrashLoopBackOff` | Bad `DATABASE_URL`, or `AUTH_SECRET` under 32 chars | `kubectl logs`; check the Secret |
| Pods `Running` but `0/1 READY` | Readiness failing — cannot reach RDS | Check the DB security group allows 1433 from the node SG |
| Ingress has no ADDRESS | ALB controller not installed or IAM missing | `kubectl -n kube-system logs deploy/aws-load-balancer-controller` |
| PVC stuck `Pending` | EFS CSI driver missing, or wrong filesystem ID | `kubectl describe pvc bachelor-point-uploads` |
| Migration Job fails | Migration is not backward compatible, or DB unreachable | `kubectl logs job/bachelor-point-migrate` |
| Everyone logged out after deploy | `AUTH_SECRET` differs between colours | Both read one Secret — check you did not recreate it |
| Avatars 404 on some page loads | EFS not mounted; pods using local disk | `kubectl describe pod` and confirm the volume mount |
| Jenkins `denied: not authorized` on push | ECR login expired or wrong account ID | Check the `aws-account-id` credential |

---

## 12. Honest status

**Built and verified locally:** Dockerfile (image builds, 390 MB, runs, probes behave
correctly), docker-compose stack, all Kubernetes manifests, blue-green script (syntax checked),
Jenkinsfile, Terraform.

**Not verified, because it needs a real AWS account:** Terraform apply, the EKS deployment, the
Jenkins pipeline end to end, and the ALB/DNS wiring. The manifests and Terraform are written to
standard patterns but have not been run against live AWS. Expect to fix one or two small
things — version pins, an IAM permission — on the first apply. Section 11 covers the usual
suspects.

**Deliberately not included:** monitoring (Prometheus/Grafana or CloudWatch Container
Insights), centralised logging (Loki or CloudWatch Logs), and an automated test suite in the
pipeline. All three are worth adding before you carry real users; say the word and I will.
