"""Flask REST API for ArenaFlowCluster.

Serves the live engine snapshot to the dashboard. CORS is enabled for local
frontend dev. Endpoints:

  GET  /health                     engine status
  GET  /telemetry                  raw telemetry records (data contract)
  GET  /predictions                raw model-output records (data contract)
  GET  /decisions?mode=ai|static   scheduler decisions (data contract)
  GET  /summary                    top stat-bar aggregates
  GET  /matrix                     per-node display objects (8x8 grid)
  GET  /nodes/<node_id>            single-node detail + history + events
  GET  /forecast                   observed + predicted demand, region forecast
  GET  /comparison                 AI vs static cost / incidents / utilization
  GET  /alerts                     active health alerts
  POST /control                    { running?, mode?, scenario? }
"""
from __future__ import annotations

from flask import Flask, jsonify, request
from flask_cors import CORS

from engine import ENGINE
from state import STORE

app = Flask(__name__)
CORS(app)

# contract field sets
TELEMETRY_FIELDS = ("node_id", "timestamp", "cpu_pct", "mem_pct", "active_sessions", "latency_ms")
PREDICTION_FIELDS = ("node_id", "timestamp", "forecast_sessions_next_5min",
                     "failure_risk_score", "status")


def snap():
    return STORE.get()


@app.get("/health")
def health():
    s = snap()
    return jsonify({
        "ok": True, "ready": s.get("ready", False), "tick": s.get("tick", 0),
        "mode": s.get("mode"), "scenario": s.get("scenario"),
        "running": s.get("running"), "model_mode": s.get("model_mode"),
    })


@app.get("/telemetry")
def telemetry():
    s = snap()
    recs = [{k: n[k] for k in TELEMETRY_FIELDS} for n in s.get("nodes", [])]
    return jsonify(recs)


@app.get("/predictions")
def predictions():
    s = snap()
    ts = s.get("timestamp")
    recs = [{"node_id": n["node_id"], "timestamp": ts,
             "forecast_sessions_next_5min": n["forecast_sessions_next_5min"],
             "failure_risk_score": n["failure_risk_score"],
             "status": "degrading" if n["failure_risk_score"] >= 0.4 else "healthy"}
            for n in s.get("nodes", [])]
    return jsonify(recs)


@app.get("/decisions")
def decisions():
    mode = request.args.get("mode", "ai")
    limit = int(request.args.get("limit", 40))
    s = snap()
    log = s.get("log_static" if mode == "static" else "log_ai", [])
    return jsonify(log[:limit])


@app.get("/summary")
def summary():
    s = snap()
    return jsonify({
        "summary": s.get("summary", {}), "counts": s.get("counts", {}),
        "tick": s.get("tick", 0), "timestamp": s.get("timestamp"),
        "mode": s.get("mode"), "scenario": s.get("scenario"), "running": s.get("running"),
        "demand": s.get("demand"), "demand_history": s.get("demand_history", []),
        "model_mode": s.get("model_mode"),
    })


@app.get("/matrix")
def matrix():
    s = snap()
    return jsonify({
        "nodes": s.get("nodes", []), "counts": s.get("counts", {}),
        "demand": s.get("demand"), "demand_history": s.get("demand_history", []),
        "forecast_peak": s.get("forecast_peak"),
    })


_PARK_SEVERITY = {"PARK": "offline", "WAKE": "healthy", "DRAIN": "critical"}


@app.get("/nodes/<node_id>")
def node_detail(node_id):
    s = snap()
    node = next((n for n in s.get("nodes", []) if n["node_id"] == node_id), None)
    if node is None:
        return jsonify({"error": "not found"}), 404
    hist = s.get("node_history", {}).get(node_id, {"cpu": [], "lat": []})

    label = node["label"]
    alert_events = [
        {"time": a["time"], "msg": a["msg"], "severity": a["severity"]}
        for a in s.get("alerts", []) if a["node_id"] == node_id
    ]
    # PARK/WAKE/DRAIN decisions targeting this node, merged into the same
    # timeline so the inspector shows why a node went offline / came back.
    park_events = [
        {"time": d["timestamp"].split("T")[-1][:8], "msg": d["reason"],
         "severity": _PARK_SEVERITY.get(d["label"], "healthy")}
        for d in s.get("log_ai", [])
        if d.get("target_node") == label and d.get("label") in _PARK_SEVERITY
    ]
    events = sorted(alert_events + park_events, key=lambda e: e["time"], reverse=True)[:8]
    return jsonify({"node": node, "history": hist, "events": events})


@app.get("/forecast")
def forecast():
    s = snap()
    return jsonify({
        "observed": s.get("demand_history", []),
        "predicted": s.get("predicted_demand", []),
        "region_forecast": s.get("region_forecast", []),
        "scale_log": s.get("scale_log", []),
        "forecast_peak": s.get("forecast_peak"),
        "capacity_ai": s.get("capacity_ai"), "capacity_static": s.get("capacity_static"),
    })


@app.get("/comparison")
def comparison():
    s = snap()
    return jsonify({
        "cost": s.get("cost", {}),
        "capacity_ai": s.get("capacity_ai"), "capacity_static": s.get("capacity_static"),
        "scenario": s.get("scenario"), "region_forecast": s.get("region_forecast", []),
    })


@app.get("/alerts")
def alerts():
    s = snap()
    return jsonify({"alerts": s.get("alerts", []), "counts": s.get("counts", {})})


@app.post("/control")
def control():
    body = request.get_json(silent=True) or {}
    ENGINE.apply_control(
        running=body.get("running"), mode=body.get("mode"), scenario=body.get("scenario"),
    )
    return jsonify({"ok": True, "mode": ENGINE.mode,
                    "scenario": ENGINE.scenario, "running": ENGINE.running})


ENGINE.start()

if __name__ == "__main__":
    # threaded so the tick loop and requests coexist; use_reloader off to avoid
    # starting the engine twice.
    app.run(host="0.0.0.0", port=5000, threaded=True, use_reloader=False)
