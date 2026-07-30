#!/bin/bash
set -euxo pipefail

exec > >(tee /var/log/bootstrap.log) 2>&1

echo "=== Bachelor Point k3s bootstrap ==="

export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y curl ca-certificates gnupg unzip jq apt-transport-https

echo "=== Creating a 2 GiB swapfile so k3s survives on 1 GiB of RAM ==="
if [ ! -f /swapfile ]; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
  sysctl -w vm.swappiness=20
  echo 'vm.swappiness=20' >> /etc/sysctl.conf
fi

echo "=== Installing Docker (image builds on the box) ==="
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" \
  > /etc/apt/sources.list.d/docker.list
apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
usermod -aG docker ubuntu
systemctl enable --now docker

echo "=== Installing k3s ==="
PUBLIC_IP="$(curl -s -H "X-aws-ec2-metadata-token: $(curl -s -X PUT http://169.254.169.254/latest/api/token -H 'X-aws-ec2-metadata-token-ttl-seconds: 60')" http://169.254.169.254/latest/meta-data/public-ipv4)"

curl -sfL https://get.k3s.io | INSTALL_K3S_EXEC="server \
  --disable=metrics-server \
  --write-kubeconfig-mode=644 \
  --tls-san=$${PUBLIC_IP} \
  --node-name=bachelor-point-node" sh -

until kubectl get nodes 2>/dev/null | grep -q ' Ready '; do
  echo "waiting for k3s to become ready..."
  sleep 5
done

echo "=== Making kubectl work for the ubuntu user ==="
mkdir -p /home/ubuntu/.kube
cp /etc/rancher/k3s/k3s.yaml /home/ubuntu/.kube/config
sed -i "s/127.0.0.1/$${PUBLIC_IP}/g" /home/ubuntu/.kube/config
chown -R ubuntu:ubuntu /home/ubuntu/.kube
chmod 600 /home/ubuntu/.kube/config

echo 'export KUBECONFIG=/home/ubuntu/.kube/config' >> /home/ubuntu/.bashrc

echo "=== Creating the namespace, config and secret ==="
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml

kubectl create namespace ${app_name} --dry-run=client -o yaml | kubectl apply -f -

kubectl -n ${app_name} create secret generic ${app_name}-secrets \
  --from-literal=DATABASE_URL='${database_url}' \
  --from-literal=AUTH_SECRET='${auth_secret}' \
  --from-literal=ADMIN_EMAIL='${admin_email}' \
  --from-literal=ADMIN_PASSWORD='${admin_password}' \
  --from-literal=ADMIN_NAME='Administrator' \
  --dry-run=client -o yaml | kubectl apply -f -

echo "=== Waiting for Traefik (k3s built-in ingress) ==="
until kubectl -n kube-system get deploy traefik >/dev/null 2>&1; do sleep 5; done
kubectl -n kube-system rollout status deploy/traefik --timeout=300s || true

echo "=== Bootstrap complete ==="
echo "Public IP: $${PUBLIC_IP}"
touch /var/lib/bootstrap-complete
