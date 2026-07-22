"""Train both models on simulated history and persist them to models/.

    python train.py

Generates a long simulated run for training and a separate held-out run (different
seed) for honest metrics, then prints MAE/MAPE (forecast) and precision/recall
(anomaly) — the numbers that back the concept note's impact metrics.
"""
from __future__ import annotations

from dataset import build_supervised
from forecast_model import ForecastModel
from anomaly_model import AnomalyModel
from metrics import forecast_metrics, anomaly_metrics


def main() -> None:
    print("generating training data (400 ticks, scenario=peak, seed=7) ...")
    Xtr, yf_tr, ya_tr = build_supervised(ticks=400, scenario="peak", seed=7)
    print(f"  {len(Xtr)} samples, {sum(ya_tr)} failing")

    print("generating held-out data (150 ticks, scenario=spike, seed=99) ...")
    Xte, yf_te, ya_te = build_supervised(ticks=150, scenario="spike", seed=99)
    print(f"  {len(Xte)} samples, {sum(ya_te)} failing")

    print("\ntraining forecast model (RandomForestRegressor) ...")
    fc = ForecastModel().fit(Xtr, yf_tr)
    fm = forecast_metrics(yf_te, fc.predict(Xte))
    fc.save()

    print("training anomaly model (RandomForestClassifier) ...")
    an = AnomalyModel().fit(Xtr, ya_tr)
    am = anomaly_metrics(ya_te, an.predict_label(Xte))
    an.save()

    print("\n=== held-out metrics ===")
    print(f"forecast  MAE  = {fm['mae']:.2f} sessions")
    print(f"forecast  MAPE = {fm['mape']:.1f} %")
    print(f"anomaly   precision = {am['precision']:.3f}")
    print(f"anomaly   recall    = {am['recall']:.3f}")
    print(f"anomaly   f1        = {am['f1']:.3f}  ({am['positives']}/{am['n']} positive)")

    print("\ntop forecast features:", list(fc.feature_importance().items())[:5])
    print("top anomaly  features:", list(an.feature_importance().items())[:5])
    print("\nsaved models to ml/models/  (forecast.pkl, anomaly.pkl)")


if __name__ == "__main__":
    main()
