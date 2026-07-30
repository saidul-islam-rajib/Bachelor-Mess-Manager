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
BUILD_TIMEOUT="${BUILD_TIMEOUT:-1800}"

log() { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
die() { printf '\n\033[1;31mERROR: %s\033[0m\n' "$*" >&2; exit 1; }

[ -n "$SERVER_IP" ] || die "Usage: $0 <server-ip>"

SSH_OPTS=(
  -o StrictHostKeyChecking=accept-new
  -o UserKnownHostsFile=/dev/null
  -o LogLevel=ERROR
  -o ServerAliveInterval=20
  -o ServerAliveCountMax=30
  -o ConnectTimeout=15
)
[ -f "$SSH_KEY" ] && SSH_OPTS+=(-i "$SSH_KEY")

remote() { ssh "${SSH_OPTS[@]}" "${SSH_USER}@${SERVER_IP}" "$@"; }

log "Checking the server"
remote 'test -f /var/lib/bootstrap-complete' \
  || die "Server bootstrap has not finished. Check: ssh ${SSH_USER}@${SERVER_IP} 'tail -f /var/log/bootstrap.log'"

log "Copying source to ${SERVER_IP}"
remote "mkdir -p ${REMOTE_DIR}"
tar --exclude=node_modules --exclude=.next --exclude=.git --exclude=terraform \
    --exclude=uploads --exclude='*.tfstate*' --exclude=.env --exclude=jenkins \
    -czf - . | remote "tar -xzf - -C ${REMOTE_DIR}"

log "Building ${IMAGE} on the server (detached, survives a dropped connection)"
remote "cd ${REMOTE_DIR} && rm -f /tmp/build.done && nohup sh -c '
  sudo docker build -t ${IMAGE} . > /tmp/build.log 2>&1
  echo \$? > /tmp/build.done
' > /dev/null 2>&1 &" || true

waited=0
while true; do
  if remote "test -f /tmp/build.done" 2>/dev/null; then break; fi
  waited=$((waited + 15))
  [ "$waited" -lt "$BUILD_TIMEOUT" ] || die "Build exceeded ${BUILD_TIMEOUT}s. Check: ssh ${SSH_USER}@${SERVER_IP} 'tail -50 /tmp/build.log'"
  printf '    building... %ss\n' "$waited"
  sleep 15
done

status="$(remote 'cat /tmp/build.done' 2>/dev/null || echo 1)"
if [ "$status" != "0" ]; then
  remote 'tail -30 /tmp/build.log' || true
  die "Docker build failed on the server."
fi
log "Build succeeded"

log "Importing the image into k3s"
remote "sudo docker save ${IMAGE} | sudo k3s ctr images import -" > /dev/null

log "Applying manifests"
remote "cd ${REMOTE_DIR} && sudo k3s kubectl apply -k k8s/free-tier/"

log "Running database migrations"
remote "sudo k3s kubectl -n ${NAMESPACE} delete job ${APP}-migrate --ignore-not-found=true --timeout=60s"
remote "cd ${REMOTE_DIR} && sed 's|REPLACE_IMAGE|docker.io/library/${IMAGE}|g' k8s/base/migrate-job.yaml | sudo k3s kubectl apply -f -"
remote "sudo k3s kubectl -n ${NAMESPACE} wait --for=condition=complete job/${APP}-migrate --timeout=900s" \
  || { remote "sudo k3s kubectl -n ${NAMESPACE} logs job/${APP}-migrate --tail=40" || true; die "Migration failed"; }
remote "sudo k3s kubectl -n ${NAMESPACE} logs job/${APP}-migrate --tail=15"

log "Blue-green deploy"
remote "cd ${REMOTE_DIR} && chmod +x scripts/blue-green.sh && sudo KUBECTL='k3s kubectl' NAMESPACE=${NAMESPACE} APP=${APP} ./scripts/blue-green.sh deploy docker.io/library/${IMAGE}"

log "Deployed"
printf '\n  Site:  http://%s.nip.io\n  Login: terraform -chdir=terraform/free-tier output admin_email\n\n' "$SERVER_IP"
