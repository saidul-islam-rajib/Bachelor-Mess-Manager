# Developer Runbook

Every command, URL, and credential you need. Written to be copy-pasteable.

> **On credentials:** this file contains **commands that print secrets**, never the secrets
> themselves. It is committed to git, and anything written here goes to GitHub forever.
> This is not paranoia — a state file with plaintext passwords was already committed to this
> repo once (`43dabce`). Run the commands; do not paste their output back into this file.

---

## 1. Where everything lives

| Thing | URL / location |
| --- | --- |
| **Live site** | `http://<SERVER_IP>.nip.io` |
| **CI/CD pipeline** | <https://github.com/saidul-islam-rajib/Bachelor-Mess-Manager/actions> |
| **Repository** | <https://github.com/saidul-islam-rajib/Bachelor-Mess-Manager> |
| **GitHub secrets** | Repo → Settings → Secrets and variables → Actions |
| **AWS console** | <https://ap-southeast-1.console.aws.amazon.com> (region **ap-southeast-1**) |
| **Health check** | `http://<SERVER_IP>.nip.io/api/health` |
| **Admin panel** | `http://<SERVER_IP>.nip.io/admin` |
| Infrastructure code | `terraform/free-tier/` |
| Kubernetes manifests | `k8s/base/` + `k8s/free-tier/` |
| Terraform state | `terraform/free-tier/terraform.tfstate` (**local, git-ignored, back it up**) |
| SSH key | `terraform/free-tier/bachelor-point-key.pem` (git-ignored) |

Get `<SERVER_IP>` with:

```bash
cd terraform/free-tier && terraform output -raw server_public_ip
```

---

## 2. Prerequisites (one time)

`terraform` and `aws` were installed by winget but never added to PATH. Shims now live in
`~/bin`, which Git Bash already searches:

```bash
terraform version      # Terraform v1.15.8
aws --version          # aws-cli/2.36.11
aws sts get-caller-identity
```

If `command not found` returns after a reinstall, recreate the shims:

```bash
mkdir -p ~/bin
printf '#!/usr/bin/env bash\nexec "/c/Users/Saidul islam rajib.BS-01696/AppData/Local/Microsoft/WinGet/Packages/Hashicorp.Terraform_Microsoft.Winget.Source_8wekyb3d8bbwe/terraform.exe" "$@"\n' > ~/bin/terraform
printf '#!/usr/bin/env bash\nexec "/c/Program Files/Amazon/AWSCLIV2/aws.exe" "$@"\n' > ~/bin/aws
chmod +x ~/bin/terraform ~/bin/aws
```

---

## 3. All credentials — how to read them

**Run every command from the project root** unless stated otherwise.

### Application admin login

```bash
terraform -chdir=terraform/free-tier output -raw admin_email
terraform -chdir=terraform/free-tier output -raw admin_password
```

Sign in at `http://<SERVER_IP>.nip.io/auth/login`. **Change the password after first login**
(Profile → Change password).

### Database connection string

```bash
terraform -chdir=terraform/free-tier output -raw database_url
terraform -chdir=terraform/free-tier output -raw database_endpoint
```

The database is in a private security group — reachable only from the EC2 box, never from your
laptop. To query it, SSH in first (section 6).

### Session signing key

```bash
terraform -chdir=terraform/free-tier output -raw auth_secret
```

Already injected into the Kubernetes secret. **Never change it casually** — every signed-in
user is logged out instantly.

### SSH private key

```bash
cat terraform/free-tier/bachelor-point-key.pem
```

### Everything at once

```bash
terraform -chdir=terraform/free-tier output
```

### What Kubernetes actually holds

```bash
export KUBECONFIG=~/.kube/bachelor-point.yaml
kubectl -n bachelor-point get secret bachelor-point-secrets -o jsonpath='{.data}' | jq 'map_values(@base64d)'
```

---

## 4. Make it live (first time)

### 4.1 Build the infrastructure

```bash
cd terraform/free-tier

curl -s https://checkip.amazonaws.com          # your public IP

cat > terraform.tfvars <<EOF
allowed_admin_cidr = "YOUR.IP.HERE/32"
admin_email        = "saidul.is.rajib@gmail.com"
instance_type      = "t3.micro"
EOF

terraform init
terraform apply          # ~15 minutes, RDS is the slow part
```

**Nothing is created by hand in the AWS console.** Terraform creates the VPC, subnets,
security groups, SSH keypair, RDS SQL Server Express, EC2 instance, and Elastic IP.

**Back up the state file immediately** — without it Terraform cannot destroy what it built:

```bash
cp terraform.tfstate ~/bachelor-point-tfstate-backup
```

### 4.2 Wait for the server to finish installing k3s

