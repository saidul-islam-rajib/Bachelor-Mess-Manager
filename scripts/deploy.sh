#!/usr/bin/env bash
set -euo pipefail

KUBECTL="${KUBECTL:-k3s kubectl}"
NAMESPACE="${NAMESPACE:-bachelor-point}"
APP="${APP:-bachelor-point}"
OVERLAY="${OVERLAY:-k8s/free-tier}"
REPO_DIR="${REPO_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"

log()  { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m  ! %s\033[0m\n' "$*"; }
die()  { printf '\n\033[1;31mERROR: %s\033[0m\n' "$*" >&2; exit 1; }

kc() { sudo $KUBECTL -n "$NAMESPACE" "$@"; }

command -v docker >/dev/null || die "docker is not installed"
cd "$REPO_DIR"

if [ "${1:-}" = "--rollback" ]; then
  log "Rolling back to the previous colour"
  sudo KUBECTL="$KUBECTL" NAMESPACE="$NAMESPACE" APP="$APP" ./scripts/blue-green.sh rollback
  exit 0
fi

TAG="${DEPLOY_TAG:-$(git rev-parse --short=12 HEAD 2>/dev/null || date +%Y%m%d%H%M%S)}"
IMAGE="${APP}:${TAG}"
FULL_IMAGE="docker.io/library/${IMAGE}"

log "Building ${IMAGE}"
sudo docker build -t "$IMAGE" .

log "Importing into k3s containerd"
sudo docker save "$IMAGE" | sudo k3s ctr images import -

log "Applying manifests from ${OVERLAY}"
sudo $KUBECTL kustomize "$OVERLAY" | sed "s|REPLACE_IMAGE|${FULL_IMAGE}|g" | sudo $KUBECTL apply -f -

log "Running database migrations"
kc delete job "${APP}-migrate" --ignore-not-found=true
sed "s|REPLACE_IMAGE|${FULL_IMAGE}|g" k8s/base/migrate-job.yaml | sudo $KUBECTL apply -f -
if ! kc wait --for=condition=complete "job/${APP}-migrate" --timeout=900s; then
  kc logs "job/${APP}-migrate" --tail=50 || true
  die "migration job failed"
fi
kc logs "job/${APP}-migrate" --tail=20 || true

log "Deploying to the idle colour"
sudo KUBECTL="$KUBECTL" NAMESPACE="$NAMESPACE" APP="$APP" ./scripts/blue-green.sh deploy "$FULL_IMAGE"

log "Switching live traffic"
sudo KUBECTL="$KUBECTL" NAMESPACE="$NAMESPACE" APP="$APP" ./scripts/blue-green.sh switch

log "Scaling down the idle colour"
sudo KUBECTL="$KUBECTL" NAMESPACE="$NAMESPACE" APP="$APP" ./scripts/blue-green.sh scale-down-idle

log "Deployed ${IMAGE}"
kc get pods --no-headers
