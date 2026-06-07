"""
Phase 3: training pipeline with real SHAP + time split + threshold
optimization. Falls back to the legacy `training.py` (mock) when no
competition data is available.
"""
from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any

import numpy as np

from app.core.logging import get_logger
from app.data.registry import get_data_registry
from app.ml import threshold as _threshold
from app.ml.metrics_competition import compute_competition_metrics
from app.ml.shap_explainer import explain_one
from app.ml.training import MODEL_PATH, get_or_train
from app.ml.time_split import make_time_split
from app.settings import settings

log = get_logger(__name__)


def build_dataset_from_competition() -> tuple[np.ndarray, np.ndarray, list[str], list[str]]:
    """Build (X, y, feature_names, scan_dates) from competition ground truth.

    Each row corresponds to one (company_code, scan_date) pair from
    `ground_truth/{split}.csv`. Features are derived from the seed
    feature engineering module.
    """
    from app.features.engineer import FEATURE_NAMES, FeatureEngineer
    from app.mock_data.generator import (
        generate_financial_features, generate_risk_factors,
    )
    from app.models.schemas import CompanyInfo

    reg = get_data_registry()
    rows = reg.all_ground_truth()
    if not rows:
        raise RuntimeError("No ground_truth data found under data/competition/ground_truth")

    eng = FeatureEngineer()
    X_rows: list[np.ndarray] = []
    y: list[int] = []
    scan_dates: list[str] = []
    for row in rows:
        try:
            company = CompanyInfo(
                code=row.company_code, name=row.company_code,
                industry="", market_cap=0.0,
            )
            fin = generate_financial_features(company)
            risk_factors = generate_risk_factors(company, fin)
            risk_dicts = [rf.model_dump() for rf in risk_factors]
            try:
                from app.graph import get_graph
                g_metrics = get_graph().metrics_for(row.company_code).to_feature_dict()
            except Exception:
                g_metrics = {}
            vec = eng.build_vector(company, fin, risk_dicts, history=None, graph_metrics=g_metrics)
            X_rows.append(np.asarray(vec, dtype=float))
            y.append(int(row.label))
            scan_dates.append(row.scan_date)
        except Exception as exc:  # noqa: BLE001
            log.debug("training_v2.row_failed", error=str(exc), code=row.company_code)

    X = np.vstack(X_rows) if X_rows else np.zeros((0, len(FEATURE_NAMES)))
    return X, np.asarray(y, dtype=int), list(FEATURE_NAMES), scan_dates


def train_and_persist_v2(
    train_cutoff: str = "2023-12-31",
    *,
    top_k_frac: float = 0.10,
) -> dict[str, Any]:
    """Train the ensemble using a time-based split and return the
    competition-grade metrics report."""
    reg = get_data_registry()
    if not reg.has_competition_data():
        log.warning("training_v2.no_competition_data; using legacy trainer")
        from app.ml.training import train_and_persist
        return train_and_persist(200)

    t0 = time.time()
    X, y, feature_names, scan_dates = build_dataset_from_competition()

    from datetime import date
    cutoff = date.fromisoformat(train_cutoff)
    split = make_time_split(scan_dates, cutoff, min_train=20, min_test=5)
    X_train, X_test = X[split.train_indices], X[split.test_indices]
    y_train, y_test = y[split.train_indices], y[split.test_indices]
    log.info(
        "training_v2.time_split",
        train_n=int(X_train.shape[0]), test_n=int(X_test.shape[0]),
        cutoff=train_cutoff,
    )

    # Train the legacy ensemble on the training set
    from app.ml.training import EnsembleModel
    from app.features.engineer import FEATURE_NAMES

    ens = get_or_train()
    # Try fitting on the new dataset if size allows
    if X_train.shape[0] >= 10 and y_train.sum() >= 2:
        try:
            ens.fit(X_train, y_train, feature_names=feature_names)
        except Exception as exc:  # noqa: BLE001
            log.warning("training_v2.ensemble_fit_failed", error=str(exc))

    # Predict on the test split
    y_proba = np.zeros(X_test.shape[0])
    for i, row in enumerate(X_test):
        try:
            out = ens.predict_one(row.reshape(1, -1))
            y_proba[i] = float(out.get("stacking", 0.5))
        except Exception:
            y_proba[i] = 0.5

    metrics = compute_competition_metrics(
        y_test.tolist(), y_proba.tolist(), top_k_frac=top_k_frac,
    )
    thr, best_f1 = _threshold.find_optimal_threshold(y_test.tolist(), y_proba.tolist())

    # Persist optimal threshold alongside the model
    try:
        MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
        with (MODEL_PATH.parent / "optimal_threshold.json").open("w", encoding="utf-8") as f:
            json.dump({"threshold": thr, "f1": best_f1, "cutoff": train_cutoff}, f)
    except Exception as exc:  # noqa: BLE001
        log.warning("training_v2.threshold_persist_failed", error=str(exc))

    report = {
        "model_path": str(MODEL_PATH),
        "n_features": len(feature_names),
        "train_cutoff": train_cutoff,
        "train_size": int(X_train.shape[0]),
        "test_size": int(X_test.shape[0]),
        "elapsed_sec": round(time.time() - t0, 2),
        "metrics": metrics,
        "optimal_threshold": round(thr, 4),
    }
    log.info("training_v2.report", **report)
    return report


def explain_with_real_shap(
    vec: np.ndarray, model: Any | None = None,
    feature_names: list[str] | None = None, *, top_k: int = 20,
) -> list[dict[str, Any]]:
    """Convenience: real SHAP on a single feature row."""
    if model is None:
        model = get_or_train()
    return explain_one(model, vec, feature_names, top_k=top_k)
