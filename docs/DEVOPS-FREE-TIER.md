# Free Tier Deployment Guide

Run **Bachelor Point** live on AWS for **$0/month** for 12 months, with real Kubernetes,
real blue-green deployment, and real CI/CD.

This is the guide to follow. [DEVOPS.md](DEVOPS.md) describes the bigger EKS setup — keep it
for later, but it costs ~$150/month and cannot be made free.

---

## 1. Why this is free, and EKS is not

| Resource | This guide | EKS guide |
| --- | --- | --- |
| Kubernetes control plane | **k3s on EC2 — $0** | EKS — **$73/mo, no free tier** |
| Outbound internet for nodes | Public subnet — **$0** | 2 NAT gateways — **~$70/mo** |
| Compute | t3.micro, 750 hrs free | 2 × t3.medium — ~$60/mo |
| Database | RDS SQL Server **Express** db.t3.micro — free | Same class, but paired with the above |
| Ingress | Traefik (ships with k3s) — $0 | ALB — free tier 12 months |
| Uploads | k3s local-path on EBS — free | EFS |
| **Total** | **$0** for 12 months | **~$150-250/mo** |

**k3s is certified Kubernetes.** `kubectl`, the manifests, and `blue-green.sh` are identical.
You are not learning a toy — you are learning the real thing on cheaper hardware.

### The honest trade-offs

| | Free tier (k3s) | EKS |
| --- | --- | --- |
| High availability | ❌ one node — it dies, site is down | ✅ multi-AZ |
| Node failure recovery | Manual | Automatic |
| Autoscaling | ❌ (metrics-server disabled to save RAM) | ✅ HPA |
| Blue-green | ✅ **identical** | ✅ |
| Rolling deploys, probes, secrets | ✅ identical | ✅ |
| Good for | Learning, portfolio, demo, small real usage | Production with real users |

---

## 2. Tear down the EKS attempt first

You have 66 half-created resources billing you right now.

```bash
cd terraform
terraform state push errored.tfstate
terraform state list                  # expect ~66 resources
terraform destroy                     # type: yes
```

Then confirm in the AWS console that these are gone — they are the expensive ones:

- **EKS → Clusters** — empty
- **VPC → NAT Gateways** — empty
- **EC2 → Instances** — no `bachelor-point-prod` nodes

If `terraform state push` fails, your S3 backend bucket is missing or in the wrong region.
Verify with `aws s3 ls s3://bachelor-point-tfstate-team-sober-2026 --region ap-southeast-1`.
Without a working state file you must delete those resources by hand in the console.

---

## 3. What you need

```bash
aws --version          # AWS CLI v2
terraform --version    # >= 1.6
kubectl version --client
aws configure          # your keys, region ap-southeast-1
```

Docker is **not** needed locally — images are built on the server.

---

## 4. Deploy the infrastructure

```bash
cd terraform/free-tier
```

Lock down SSH and the Kubernetes API to your own IP first:

```bash
curl -s https://checkip.amazonaws.com     # note your IP
```

Create `terraform.tfvars`:

```hcl
allowed_admin_cidr = "YOUR.IP.ADDRESS.HERE/32"
admin_email        = "you@yourdomain.com"
# instance_type    = "t3.small"    # uncomment for 2 GB RAM at ~15 USD/month
```

Then:

```bash
terraform init
terraform plan
terraform apply       # type: yes
```

**Takes about 12 minutes** — most of it waiting for RDS.

> This root module uses **local state** (`terraform.tfstate` in this folder). No S3 bucket, no
> DynamoDB table, nothing that can fail like last time. It is git-ignored because it contains
> passwords. **Back it up** — without it Terraform cannot destroy what it built:
> `cp terraform.tfstate ~/bachelor-point-tfstate-backup`

### What gets created

VPC with two public subnets · one EC2 t3.micro running k3s + Docker · RDS SQL Server Express
db.t3.micro · Elastic IP · two security groups · an SSH keypair written to
`terraform/free-tier/bachelor-point-key.pem`.

The server bootstraps itself: 2 GB swapfile (so k3s fits in 1 GB RAM), Docker, k3s with
Traefik, then the namespace and the Kubernetes secret containing your database URL,
`AUTH_SECRET`, and admin credentials.

---

## 5. Deploy the application

```bash
cd ../..                                    # back to the project root

terraform -chdir=terraform/free-tier output -raw server_public_ip
./scripts/deploy-free-tier.sh <that-ip>
```

That one script copies the source up, builds the image on the server, imports it into k3s,
applies the manifests, runs migrations, and does a blue-green deploy with a smoke test.

**First run takes ~5 minutes** (npm install on a t3.micro is slow). Later runs are faster.

Then open the URL:

```bash
terraform -chdir=terraform/free-tier output -raw app_url
```

`nip.io` maps `<ip>.nip.io` to that IP for free — no domain needed.

Sign in with:

```bash
terraform -chdir=terraform/free-tier output admin_email
terraform -chdir=terraform/free-tier output -raw admin_password
```

**Change that password after first login.**

---

## 6. Drive the cluster from your laptop

```bash
scp -i terraform/free-tier/bachelor-point-key.pem \
  ubuntu@<ip>:~/.kube/config ~/.kube/bachelor-point.yaml

export KUBECONFIG=~/.kube/bachelor-point.yaml
kubectl get nodes
kubectl -n bachelor-point get pods
```

Now every command in [DEVOPS.md](DEVOPS.md) works unchanged.

---

## 7. Blue-green on k3s

Identical to EKS, because it is the same Kubernetes:

