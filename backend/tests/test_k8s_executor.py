"""Unit tests for the Kubernetes execution adapter — no real cluster required.

`reconcile()` and `cluster_state()` never import the kubernetes package (only
`__init__`/`ensure_workload` do), so we construct an executor whose init fails
gracefully (kubernetes absent) and then inject fake API clients to drive the
scaling logic directly.
"""
from __future__ import annotations

import types

from app import config as C
from app.services import k8s_executor
from app.services.k8s_executor import K8sExecutor


# --------------------------------------------------------------- fake clients
class FakeApps:
    def __init__(self, replicas=1, ready=1):
        self.patches: list[int] = []
        self._replicas = replicas
        self._ready = ready

    def patch_namespaced_deployment_scale(self, name, ns, body):
        self._replicas = body["spec"]["replicas"]
        self.patches.append(self._replicas)

    def read_namespaced_deployment(self, name, ns):
        return types.SimpleNamespace(
            spec=types.SimpleNamespace(replicas=self._replicas),
            status=types.SimpleNamespace(ready_replicas=self._ready),
        )


class FakeCore:
    def __init__(self, pods=1, nodes=3):
        self._pods, self._nodes = pods, nodes

    def list_namespaced_pod(self, ns, label_selector=None):
        return types.SimpleNamespace(items=[object()] * self._pods)

    def list_node(self):
        return types.SimpleNamespace(items=[object()] * self._nodes)


def _wired(apps=None, core=None):
    """An executor with init bypassed and fake clients injected (ok=True)."""
    ex = K8sExecutor()          # init fails (no kubernetes) -> ok False
    ex._apps = apps or FakeApps()
    ex._core = core or FakeCore()
    ex.ok = True
    ex.error = None
    return ex


# ----------------------------------------------------------- replica mapping
def test_replica_mapping_scales_and_clamps():
    assert C.replicas_for(8) == 1
    assert C.replicas_for(32) == 4
    assert C.replicas_for(64) == 8
    assert C.replicas_for(0) == 1              # floor
    assert C.replicas_for(200) == C.K8S_MAX_REPLICAS  # cap


# --------------------------------------------------------------- reconcile
def test_reconcile_patches_target_replicas():
    apps = FakeApps()
    ex = _wired(apps=apps)
    ex.reconcile(64)                            # -> 8 replicas
    assert apps.patches == [8]


def test_reconcile_is_rate_limited_to_changes():
    apps = FakeApps()
    ex = _wired(apps=apps)
    ex.reconcile(64)          # 8
    ex.reconcile(60)          # still 8 (round(60/8)=8) -> no new patch
    ex.reconcile(32)          # 4 -> patch
    ex.reconcile(30)          # round(30/8)=4 -> no new patch
    assert apps.patches == [8, 4]


# --------------------------------------------------------------- cluster_state
def test_cluster_state_reports_live_counts():
    ex = _wired(apps=FakeApps(replicas=5, ready=4), core=FakeCore(pods=5, nodes=3))
    st = ex.cluster_state()
    assert st["enabled"] and st["ok"]
    assert st["desired"] == 5 and st["ready"] == 4
    assert st["pods"] == 5 and st["nodes"] == 3


def test_cluster_state_read_blip_does_not_disable_execution():
    class Flaky(FakeApps):
        def read_namespaced_deployment(self, name, ns):
            raise RuntimeError("transient")
    ex = _wired(apps=Flaky())
    st = ex.cluster_state()
    assert st["error"] and "transient" in st["error"]
    assert ex.ok is True                        # reads are informational only


# ----------------------------------------------------- graceful no-cluster path
def test_no_cluster_is_safe_noop():
    ex = K8sExecutor()                          # kubernetes absent / unreachable
    assert ex.ok is False
    # every call must be a safe no-op that never raises
    ex.ensure_workload()
    ex.reconcile(40)
    st = ex.cluster_state()
    assert st == {"enabled": True, "ok": False, "context": ex.context,
                  "namespace": C.K8S_NAMESPACE, "deployment": C.K8S_DEPLOYMENT,
                  "desired": None, "ready": None, "pods": None,
                  "nodes": None, "error": ex.error}


def test_maybe_create_flag_gate():
    assert k8s_executor.maybe_create(False) is None
    assert isinstance(k8s_executor.maybe_create(True), K8sExecutor)
