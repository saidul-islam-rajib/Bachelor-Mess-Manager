#!/usr/bin/env bash
set -euo pipefail

NAMESPACE="${NAMESPACE:-bachelor-point}"
APP="${APP:-bachelor-point}"
ACTIVE_SVC="${APP}-active"
PREVIEW_SVC="${APP}-preview"
SMOKE_TIMEOUT="${SMOKE_TIMEOUT:-120}"
ROLLOUT_TIMEOUT="${ROLLOUT_TIMEOUT:-300s}"

log()  { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m  ! %s\033[0m\n' "$*"; }
die()  { printf '\n\033[1;31mERROR: %s\033[0m\n' "$*" >&2; exit 1; }

KUBECTL="${KUBECTL:-kubectl}"

kc() { $KUBECTL -n "$NAMESPACE" "$@"; }

active_color() {
  kc get service "$ACTIVE_SVC" -o jsonpath='{.spec.selector.color}' 2>/dev/null || echo ""
}

idle_color() {
  local active
  active="$(active_color)"
  if [ "$active" = "blue" ]; then echo "green"; else echo "blue"; fi
}

point_service_at() {
  local svc="$1" color="$2"
  kc patch service "$svc" -p "{\"spec\":{\"selector\":{\"app\":\"${APP}\",\"color\":\"${color}\"}}}" >/dev/null
}

smoke_test() {
  local color="$1"
  local pod deadline
  log "Smoke-testing the ${color} deployment through ${PREVIEW_SVC}"

  point_service_at "$PREVIEW_SVC" "$color"

  pod="$(kc run "smoke-$(date +%s)" --rm -i --restart=Never --image=curlimages/curl:8.10.1 --quiet -- \
    sh -c "curl -sS -o /dev/null -w '%{http_code}' --max-time 10 --retry 5 --retry-delay 3 --retry-connrefused http://${PREVIEW_SVC}.${NAMESPACE}.svc.cluster.local/api/health" 2>/dev/null || true)"

  if [ "$pod" != "200" ]; then
    die "Smoke test failed: /api/health returned '${pod}' (expected 200) on ${color}."
  fi

  log "Smoke test passed on ${color}"
}

cmd_status() {
  local active idle
  active="$(active_color)"
  idle="$(idle_color)"
  printf '\nNamespace : %s\n' "$NAMESPACE"
  printf 'Active    : %s  (serving live traffic)\n' "${active:-none}"
  printf 'Idle      : %s\n\n' "$idle"
  kc get deployment -l app="$APP" -o custom-columns=NAME:.metadata.name,READY:.status.readyReplicas,DESIRED:.spec.replicas,IMAGE:.spec.template.spec.containers[0].image
  printf '\n'
  kc get service "$ACTIVE_SVC" "$PREVIEW_SVC" -o custom-columns=SERVICE:.metadata.name,SELECTOR:.spec.selector.color 2>/dev/null || true
}

cmd_deploy() {
  local image="${1:-}"
  [ -n "$image" ] || die "Usage: $0 deploy <image>"

  local active idle
  active="$(active_color)"
  idle="$(idle_color)"

  [ -n "$active" ] || die "Service ${ACTIVE_SVC} not found. Apply k8s/base first."

  log "Active is ${active}. Deploying ${image} to ${idle}."

  kc set image "deployment/${APP}-${idle}" "app=${image}" --record >/dev/null

  local replicas
  replicas="$(kc get deployment "${APP}-${active}" -o jsonpath='{.spec.replicas}')"
  [ "${replicas:-0}" -gt 0 ] || replicas=2
  kc scale "deployment/${APP}-${idle}" --replicas="$replicas" >/dev/null

  log "Waiting for ${idle} to become ready (timeout ${ROLLOUT_TIMEOUT})"
  kc rollout status "deployment/${APP}-${idle}" --timeout="$ROLLOUT_TIMEOUT" \
    || die "Rollout of ${idle} failed. Live traffic is untouched on ${active}."

  smoke_test "$idle"

  log "Switching live traffic from ${active} to ${idle}"
  point_service_at "$ACTIVE_SVC" "$idle"
  point_service_at "$PREVIEW_SVC" "$active"

  log "Live traffic is now on ${idle}. Previous version (${active}) is still running for instant rollback."
  cmd_status
}

cmd_switch() {
  local active idle
  active="$(active_color)"
  idle="$(idle_color)"

  kc get deployment "${APP}-${idle}" >/dev/null 2>&1 || die "Deployment ${APP}-${idle} not found."

  local ready
  ready="$(kc get deployment "${APP}-${idle}" -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo 0)"
  [ "${ready:-0}" -gt 0 ] || die "${idle} has no ready pods. Refusing to switch."

  log "Switching live traffic from ${active} to ${idle}"
  point_service_at "$ACTIVE_SVC" "$idle"
  point_service_at "$PREVIEW_SVC" "$active"
  cmd_status
}

cmd_rollback() {
  local active previous
  active="$(active_color)"
  previous="$(idle_color)"

  local ready
  ready="$(kc get deployment "${APP}-${previous}" -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo 0)"
  [ "${ready:-0}" -gt 0 ] || die "Cannot roll back: ${previous} has no ready pods."

  warn "Rolling back: ${active} -> ${previous}"
  point_service_at "$ACTIVE_SVC" "$previous"
  point_service_at "$PREVIEW_SVC" "$active"
  log "Rolled back. Live traffic is on ${previous}."
  cmd_status
}

cmd_scale_down_idle() {
  local idle
  idle="$(idle_color)"
  log "Scaling idle deployment ${idle} to 0"
  kc scale "deployment/${APP}-${idle}" --replicas=0 >/dev/null
  cmd_status
}

usage() {
  cat <<'USAGE'
Blue-green deployment control

  ./scripts/blue-green.sh status              Show which color is live
  ./scripts/blue-green.sh deploy <image>      Full deploy: idle -> ready -> smoke test -> switch
  ./scripts/blue-green.sh switch              Flip traffic to the idle color (no deploy)
  ./scripts/blue-green.sh rollback            Flip traffic back to the previous color
  ./scripts/blue-green.sh scale-down-idle     Free resources once a release is confirmed good

Environment:
  NAMESPACE        default: bachelor-point
  ROLLOUT_TIMEOUT  default: 300s
  KUBECTL          default: kubectl   (use "k3s kubectl" on a k3s node)
USAGE
}

case "${1:-}" in
  status)          cmd_status ;;
  deploy)          shift; cmd_deploy "${1:-}" ;;
  switch)          cmd_switch ;;
  rollback)        cmd_rollback ;;
  scale-down-idle) cmd_scale_down_idle ;;
  *)               usage; exit 1 ;;
esac