```bash
export KUBECONFIG=~/.kube/bachelor-point.yaml

./scripts/blue-green.sh status
./scripts/blue-green.sh rollback          # your panic button, ~1 second
./scripts/blue-green.sh scale-down-idle   # important on 1 GB RAM
```

> **On t3.micro, run `scale-down-idle` after every confirmed deploy.** Two colours × one pod
> each is about all 1 GB plus swap will hold. On t3.small you can leave both running, which is
> what makes rollback instant.

---

## 8. Auto-deploy on push to `develop`

Jenkins needs ~2 GB RAM — it cannot share the t3.micro. Two free options.

### Option A: Jenkins locally in Docker (what you asked for)

```bash
docker run -d --name jenkins -p 8080:8080 -v jenkins_home:/var/jenkins_home \
  -v /var/run/docker.sock:/var/run/docker.sock jenkins/jenkins:lts

docker exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword
```

Open <http://localhost:8080>, install suggested plugins, then:

1. Add credential `ssh-key-ec2` (SSH Username with private key, user `ubuntu`, the contents of
   `terraform/free-tier/bachelor-point-key.pem`)
2. Add credential `server-ip` (Secret text, your Elastic IP)
3. New Item → **Multibranch Pipeline** → your repo
4. Behaviours → *Filter by name (regular expression)* → `^develop$`
5. Script path: `Jenkinsfile.free-tier`

Because Jenkins is on your laptop, GitHub cannot reach it with a webhook. Set
**Scan Multibranch Pipeline Triggers → every 2 minutes** instead. Push to `develop`, wait up
to two minutes, and it deploys.

### Option B: GitHub Actions (genuinely zero-maintenance)

2,000 free minutes/month on private repos, unlimited on public. No server to run. If the goal
is a working pipeline rather than Jenkins specifically, this is the better free choice — tell
me and I will write the workflow.

---

## 9. Costs, and how to not get charged

| What | Free tier allowance | Watch out for |
| --- | --- | --- |
| EC2 t3.micro | 750 hrs/month, 12 months | One instance running 24/7 = 730 hrs. **A second instance breaks it.** |
| RDS db.t3.micro | 750 hrs/month + 20 GB, 12 months | Same — one instance only |
| EBS | 30 GB | Root volume is 30 GB. Snapshots count separately. |
| Elastic IP | Free **while attached** | **Detached EIPs are billed hourly.** Never leave one unattached. |
| Data transfer out | 100 GB/month | Fine for a demo |

Set a billing alarm — do this today:

**Billing → Budgets → Create budget → Zero spend budget** → email yourself. AWS will tell you
the moment anything costs money.

```bash
# check what is running
aws ec2 describe-instances --region ap-southeast-1 \
  --query 'Reservations[].Instances[?State.Name==`running`].[InstanceId,InstanceType]' --output table

aws rds describe-db-instances --region ap-southeast-1 \
  --query 'DBInstances[].[DBInstanceIdentifier,DBInstanceClass,DBInstanceStatus]' --output table
```

### After 12 months

Free tier expires and this becomes roughly $20/month (t3.micro ~$8, RDS ~$13). To stop
entirely: `terraform destroy` in `terraform/free-tier`.

---

## 10. Operating it

```bash
export KUBECONFIG=~/.kube/bachelor-point.yaml

kubectl -n bachelor-point get pods
kubectl -n bachelor-point logs -l app=bachelor-point --tail=100 -f
curl http://<ip>.nip.io/api/health

# on the server
ssh -i terraform/free-tier/bachelor-point-key.pem ubuntu@<ip>
sudo k3s kubectl get all -n bachelor-point
free -h                      # check RAM and swap
tail -f /var/log/bootstrap.log
```

### Redeploy after a code change

```bash
./scripts/deploy-free-tier.sh <ip>
```

---

## 11. Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| `deploy-free-tier.sh` says bootstrap has not finished | k3s still installing (~4 min) | `ssh ... 'tail -f /var/log/bootstrap.log'` |
| Pod `Pending`, "Insufficient memory" | t3.micro is full | `./scripts/blue-green.sh scale-down-idle`, or move to t3.small |
| Pod `0/1 READY` | Cannot reach RDS | RDS takes ~10 min to become available; check the DB security group |
| Build killed during `npm ci` | Out of RAM | The 2 GB swapfile should prevent this — confirm with `free -h` |
| `nip.io` does not resolve | Some ISPs block it | Use `curl -H 'Host: <ip>.nip.io' http://<ip>/` or buy a domain |
| SSH times out | `allowed_admin_cidr` does not match your IP | Your home IP changed — update `terraform.tfvars` and re-apply |
| Everything gone after a stop/start | You stopped the instance | The Elastic IP persists, but re-run the deploy script |

---

## 12. Adding HTTPS (optional, free)

`nip.io` works over plain HTTP. For real TLS you need a domain (~$10/year), then:

```bash
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.15.3/cert-manager.yaml
```

Add a `ClusterIssuer` for Let's Encrypt and annotate the Ingress. Ask me and I will write it.

Until then the app still sets `Secure` cookies only in production mode over HTTPS — over plain
HTTP on `nip.io` sessions work, but **do not put real personal data in this deployment until
TLS is on**.

---

## 13. Honest status

**Verified locally:** the Docker image builds and runs as non-root on port 8080, probes behave
correctly, both kustomize overlays build (free-tier 10 resources, production 16), all manifests
pass `kubeconform`, and every shell script passes syntax checks.

**Not verified:** `terraform apply` for this free-tier module, the k3s bootstrap on a real
EC2 box, and the deploy script end to end. I have no AWS account to test against. The
configuration follows standard patterns, but budget an hour for first-run fixes — section 11
covers the likely ones.

If something fails, send me the exact error and I will fix it.
