# ArenaFlowCluster — one-command kind cluster setup (Windows / PowerShell).
#
#   powershell -ExecutionPolicy Bypass -File k8s\setup.ps1
#
# Installs the kind binary if missing, creates the cluster, applies the RBAC +
# workload manifests, and prints how to run the backend against it. Idempotent:
# re-running is safe. Requires Docker Desktop running and kubectl on PATH.
$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "== ArenaFlowCluster kind setup ==" -ForegroundColor Cyan

# 1. ensure kind is installed
if (-not (Get-Command kind -ErrorAction SilentlyContinue)) {
    Write-Host "kind not found - downloading binary..." -ForegroundColor Yellow
    $dest = Join-Path $env:USERPROFILE ".arenaflow-bin"
    New-Item -ItemType Directory -Force -Path $dest | Out-Null
    $kindExe = Join-Path $dest "kind.exe"
    curl.exe -Lo $kindExe "https://kind.sigs.k8s.io/dl/v0.23.0/kind-windows-amd64"
    $env:PATH = "$dest;$env:PATH"
    Write-Host "kind installed to $kindExe (added to PATH for this session)." -ForegroundColor Green
    Write-Host "  Add $dest to your PATH permanently to keep it." -ForegroundColor DarkGray
}

# 2. create the cluster (skip if it already exists)
$existing = kind get clusters 2>$null
if ($existing -contains "arenaflow") {
    Write-Host "cluster 'arenaflow' already exists - skipping create." -ForegroundColor DarkGray
} else {
    Write-Host "creating kind cluster 'arenaflow' (pulls ~1GB node image on first run)..." -ForegroundColor Yellow
    kind create cluster --name arenaflow --config (Join-Path $here "kind-cluster.yaml")
}

# 3. apply manifests (namespace first, then the rest)
Write-Host "applying manifests..." -ForegroundColor Yellow
kubectl apply -f (Join-Path $here "namespace.yaml")
kubectl apply -f (Join-Path $here "rbac.yaml")
kubectl apply -f (Join-Path $here "gameserver-deployment.yaml")

Write-Host ""
Write-Host "== ready ==" -ForegroundColor Green
Write-Host "1) start the backend against this cluster:" -ForegroundColor Cyan
Write-Host '     $env:K8S_ENABLED="1"; python backend\wsgi.py' -ForegroundColor White
Write-Host "2) watch the AI scale real pods as demand cycles:" -ForegroundColor Cyan
Write-Host "     kubectl get pods -n arenaflow -w" -ForegroundColor White
Write-Host "3) confirm least-privilege RBAC:" -ForegroundColor Cyan
Write-Host "     kubectl auth can-i patch deployments/scale -n arenaflow --as=system:serviceaccount:arenaflow:arenaflow-scheduler" -ForegroundColor White
Write-Host "     kubectl auth can-i delete pods -n arenaflow --as=system:serviceaccount:arenaflow:arenaflow-scheduler   # -> no" -ForegroundColor White
Write-Host ""
Write-Host "teardown:  kind delete cluster --name arenaflow" -ForegroundColor DarkGray
