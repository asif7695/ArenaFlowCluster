"""Model accuracy smoke tests on held-out simulated data.

Requires trained models (run `python train.py` first); skips otherwise.
"""
import os

import pytest

from forecast_model import MODEL_PATH as FC_PATH
from anomaly_model import MODEL_PATH as AN_PATH

pytestmark = pytest.mark.skipif(
    not (os.path.exists(FC_PATH) and os.path.exists(AN_PATH)),
    reason="models not trained yet — run `python train.py`",
)


def test_forecast_accuracy_reasonable():
    from evaluate import evaluate
    r = evaluate(ticks=120, scenario="peak", seed=321)
    # MAE well under a full session; MAPE bounded on held-out traffic
    assert r["forecast"]["mae"] < 6.0
    assert r["forecast"]["mape"] < 40.0


def test_anomaly_catches_planted_failures():
    from evaluate import evaluate
    r = evaluate(ticks=150, scenario="spike", seed=654)
    a = r["anomaly"]
    assert a["positives"] > 0, "held-out run should contain planted/failure examples"
    assert a["recall"] >= 0.7, "must catch most degrading nodes"
    assert a["precision"] >= 0.6
