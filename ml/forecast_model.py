"""Demand forecasting model: near-future active sessions per node.

Interpretable, fast-to-train RandomForestRegressor (no deep learning) predicting
active_sessions HORIZON_TICKS ahead from the rolling-window feature vector.
"""
from __future__ import annotations

import os

import joblib
from sklearn.ensemble import RandomForestRegressor

from features import FEATURE_NAMES, extract_features, to_vector

MODEL_PATH = os.path.join(os.path.dirname(__file__), "models", "forecast.pkl")


class ForecastModel:
    def __init__(self, model: RandomForestRegressor | None = None):
        self.model = model

    def fit(self, X, y) -> "ForecastModel":
        self.model = RandomForestRegressor(
            n_estimators=120, max_depth=12, min_samples_leaf=3, random_state=42, n_jobs=-1
        )
        self.model.fit(X, y)
        return self

    def predict(self, X):
        return self.model.predict(X)

    def predict_one(self, window: list[dict], tick: int) -> float:
        vec = to_vector(extract_features(window, tick))
        return float(self.model.predict([vec])[0])

    def feature_importance(self) -> dict:
        return dict(sorted(zip(FEATURE_NAMES, self.model.feature_importances_),
                           key=lambda kv: kv[1], reverse=True))

    def save(self, path: str = MODEL_PATH) -> None:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        joblib.dump(self.model, path)

    @classmethod
    def load(cls, path: str = MODEL_PATH) -> "ForecastModel":
        return cls(model=joblib.load(path))
