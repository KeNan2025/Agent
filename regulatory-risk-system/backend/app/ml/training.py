"""
End-to-end training pipeline.

Generates a synthetic dataset from the mock data generator (so it can be run
without external data), engineers features, fits the ensemble, persists the
model, and returns metrics. In production this would be swapped for a real
data loader, but the contract stays identical.
"""
from __future__ import annotations

from pathlib import Path

import numpy as np

from app.config import BASE_DIR
from app.features.engineer import build_feature_matrix
from app.ml.predictor import PredictorEnsemble
from app.mock_data.generator import (
    generate_companies, generate_financial_features,
    generate_risk_factors,
)

MODEL_PATH = BASE_DIR / "data" / "models" / "predictor_ensemble.pkl"


def make_dataset(n: int = 200) -> tuple[np.ndarray, np.ndarray, list[str]]:
    """Construct a synthetic training set with realistic class imbalance."""
    companies = generate_companies(n)
    rng = np.random.default_rng(42)
    fins, rfs, ys = [], [], []
    for i, c in enumerate(companies):
        # ~15% positive rate, matching the demo defaults
        is_risky = bool(rng.random() < 0.15)
        fin = generate_financial_features(c, is_risky=is_risky)
        rf = generate_risk_factors(c, fin) if is_risky else generate_risk_factors(c, fin)[:1]
        fins.append(fin)
        rfs.append(rf)
        ys.append(1 if is_risky else 0)
    X, names = build_feature_matrix(companies, fins, rfs)
    y = np.array(ys, dtype=np.int32)
    return X, y, names


def train_and_persist(n: int = 200, save_path: Path | None = None) -> dict:
    save_path = save_path or MODEL_PATH
    save_path.parent.mkdir(parents=True, exist_ok=True)
    X, y, names = make_dataset(n)
    ens = PredictorEnsemble()
    ens.fit(X, y, names)
    ens.save(save_path)
    return {
        "model_path": str(save_path),
        "n_samples": int(len(X)),
        "n_features": int(X.shape[1]),
        "positive_rate": float(y.mean()),
        "auc_roc": ens.metrics.auc_roc,
        "auc_pr": ens.metrics.auc_pr,
        "f1": ens.metrics.f1,
        "threshold": ens.metrics.threshold,
        "per_model_auc": dict(ens.metrics.per_model_auc),
    }


def get_or_train() -> PredictorEnsemble:
    """Lazily load the persisted ensemble; train one if missing."""
    if MODEL_PATH.exists():
        return PredictorEnsemble.load(MODEL_PATH)
    train_and_persist()
    return PredictorEnsemble.load(MODEL_PATH)


if __name__ == "__main__":
    import json
    report = train_and_persist()
    print(json.dumps(report, ensure_ascii=False, indent=2))