```bash
IP=$(terraform -chdir=terraform/free-tier output -raw server_public_ip)
ssh -i terraform/free-tier/bachelor-point-key.pem ubuntu@$IP 'tail -20 /var/log/bootstrap.log'
```

Wait until you see `Bootstrap complete` (about 4 minutes after the instance appears).

### 4.3 Deploy the application

```bash
cd /c/Users/Saidul\ islam\ rajib.BS-01696/Desktop/Mess     # project root
./scripts/deploy-free-tier.sh $(terraform -chdir=terraform/free-tier output -raw server_public_ip)
```

First run takes ~5 minutes (npm install on a t3.micro). **Your site is now live.**

```bash
terraform -chdir=terraform/free-tier output -raw app_url
```

---

## 5. Turn on auto-deploy from `develop`

### 5.1 Add the two GitHub secrets

Go to
<https://github.com/saidul-islam-rajib/Bachelor-Mess-Manager/settings/secrets/actions>
→ **New repository secret**:

| Secret name | How to get the value |
| --- | --- |
| `SERVER_IP` | `terraform -chdir=terraform/free-tier output -raw server_public_ip` |
| `SSH_PRIVATE_KEY` | `cat terraform/free-tier/bachelor-point-key.pem` (paste **everything**, including the BEGIN/END lines) |

### 5.2 Create and push `develop`

```bash
git checkout -b develop
git push -u origin develop
```

### 5.3 Watch it run

<https://github.com/saidul-islam-rajib/Bachelor-Mess-Manager/actions>

From now on **every push to `develop` deploys automatically**:

```
push to develop
   -> typecheck + lint
   -> build Docker image on your EC2 box
   -> import into k3s
   -> run database migrations
   -> deploy to the IDLE colour (blue or green)
   -> smoke test it
   -> flip live traffic
   -> verify /api/health
   -> scale the old colour down
   (any failure -> automatic rollback, live traffic never moves)
```

### 5.4 Normal day-to-day

```bash
git checkout develop
# ...make changes...
git add -A && git commit -m "your change"
git push
```

Then watch the Actions tab. That is the whole workflow.

---

## 6. Connecting to things

### kubectl from your laptop

```bash
IP=$(terraform -chdir=terraform/free-tier output -raw server_public_ip)
scp -i terraform/free-tier/bachelor-point-key.pem ubuntu@$IP:~/.kube/config ~/.kube/bachelor-point.yaml
export KUBECONFIG=~/.kube/bachelor-point.yaml
kubectl get nodes
kubectl -n bachelor-point get pods
```

Add `export KUBECONFIG=~/.kube/bachelor-point.yaml` to `~/.bashrc` to make it stick.

### SSH into the server

```bash
ssh -i terraform/free-tier/bachelor-point-key.pem ubuntu@$IP
```

On the box, `kubectl` needs no setup:

```bash
sudo k3s kubectl get all -n bachelor-point
free -h                 # RAM and swap
sudo docker images      # built images
```

### Query the database

SSH in first, then run a throwaway pod:

```bash
sudo k3s kubectl -n bachelor-point run sqlcli --rm -it --restart=Never \
  --image=mcr.microsoft.com/mssql-tools \
  --env="DB=$(sudo k3s kubectl -n bachelor-point get secret bachelor-point-secrets -o jsonpath='{.data.DATABASE_URL}' | base64 -d)" \
  -- bash
```

---

## 7. Images

Images are built **on the EC2 server** and imported straight into k3s. There is no registry —
that keeps you inside the free tier.

```bash
ssh -i terraform/free-tier/bachelor-point-key.pem ubuntu@$IP

sudo docker images | grep bachelor-point          # built images
sudo k3s ctr images ls | grep bachelor-point      # images k3s can run

# which image each colour is running
sudo k3s kubectl -n bachelor-point get deploy -o custom-columns=NAME:.metadata.name,IMAGE:.spec.template.spec.containers[0].image

# reclaim disk when it fills up
sudo docker image prune -a -f
```

Images are tagged with the git commit: `bachelor-point:a1b2c3d4e5f6`.

---

## 8. Blue-green deployment

```bash
export KUBECONFIG=~/.kube/bachelor-point.yaml

./scripts/blue-green.sh status              # which colour is live
./scripts/blue-green.sh rollback            # PANIC BUTTON - about 1 second
./scripts/blue-green.sh switch              # flip without deploying
./scripts/blue-green.sh scale-down-idle     # free RAM (important on t3.micro)
```

Or on the server:

```bash
cd ~/app && sudo KUBECTL='k3s kubectl' ./scripts/blue-green.sh status
```

