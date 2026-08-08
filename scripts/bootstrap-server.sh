#!/usr/bin/env bash
set -euo pipefail

log()  { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m  ! %s\033[0m\n' "$*"; }
die()  { printf '\n\033[1;31mERROR: %s\033[0m\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "run with sudo"

ARCH="$(uname -m)"
log "Bootstrapping $(. /etc/os-release && echo "$PRETTY_NAME") on ${ARCH}"

log "Installing base packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq ca-certificates curl gnupg iptables-persistent postgresql-client

log "Opening host firewall for HTTP/HTTPS"
if command -v netfilter-persistent >/dev/null; then
  iptables -I INPUT 1 -p tcp --dport 80  -j ACCEPT
  iptables -I INPUT 1 -p tcp --dport 443 -j ACCEPT
  iptables -D INPUT -j REJECT --reject-with icmp-host-prohibited 2>/dev/null || true
  netfilter-persistent save >/dev/null 2>&1 || true
fi

log "Installing Docker"
if ! command -v docker >/dev/null; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin
  usermod -aG docker "${SUDO_USER:-ubuntu}" || true
fi
docker --version

log "Installing k3s"
if ! command -v k3s >/dev/null; then
  curl -sfL https://get.k3s.io | INSTALL_K3S_EXEC="--disable traefik --write-kubeconfig-mode 644" sh -
fi
k3s --version

log "Waiting for k3s to become ready"
for i in $(seq 1 60); do
  if k3s kubectl get nodes 2>/dev/null | grep -q ' Ready '; then break; fi
  sleep 5
done
k3s kubectl get nodes

log "Adding swap so a small instance survives build spikes"
if ! swapon --show | grep -q .; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile >/dev/null
  swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi
free -h | head -3

log "Bootstrap complete"
echo "  docker:  $(docker --version)"
echo "  k3s:     $(k3s --version | head -1)"
echo "  arch:    ${ARCH}"
