"""Metric helpers reported for both models on held-out simulated data."""
from __future__ import annotations

from sklearn.metrics import mean_absolute_error, precision_score, recall_score, f1_score


def mape(y_true, y_pred) -> float:
    """Mean absolute percentage error, guarded against near-zero sessions."""
    n = len(y_true)
    if n == 0:
        return 0.0
    total = 0.0
    for a, p in zip(y_true, y_pred):
        denom = max(1.0, abs(a))
        total += abs(a - p) / denom
    return 100.0 * total / n


def forecast_metrics(y_true, y_pred) -> dict:
    return {"mae": mean_absolute_error(y_true, y_pred), "mape": mape(y_true, y_pred)}


def anomaly_metrics(y_true, y_pred) -> dict:
    return {
        "precision": precision_score(y_true, y_pred, zero_division=0),
        "recall": recall_score(y_true, y_pred, zero_division=0),
        "f1": f1_score(y_true, y_pred, zero_division=0),
        "positives": int(sum(y_true)),
        "n": len(y_true),
    }
