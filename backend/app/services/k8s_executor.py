"""Kubernetes execution adapter — turns AI scheduler decisions into real API calls.

This is the concept note's "orchestrator-native execution": the AI scheduler's
capacity target drives the replica count of a real `arenaflow-gameserver`
Deployment through the Kubernetes API, so a judge can `kubectl get pods -w` and
watch the forecast scale real infrastructure.

Opt-in via `K8S_ENABLED=1`. The whole adapter is defensive — if the kubernetes
client is missing, no cluster is reachable, or any call fails, it sets `ok=False`
and no-ops, so the pure-simulation demo never breaks (mirrors engine._load_models).

The kind cluster is a *scaled-down proportional mirror* of the 64-node simulated
fleet: `config.replicas_for(cap_ai)` maps simulated capacity (8..64) onto real
pods (1..K8S_MAX_REPLICAS), since a laptop can't run 64 pods.
"""
from __future__ import annotations

from app import config as C


class K8sExecutor:
    """Best-effort bridge to a real cluster. Never raises into the tick loop."""

    def __init__(self):
        self.ok = False
        self.error: str | None = None
        self.context: str | None = None
        self._apps = None
        self._core = None
        self._desired = None          # last replica target we patched (rate-limit)
        self._cordoned: set[str] = set()

        try:
            from kubernetes import client, config as kube_config  # type: ignore

            # in-cluster first (backend running as a pod), else local kubeconfig
            try:
                kube_config.load_incluster_config()
                self.context = "in-cluster"
            except Exception:
                kube_config.load_kube_config()
                _, active = kube_config.list_kube_config_contexts()
                self.context = active["name"] if active else "default"

            self._apps = client.AppsV1Api()
            self._core = client.CoreV1Api()
            # a cheap call to confirm the API server is actually reachable
            self._core.get_api_resources()
            self.ok = True
        except Exception as e:  # ImportError, config, or connection failure
            self.error = f"{type(e).__name__}: {e}"
            self.ok = False

    # ------------------------------------------------------------------ workload
    def ensure_workload(self) -> None:
        """Create the namespace + gameserver Deployment if absent (idempotent)."""
        if not self.ok:
            return
        try:
            from kubernetes import client
            from kubernetes.client.rest import ApiException

            # namespace
            try:
                self._core.read_namespace(C.K8S_NAMESPACE)
            except ApiException as e:
                if e.status != 404:
                    raise
                self._core.create_namespace(
                    client.V1Namespace(metadata=client.V1ObjectMeta(name=C.K8S_NAMESPACE)))

            # deployment
            try:
                self._apps.read_namespaced_deployment(C.K8S_DEPLOYMENT, C.K8S_NAMESPACE)
            except ApiException as e:
                if e.status != 404:
                    raise
                self._apps.create_namespaced_deployment(
                    C.K8S_NAMESPACE, self._deployment_manifest())
        except Exception as e:
            self.error = f"ensure_workload: {type(e).__name__}: {e}"
            self.ok = False

    def _deployment_manifest(self):
        from kubernetes import client
        labels = {"app": C.K8S_DEPLOYMENT}
        return client.V1Deployment(
            metadata=client.V1ObjectMeta(name=C.K8S_DEPLOYMENT, labels=labels),
            spec=client.V1DeploymentSpec(
                replicas=1,
                selector=client.V1LabelSelector(match_labels=labels),
                template=client.V1PodTemplateSpec(
                    metadata=client.V1ObjectMeta(labels=labels),
                    spec=client.V1PodSpec(containers=[client.V1Container(
                        name="gameserver",
                        image="registry.k8s.io/pause:3.9",  # tiny placeholder pod
                    )]),
                ),
            ),
        )

    # ------------------------------------------------------------------ reconcile
    def reconcile(self, cap_ai: int, drain_labels: list[str] | None = None) -> None:
        """Scale the real Deployment to mirror AI capacity. Rate-limited to changes."""
        if not self.ok:
            return
        target = C.replicas_for(cap_ai)
        if target == self._desired:
            return  # no change — don't hammer the API every 1.6s tick
        try:
            self._apps.patch_namespaced_deployment_scale(
                C.K8S_DEPLOYMENT, C.K8S_NAMESPACE, {"spec": {"replicas": target}})
            self._desired = target
        except Exception as e:
            self.error = f"reconcile: {type(e).__name__}: {e}"
            self.ok = False

    # --------------------------------------------------------------------- state
    def cluster_state(self) -> dict:
        """Live cluster snapshot for GET /k8s and the dashboard proof panel."""
        state = {
            "enabled": True, "ok": self.ok, "context": self.context,
            "namespace": C.K8S_NAMESPACE, "deployment": C.K8S_DEPLOYMENT,
            "desired": self._desired, "ready": None, "pods": None,
            "nodes": None, "error": self.error,
        }
        if not self.ok:
            return state
        try:
            dep = self._apps.read_namespaced_deployment(C.K8S_DEPLOYMENT, C.K8S_NAMESPACE)
            state["desired"] = dep.spec.replicas
            state["ready"] = dep.status.ready_replicas or 0
            pods = self._core.list_namespaced_pod(
                C.K8S_NAMESPACE, label_selector=f"app={C.K8S_DEPLOYMENT}")
            state["pods"] = len(pods.items)
            state["nodes"] = len(self._core.list_node().items)
        except Exception as e:
            # a transient read blip is informational only — do NOT disable
            # execution (unlike reconcile/ensure_workload, which are fatal).
            state["error"] = f"cluster_state: {type(e).__name__}: {e}"
        return state


# helper mirroring engine._load_models: build one iff the flag is set
def maybe_create(enabled: bool) -> "K8sExecutor | None":
    return K8sExecutor() if enabled else None
