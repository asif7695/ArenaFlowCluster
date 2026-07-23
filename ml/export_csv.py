"""One-off export: dump the two supervised datasets train.py builds to CSV.

    python export_csv.py

Writes ml/models/train_dataset.csv (400 ticks, peak, seed=7) and
ml/models/holdout_dataset.csv (150 ticks, spike, seed=99) — the exact same
data build_supervised() feeds to ForecastModel/AnomalyModel during training.
"""
from __future__ import annotations

import csv
import os

from dataset import build_supervised
from features import FEATURE_NAMES

OUT_DIR = os.path.join(os.path.dirname(__file__), "models")


def dump(path: str, X, y_forecast, y_anomaly) -> None:
    os.makedirs(OUT_DIR, exist_ok=True)
    with open(path, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow([*FEATURE_NAMES, "y_forecast_sessions", "y_anomaly_label"])
        for row, yf, ya in zip(X, y_forecast, y_anomaly):
            w.writerow([*row, yf, ya])
    print(f"wrote {len(X)} rows -> {path}")


def main() -> None:
    Xtr, yf_tr, ya_tr = build_supervised(ticks=400, scenario="peak", seed=7)
    dump(os.path.join(OUT_DIR, "train_dataset.csv"), Xtr, yf_tr, ya_tr)

    Xte, yf_te, ya_te = build_supervised(ticks=150, scenario="spike", seed=99)
    dump(os.path.join(OUT_DIR, "holdout_dataset.csv"), Xte, yf_te, ya_te)


if __name__ == "__main__":
    main()
