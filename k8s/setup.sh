#!/usr/bin/env bash
# ArenaFlowCluster — one-command kind cluster setup (macOS / Linux / Git Bash).
#
#   bash k8s/setup.sh
#
# Installs kind if missing, creates the cluster, applies RBAC + workload
# manifests, and prints how to run the backend against it. Idempotent.
# Requires Docker running and kubectl on PATH.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "== ArenaFlowCluster kind setup =="

# 1. ensure kind
if ! command -v kind >/dev/null 2>&1; then
  echo "kind not found - downloading binary..."
  DEST="$HOME/.arenaflow-bin"; mkdir -p "$DEST"
  OS="$(uname | tr '[:upper:]' '[:lower:]')"
  ARCH="$(uname -m)"; [ "$ARCH" = "x86_64" ] && ARCH="amd64"; [ "$ARCH" = "aarch64" ] && ARCH="arm64"
  curl -Lo "$DEST/kind" "https://kind.sigs.k8s.io/dl/v0.23.0/kind-${OS}-${ARCH}"
  chmod +x "$DEST/kind"; export PATH="$DEST:$PATH"
  echo "kind installed to $DEST/kind (add to PATH permanently to keep it)."
fi

# 2. create cluster (skip if present)
if kind get clusters 2>/dev/null | grep -qx "arenaflow"; then
  echo "cluster 'arenaflow' already exists - skipping create."
else
  echo "creating kind cluster 'arenaflow' (pulls ~1GB node image on first run)..."
  kind create cluster --name arenaflow --config "$HERE/kind-cluster.yaml"
fi

# 3. apply manifests
echo "applying manifests..."
kubectl apply -f "$HERE/namespace.yaml"
kubectl apply -f "$HERE/rbac.yaml"
kubectl apply -f "$HERE/gameserver-deployment.yaml"

cat <<'EOF'

== ready ==
1) start the backend against this cluster:
     K8S_ENABLED=1 python backend/app.py
2) watch the AI scale real pods as demand cycles:
     kubectl get pods -n arenaflow -w
3) confirm least-privilege RBAC:
     kubectl auth can-i patch deployments/scale -n arenaflow --as=system:serviceaccount:arenaflow:arenaflow-scheduler
     kubectl auth can-i delete pods -n arenaflow --as=system:serviceaccount:arenaflow:arenaflow-scheduler   # -> no

teardown:  kind delete cluster --name arenaflow
EOF
