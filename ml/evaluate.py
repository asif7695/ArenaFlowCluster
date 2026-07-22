"""Evaluate persisted models on a fresh held-out simulated run.

    python evaluate.py

Prints MAE/MAPE for the forecast model and precision/recall/f1 for the anomaly
model. Used by the verification checklist and by the pytest smoke test.
"""
from __future__ import annotations

from dataset import build_supervised
from forecast_model import ForecastModel
from anomaly_model import AnomalyModel
from metrics import forecast_metrics, anomaly_metrics


def evaluate(ticks: int = 150, scenario: str = "spike", seed: int = 123) -> dict:
    X, yf, ya = build_supervised(ticks=ticks, scenario=scenario, seed=seed)
    fc = ForecastModel.load()
    an = AnomalyModel.load()
    return {
        "forecast": forecast_metrics(yf, fc.predict(X)),
        "anomaly": anomaly_metrics(ya, an.predict_label(X)),
        "samples": len(X),
    }


def main() -> None:
    r = evaluate()
    fm, am = r["forecast"], r["anomaly"]
    print(f"held-out samples: {r['samples']}")
    print(f"forecast  MAE  = {fm['mae']:.2f} sessions")
    print(f"forecast  MAPE = {fm['mape']:.1f} %")
    print(f"anomaly   precision = {am['precision']:.3f}")
    print(f"anomaly   recall    = {am['recall']:.3f}")
    print(f"anomaly   f1        = {am['f1']:.3f}  ({am['positives']}/{am['n']} positive)")


if __name__ == "__main__":
    main()