**How it works:** two Deployments (`blue`, `green`) always exist. The `bachelor-point-active`
Service selects one by label. Deploying fills the idle one, tests it, then flips the selector.
Rollback flips it back — the old pods are still running, which is why it is instant.

> On t3.micro run `scale-down-idle` after each confirmed deploy. 1 GB RAM plus the 2 GB
> swapfile barely holds two colours.

---

## 9. Monitoring and logs

```bash
export KUBECONFIG=~/.kube/bachelor-point.yaml

kubectl -n bachelor-point get pods -o wide
kubectl -n bachelor-point logs -l app=bachelor-point --tail=100 -f
kubectl -n bachelor-point describe pod <pod-name>
kubectl -n bachelor-point get events --sort-by=.lastTimestamp | tail -20

curl http://$IP.nip.io/api/health     # app + database + startup state
curl http://$IP.nip.io/api/live       # process only, no database
```

`/api/health` is where startup information goes (the app writes nothing to stdout):

```json
{
  "status": "ok",
  "bootstrap": {
    "completedAt": "...", "roles": 3, "permissions": 35,
    "administrator": "exists", "error": null
  }
}
```

---

## 10. Cost control

```bash
# what is running right now
aws ec2 describe-instances --region ap-southeast-1 \
  --query 'Reservations[].Instances[?State.Name==`running`].[InstanceId,InstanceType]' --output table
aws rds describe-db-instances --region ap-southeast-1 \
  --query 'DBInstances[].[DBInstanceIdentifier,DBInstanceClass]' --output table

# these must always be ZERO or you are being charged
aws eks list-clusters --region ap-southeast-1 --query 'length(clusters)'
aws ec2 describe-nat-gateways --region ap-southeast-1 --filter Name=state,Values=available --query 'length(NatGateways)'
```

**Set a billing alarm today:** AWS Console → Billing → Budgets → Create budget →
**Zero spend budget** → your email.

| Free tier allowance (12 months) | Limit |
| --- | --- |
| EC2 t3.micro | 750 hrs/month — **one** instance 24/7 |
| RDS db.t3.micro + 20 GB | 750 hrs/month — **one** instance |
| EBS | 30 GB |
| Elastic IP | free **only while attached** — a detached one is billed |

### Shut everything down

```bash
cd terraform/free-tier
terraform destroy        # needs terraform.tfstate - back it up!
```

---

## 11. Troubleshooting

| Symptom | Fix |
| --- | --- |
| `terraform: command not found` | Recreate the shims (section 2) |
| `deploy-free-tier.sh` says bootstrap unfinished | `ssh ... 'tail -f /var/log/bootstrap.log'`, wait for `Bootstrap complete` |
| Pod `Pending`, insufficient memory | `./scripts/blue-green.sh scale-down-idle`, or move to `t3.small` |
| Pod `0/1 READY` | Cannot reach RDS — check it is `available` and the DB security group allows 1433 |
| SSH times out | Your home IP changed. Update `allowed_admin_cidr` in `terraform.tfvars`, `terraform apply` |
| GitHub Action fails at SSH | `SSH_PRIVATE_KEY` secret is wrong — must include BEGIN/END lines |
| `FreeTierRestrictionError` on RDS | Free Tier account plans cap backup retention at 1 day (already set) |
| Site loads but images 404 | Uploads live on the pod's volume; check the PVC is bound |
| Everyone logged out after deploy | `AUTH_SECRET` changed — it must stay constant |

### Emergency: site is down

```bash
export KUBECONFIG=~/.kube/bachelor-point.yaml
./scripts/blue-green.sh rollback      # first move, always
kubectl -n bachelor-point get pods
kubectl -n bachelor-point logs -l app=bachelor-point --tail=50
```

---

## 12. Security checklist

- [ ] `allowed_admin_cidr` is your IP, not `0.0.0.0/0`
- [ ] Admin password changed after first login
- [ ] `terraform.tfstate` backed up outside the repo, never committed
- [ ] `bachelor-point-key.pem` never committed
- [ ] Zero-spend billing alarm set
- [ ] `SEED_ENABLED` stays `false` in production
- [ ] **TLS before real data** — `nip.io` is HTTP only; see DEVOPS-FREE-TIER.md §12

> The site currently serves plain HTTP. Sessions work, but do not put real personal data on it
> until TLS is configured with a domain and cert-manager.

---

## 13. Reference

| Guide | Covers |
| --- | --- |
| [DEVOPS-FREE-TIER.md](DEVOPS-FREE-TIER.md) | The $0/month k3s setup in depth |
| [DEVOPS.md](DEVOPS.md) | The larger EKS setup, for when you outgrow this |
| [ACCOUNTS.md](ACCOUNTS.md) | Admin/supervisor/member accounts and login |
| [../README.md](../README.md) | The application itself |
