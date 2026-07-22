"""Turn raw simulated telemetry into supervised training tables.

Produces, for every (node, tick) with enough history and a valid look-ahead:
  X            feature matrix (rows aligned to FEATURE_NAMES)
  y_forecast   active_sessions HORIZON_TICKS ahead for that node
  y_anomaly    ground-truth 0/1 "is this node trending to failure now"
"""
from __future__ import annotations

import _sim_path  # noqa: F401  (side effect: puts simulator on sys.path)
from simulator import ClusterSimulator  # type: ignore
from nodes import ROSTER  # type: ignore

from features import WINDOW, HORIZON_TICKS, extract_features, to_vector


def build_supervised(ticks: int, scenario: str = "peak", seed: int | None = 7):
    """Run the simulator for `ticks` and assemble sliding-window samples."""
    sim = ClusterSimulator(scenario=scenario, seed=seed)

    # per-node rolling history of raw records, and the full session series for targets
    n_nodes = len(ROSTER)
    history: list[list[dict]] = [[] for _ in range(n_nodes)]
    sessions_series: list[list[int]] = [[] for _ in range(n_nodes)]
    failing_series: list[list[int]] = [[] for _ in range(n_nodes)]
    feat_rows: list[list[float]] = [[] for _ in range(n_nodes)]  # feature vector per tick (or None)
    tick_of_row: list[list[int]] = [[] for _ in range(n_nodes)]

    for _ in range(ticks):
        recs = sim.tick(with_truth=True)
        t = sim.t
        for i, rec in enumerate(recs):
            history[i].append(rec)
            if len(history[i]) > WINDOW:
                history[i].pop(0)
            sessions_series[i].append(rec["active_sessions"])
            failing_series[i].append(rec["_failing"])
            feats = extract_features(history[i], t)
            feat_rows[i].append(to_vector(feats))
            tick_of_row[i].append(t)

    X: list[list[float]] = []
    y_forecast: list[float] = []
    y_anomaly: list[int] = []
    for i in range(n_nodes):
        rows = feat_rows[i]
        sess = sessions_series[i]
        fail = failing_series[i]
        # need WINDOW ticks of warm-up and HORIZON ticks of look-ahead
        for k in range(WINDOW - 1, len(rows) - HORIZON_TICKS):
            X.append(rows[k])
            y_forecast.append(sess[k + HORIZON_TICKS])
            y_anomaly.append(fail[k])
    return X, y_forecast, y_anomaly
