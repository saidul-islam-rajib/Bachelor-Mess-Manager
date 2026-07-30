#!/usr/bin/env bash
set -euo pipefail

TF_DIR="${TF_DIR:-terraform/free-tier}"
KEY="${TF_DIR}/bachelor-point-key.pem"

command -v terraform >/dev/null 2>&1 || { echo "terraform not found. See docs/RUNBOOK.md section 2." >&2; exit 1; }
[ -f "${TF_DIR}/terraform.tfstate" ] || { echo "No state at ${TF_DIR}/terraform.tfstate. Has terraform apply finished?" >&2; exit 1; }

tf() { terraform -chdir="$TF_DIR" output -raw "$1" 2>/dev/null || echo "(not available yet)"; }

IP="$(tf server_public_ip)"
REPO="$(git remote get-url origin 2>/dev/null | sed -E 's#.*[:/]([^/]+/[^/]+?)(\.git)?$#\1#')"

cat <<EOF

================================================================
  BACHELOR POINT - LIVE ENVIRONMENT
================================================================

URLS
  Site            http://${IP}.nip.io
  Admin panel     http://${IP}.nip.io/admin
  Health check    http://${IP}.nip.io/api/health
  CI/CD pipeline  https://github.com/${REPO}/actions
  GitHub secrets  https://github.com/${REPO}/settings/secrets/actions

APPLICATION LOGIN
  Email           $(tf admin_email)
  Password        $(tf admin_password)
                  ^ change this after first login

SERVER
  Public IP       ${IP}
  SSH             ssh -i ${KEY} ubuntu@${IP}
  Region          ap-southeast-1

DATABASE
  Endpoint        $(tf database_endpoint)
  Connection      $(tf database_url)
                  ^ reachable only from the EC2 box

SESSION KEY
  AUTH_SECRET     $(tf auth_secret)
                  ^ changing this logs out every user

GITHUB ACTIONS SECRETS - add these two at the URL above
  SERVER_IP         ${IP}
  SSH_PRIVATE_KEY   cat ${KEY}

KUBECTL
  scp -i ${KEY} ubuntu@${IP}:~/.kube/config ~/.kube/bachelor-point.yaml
  export KUBECONFIG=~/.kube/bachelor-point.yaml
  kubectl -n bachelor-point get pods

COST
  $(terraform -chdir="$TF_DIR" output -raw estimated_monthly_cost 2>/dev/null || echo "(not available yet)")

================================================================
  Never paste this output into a file that git tracks.
================================================================

EOF
