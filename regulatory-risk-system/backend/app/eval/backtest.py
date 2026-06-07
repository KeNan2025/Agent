"""
Backtest engine — roll a single window across the test split and compute
competition metrics.

The competition's hard targets (AUC ≥ 0.75 / Top-10% recall ≥ 35% /
F1 ≥ 0.65) demand a reproducible offline evaluation. This module
implements a rolling-window backtest that:

1. Iterates (company_code, scan_date) pairs from `ground_truth/test.csv`.
2. For each pair: builds the feature row, runs ensemble prediction.
3. Compares against the true `label`.
4. Reports the competition metric bundle.

Run via:
    POST /api/v1/eval/backtest?window_days=60
"""
from __future__ import annotations

from datetime import date
from typing import Any

import numpy as np

from app.core.logging import get_logger
from app.data.registry import get_data_registry
from app.features.engineer import FEATURE_NAMES, FeatureEngineer
from app.ml.metrics_competition import compute_competition_metrics
from app.ml.training import get_or_train
from app.mock_data.generator import (
    generate_financial_features, generate_risk_factors,
)
from app.models.schemas import CompanyInfo

log = get_logger(__name__)


def run_backtest(
    window_days: int = 60, *, top_k_frac: float = 0.10, max_samples: int | None = None,
) -> dict[str, Any]:
    """Run a backtest over the test split, return competition metrics."""
    reg = get_data_registry()
    test = reg.load_ground_truth("test")
    if not test:
        # Fall back to all_ground_truth (then take last 20%) if no test split exists
        all_rows = reg.all_ground_truth()
        if not all_rows:
            return {
                "ok": False,
                "error": "no ground_truth data found in data/competition/",
            }
        test = all_rows[int(len(all_rows) * 0.8):]
    if max_samples:
        test = test[:max_samples]

    eng = FeatureEngineer()
    ens = get_or_train()

    y_true: list[int] = []
    y_proba: list[float] = []
    failed = 0
    for row in test:
        if row.window_days and row.window_days != window_days:
            continue
        try:
            company = CompanyInfo(
                code=row.company_code, name=row.company_code,
                industry="", market_cap=0.0,
            )
            fin = generate_financial_features(company)
            risk_factors = generate_risk_factors(company, fin)
            try:
                from app.graph import get_graph
                graph_metrics = get_graph().metrics_for(row.company_code).to_feature_dict()
            except Exception:
                graph_metrics = {}
            vec = eng.build_vector(company, fin, [rf.model_dump() for rf in risk_factors],
                                   history=None, graph_metrics=graph_metrics)
            pred = ens.predict_one(vec)
            y_proba.append(float(pred.get("stacking", 0.5)))
            y_true.append(int(row.label))
        except Exception as exc:  # noqa: BLE001
            failed += 1
            log.debug("backtest.row_failed", error=str(exc), code=row.company_code)

    if not y_true:
        return {
            "ok": False,
            "error": "all backtest rows failed; check feature engineering",
        }

    metrics = compute_competition_metrics(y_true, y_proba, top_k_frac=top_k_frac)
    return {
        "ok": True,
        "window_days": window_days,
        "n_samples": len(y_true),
        "n_failed": failed,
        "n_positive": int(sum(y_true)),
        "metrics": metrics,
        "thresholds": {
            "auc_target": 0.75,
            "f1_target": 0.65,
            "top_k_recall_target": 0.35,
            "top_k_frac": top_k_frac,
        },
        "pass_status": {
            "auc": metrics["auc_roc"] >= 0.75,
            "f1": metrics["f1"] >= 0.65,
            "top_k_recall": metrics["top_10pct_recall"] >= 0.35,
        },
    }
