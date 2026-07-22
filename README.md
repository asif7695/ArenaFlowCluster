# ArenaFlowCluster

**Predictive AI for real-time game-server cluster intelligence.**
Team *Vibe Whisperers* — AI Innovation Hackathon.

ArenaFlowCluster is a predictive layer that sits above a game-server cluster. It
forecasts near-future player demand and node degradation, then schedules capacity
**ahead** of load spikes and failures — instead of reacting *after* a threshold is
crossed the way Kubernetes' Horizontal Pod Autoscaler does. A live dashboard runs
the **AI scheduler against a dumb static baseline** over identical simulated
traffic, showing the cost and reliability difference side by side.

This repo is a fully-simulated end-to-end prototype. One-directional pipeline:

```
simulator ──▶ ML models ──▶ scheduler ──▶ Flask API ──▶ Next.js dashboard
 (telemetry)  (forecast +   (AI + static   (REST, CORS)  (7 screens, polling)
              anomaly)       baseline)
```

Real Kubernetes wiring (kind/minikube) is a documented **stretch goal**; the
simulated demo is complete and verified.

---

## Repository layout

| Path | What it is |
|---|---|
| `simulator/` | 64-node telemetry generator (daily-cycle demand + spikes + a planted failure ramp) |
| `ml/` | scikit-learn demand-forecast + anomaly models, training & evaluation |
| `backend/` | Flask API + engine (runs sim→ML→both schedulers→cost each tick) |
| `dashboard/` | Next.js + Chart.js dashboard, all 7 design screens |

Each piece runs independently (simulator emits sample JSON; backend falls back to
heuristic models if none are trained; dashboard falls back to a client-side mock
if the backend is down).

---

## Quick start

Prereqs: **Python 3.10+** and **Node 18+**. Three terminals.

### 1. ML — train the models (once)
```bash
cd ml
python -m venv .venv && source .venv/Scripts/activate   # Windows Git Bash
#   (macOS/Linux: source .venv/bin/activate)
pip install -r requirements.txt
python train.py            # prints MAE/MAPE + precision/recall, saves models/*.pkl
```

### 2. Backend — Flask API (port 5000)
```bash
cd backend
python -m venv .venv && source .venv/Scripts/activate
pip install -r requirements.txt
python app.py              # engine starts ticking; serves REST endpoints
```
> Backend works even without trained models — it falls back to heuristic models.
> Force that with `USE_MOCK=1 python app.py`.

### 3. Dashboard — Next.js (port 3000)
```bash
cd dashboard
npm install
npm run dev                # open http://localhost:3000
```
> Run the UI with **no backend** via `NEXT_PUBLIC_USE_MOCK=1 npm run dev`.
> Configure the backend URL / poll rate in `.env.local` (see `.env.local.example`).

**Start order:** train ML → start backend → start dashboard.

### Simulator standalone (optional)
```bash
cd simulator
python simulator.py --ticks 200 --out sample_telemetry.json
```

---

## Data contract

The three shapes wired through the whole pipeline:

```jsonc
// telemetry record            GET /telemetry
{ "node_id": "node-3", "timestamp": "...", "cpu_pct": 72.5, "mem_pct": 61.0,
  "active_sessions": 48, "latency_ms": 35.2 }

// model output                GET /predictions
{ "node_id": "node-3", "timestamp": "...", "forecast_sessions_next_5min": 65,
  "failure_risk_score": 0.82, "status": "degrading" }

// scheduler decision          GET /decisions?mode=ai|static
{ "timestamp": "...", "action": "scale_up", "target_node": "node-3",
  "reason": "forecasted demand exceeds capacity in 5min", "mode": "ai" }
```

### REST endpoints (CORS enabled)
| Endpoint | Purpose |
|---|---|
| `GET /health` | engine status (tick, mode, scenario, model_mode) |
| `GET /telemetry` | raw telemetry records (contract) |
| `GET /predictions` | raw model outputs (contract) |
| `GET /decisions?mode=ai\|static` | scheduler decisions (contract) + `label`, `confidence` |
| `GET /summary` | top stat-bar aggregates |
| `GET /matrix` | 64 per-node display objects for the grid |
| `GET /nodes/<id>` | single-node detail + history + events |
| `GET /forecast` | observed + predicted demand, per-region forecast |
| `GET /comparison` | AI vs static cost / incidents / utilization |
| `GET /alerts` | active health alerts |
| `POST /control` | `{ running?, mode?, scenario? }` — drives the dashboard's toggles |

---

## Dashboard screens (all 7 implemented)
Node Matrix · Node Inspector · Predictive Scaling · **AI vs Static (centerpiece)** ·
Cost Analytics · Health Alerts · Scheduler Log. Sidebar toggles the active
scheduler (AI/STATIC) and the header pauses/resumes — both POST `/control`.

---

## Verification

```bash
# ML metrics (held-out simulated data)
cd ml && python evaluate.py
#   forecast MAE ~1.7 sessions, MAPE ~15% ; anomaly precision ~0.83 recall ~0.93

# automated tests
cd backend && pip install pytest && python -m pytest -q     # scheduler logic (5 tests)
cd ml      && python -m pytest -q                           # model accuracy (2 tests)
```

**End-to-end check (all three running):**
- `curl localhost:5000/telemetry` returns live-updating 64-node JSON.
- Dashboard shows the color-coded matrix updating, the AI-vs-static comparison
  charts diverging (AI cheaper, fewer incidents), and a decision log with reasons.
- `curl localhost:5000/comparison` — over a full demand cycle cumulative AI spend
  is **~20–40% below static** and AI incidents are far lower (e.g. `savings 32%,
  incidents AI 14 vs static 434`), satisfying the concept's impact metrics.
- Node **D4** (`node-27`) carries the planted failure ramp — watch it trend to
  `critical` with a high `failure_risk_score` and generate a lead-time alert.

---

## Design-fidelity notes (deviations flagged per the brief)

1. **Framework** — the design artifact is a plain React SPA; we build in **Next.js**
   (concept-note stack) and reproduce the visuals, not the artifact's render engine.
2. **Charts** — micro sparklines / matrix bars use inline **SVG** (design-faithful);
   the large forecast & cost charts use **Chart.js** (concept-note stack), so those
   look very close but not byte-identical to the design's hand-rolled SVG.
3. **Action vocabulary** — decisions use the contract's `scale_up / scale_down /
   route_away` plus an added `place` action; the design's `SCALE↑/↓ / REROUTE /
   PLACE` labels are carried on each decision's `label` field.
4. **Config vs sliders** — the design's horizon/degrade/fail/buffer sliders live as
   backend config (`backend/config.py`); there is no separate settings screen.
5. **Mock data** — "runs before the backend" is provided by a client-side mock
   (`dashboard/lib/mock.ts`) rather than static JSON files.

---

## Tech stack
Python · Flask · scikit-learn · pandas/NumPy · JavaScript/TypeScript · Next.js ·
Chart.js · React. (Docker / Kubernetes kind-minikube: stretch goal, not required
for the demo.)

## Security posture (concept note)
Least-privilege scaling actions, TLS-terminated API in production, telemetry input
validation, and full audit logging of automated decisions (every scheduler action
is persisted with its rationale in the decision log).
