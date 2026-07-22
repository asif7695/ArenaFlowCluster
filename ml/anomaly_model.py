"""Anomaly / failure model: failure_risk_score + status per node.

RandomForestClassifier trained against the simulator's planted failure ramp.
`failure_risk_score` is the model's probability of the "degrading" class;
`status` thresholds that score into healthy / degrading for the dashboard.
"""
from __future__ import annotations

import os

import joblib
from sklearn.ensemble import RandomForestClassifier

from features import FEATURE_NAMES, extract_features, to_vector

MODEL_PATH = os.path.join(os.path.dirname(__file__), "models", "anomaly.pkl")

# score at/above this is reported as "degrading" (tunable, mirrors design cutoff)
DEGRADING_THRESHOLD = 0.4


class AnomalyModel:
    def __init__(self, model: RandomForestClassifier | None = None,
                 threshold: float = DEGRADING_THRESHOLD):
        self.model = model
        self.threshold = threshold

    def fit(self, X, y) -> "AnomalyModel":
        self.model = RandomForestClassifier(
            n_estimators=140, max_depth=10, min_samples_leaf=2,
            class_weight="balanced", random_state=42, n_jobs=-1
        )
        self.model.fit(X, y)
        return self

    def _proba(self, X):
        # probability of the positive (failing) class, robust to single-class folds
        classes = list(self.model.classes_)
        p = self.model.predict_proba(X)
        if 1 in classes:
            idx = classes.index(1)
            return [row[idx] for row in p]
        return [0.0 for _ in p]

    def risk_scores(self, X):
        return self._proba(X)

    def predict_label(self, X):
        return [1 if s >= self.threshold else 0 for s in self._proba(X)]

    def predict_one(self, window: list[dict], tick: int) -> tuple[float, str]:
        vec = to_vector(extract_features(window, tick))
        score = float(self._proba([vec])[0])
        status = "degrading" if score >= self.threshold else "healthy"
        return score, status

    def feature_importance(self) -> dict:
        return dict(sorted(zip(FEATURE_NAMES, self.model.feature_importances_),
                           key=lambda kv: kv[1], reverse=True))

    def save(self, path: str = MODEL_PATH) -> None:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        joblib.dump({"model": self.model, "threshold": self.threshold}, path)

    @classmethod
    def load(cls, path: str = MODEL_PATH) -> "AnomalyModel":
        blob = joblib.load(path)
        return cls(model=blob["model"], threshold=blob.get("threshold", DEGRADING_THRESHOLD))
