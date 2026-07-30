#!/usr/bin/env bash
set -euo pipefail

SERVER_IP="${1:-}"
SSH_KEY="${SSH_KEY:-terraform/free-tier/bachelor-point-key.pem}"
SSH_USER="${SSH_USER:-ubuntu}"
NAMESPACE="${NAMESPACE:-bachelor-point}"
APP="${APP:-bachelor-point}"
REMOTE_DIR="/home/${SSH_USER}/app"
TAG="${TAG:-$(git rev-parse --short=12 HEAD 2>/dev/null || date +%s)}"
IMAGE="${APP}:${TAG}"

log() { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
die() { printf '\n\033[1;31mERROR: %s\033[0m\n' "$*" >&2; exit 1; }

[ -n "$SERVER_IP" ] || die "Usage: $0 <server-ip>   (get it from: terraform -chdir=terraform/free-tier output -raw server_public_ip)"

SSH_OPTS=(-o StrictHostKeyChecking=accept-new -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR)
[ -f "$SSH_KEY" ] && SSH_OPTS+=(-i "$SSH_KEY")

remote() { ssh "${SSH_OPTS[@]}" "${SSH_USER}@${SERVER_IP}" "$@"; }

log "Checking the server is ready"
remote 'test -f /var/lib/bootstrap-complete' \
  || die "Server bootstrap has not finished. Watch it with: ssh ${SSH_USER}@${SERVER_IP} 'tail -f /var/log/bootstrap.log'"

log "Copying source to ${SERVER_IP}"
remote "mkdir -p ${REMOTE_DIR}"
tar --exclude=node_modules --exclude=.next --exclude=.git --exclude=terraform \
    --exclude=uploads --exclude='*.tfstate*' --exclude=.env \
    -czf - . | remote "tar -xzf - -C ${REMOTE_DIR}"

log "Building image ${IMAGE} on the server"
remote "cd ${REMOTE_DIR} && sudo docker build -t ${IMAGE} ."

log "Importing the image into k3s"
remote "sudo docker save ${IMAGE} | sudo k3s ctr images import -"

log "Applying manifests"
INGRESS_HOST="${INGRESS_HOST:-${SERVER_IP}.nip.io}"
remote "cd ${REMOTE_DIR} && sed -i 's|REPLACE_WITH_INGRESS_HOST|${INGRESS_HOST}|g' k8s/free-tier/ingress.yaml"
remote "cd ${REMOTE_DIR} && sudo k3s kubectl apply -k k8s/free-tier/"

log "Running database migrations"
remote "sudo k3s kubectl -n ${NAMESPACE} delete job ${APP}-migrate --ignore-not-found=true"
remote "cd ${REMOTE_DIR} && sed 's|REPLACE_IMAGE|docker.io/library/${IMAGE}|g; s|imagePullPolicy: IfNotPresent|imagePullPolicy: Never|g' k8s/base/migrate-job.yaml | sudo k3s kubectl apply -f -"
remote "sudo k3s kubectl -n ${NAMESPACE} wait --for=condition=complete job/${APP}-migrate --timeout=900s" \
  || { remote "sudo k3s kubectl -n ${NAMESPACE} logs job/${APP}-migrate --tail=50"; die "Migration failed"; }
remote "sudo k3s kubectl -n ${NAMESPACE} logs job/${APP}-migrate --tail=20"

log "Blue-green deploy"
remote "cd ${REMOTE_DIR} && chmod +x scripts/blue-green.sh && sudo KUBECTL='k3s kubectl' NAMESPACE=${NAMESPACE} APP=${APP} ./scripts/blue-green.sh deploy docker.io/library/${IMAGE}"

log "Done"
printf '\n  Application: http://%s\n  Admin email: see  terraform -chdir=terraform/free-tier output admin_email\n  Password:    terraform -chdir=terraform/free-tier output -raw admin_password\n\n' "$INGRESS_HOST"
