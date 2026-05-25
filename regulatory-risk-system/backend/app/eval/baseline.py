"""
Baseline comparison: pure-rule / GBDT-only / LLM-only / fixed-pipeline.
"""
from __future__ import annotations

from typing import Any

import numpy as np

from app.features.engineer import FEATURE_GROUPS
from app.ml.predictor import PredictorEnsemble, SklearnFallbackModel
from app.ml.training import make_dataset


def _rule_based_baseline(X: np.ndarray, y: np.ndarray) -> dict[str, Any]:
    """
    Baseline-1: pure rule model.
    Use a small set of hand-coded thresholds on financial features.
    """
    from sklearn.metrics import (
        accuracy_score, f1_score, precision_score, recall_score, roc_auc_score,
    )
    s, e = FEATURE_GROUPS["A_financial"]
    A = X[:, s:e]
    # Heuristic: weighted sum of M-Score, Z-Score, ocf_to_profit, pledge_ratio
    # (positions roughly: beneish=12, altman=13, pledge=14, ocf=8)
    beneish = A[:, 12]
    altman = A[:, 13]
    pledge = A[:, 14]
    ocf = A[:, 8]
    rule_score = (
        (beneish > -2.0).astype(int)
        + (altman < 1.81).astype(int)
        + (ocf < 0.3).astype(int)
        + (pledge > 50).astype(int)
    )
    probs = np.clip(rule_score / 4.0, 0.05, 0.95)
    yhat = (probs >= 0.5).astype(int)
    return {
        "name": "Baseline-1 纯规则模型",
        "auc_roc": float(roc_auc_score(y, probs)) if len(np.unique(y)) > 1 else 0.5,
        "f1": float(f1_score(y, yhat)),
        "precision": float(precision_score(y, yhat, zero_division=0)),
        "recall": float(recall_score(y, yhat, zero_division=0)),
    }


def _gbdt_only_baseline(X: np.ndarray, y: np.ndarray) -> dict[str, Any]:
    s, e = FEATURE_GROUPS["A_financial"]
    Xa = X[:, s:e]
    ens = PredictorEnsemble(use_tabpfn=False)
    ens.fit(Xa, y, [f"a{i}" for i in range(Xa.shape[1])])
    return {
        "name": "Baseline-2 纯 GBDT（仅结构化特征）",
        "auc_roc": ens.metrics.auc_roc,
        "auc_pr": ens.metrics.auc_pr,
        "f1": ens.metrics.f1,
    }


def _llm_only_baseline(X: np.ndarray, y: np.ndarray) -> dict[str, Any]:
    """
    Baseline-3: LLM-only proxy.
    We mimic the LLM zero-shot signal via Group B (semantic) features alone.
    """
    s, e = FEATURE_GROUPS["B_announcement"]
    Xb = X[:, s:e]
    m = SklearnFallbackModel()
    m.fit(Xb, y)
    from sklearn.metrics import roc_auc_score, f1_score
    p = m.predict_proba(Xb)
    yhat = (p >= 0.5).astype(int)
    return {
        "name": "Baseline-3 纯 LLM 直接预测（Zero-shot 代理）",
        "auc_roc": float(roc_auc_score(y, p)) if len(np.unique(y)) > 1 else 0.5,
        "f1": float(f1_score(y, yhat)),
    }


def _fixed_pipeline_baseline(X: np.ndarray, y: np.ndarray) -> dict[str, Any]:
    """
    Baseline-4: fixed-pipeline Agent (no dynamic routing).
    Approximated by removing graph features (the route most often skipped
    when Planner produces a financial-focus plan).
    """
    s, e = FEATURE_GROUPS["E_graph"]
    Xn = np.delete(X, slice(s, e), axis=1)
    ens = PredictorEnsemble()
    ens.fit(Xn, y, [f"f{i}" for i in range(Xn.shape[1])])
    return {
        "name": "Baseline-4 固定 Pipeline（无动态规划）",
        "auc_roc": ens.metrics.auc_roc,
        "auc_pr": ens.metrics.auc_pr,
        "f1": ens.metrics.f1,
    }


def run_baseline_compare() -> dict[str, Any]:
    X, y, _ = make_dataset(200)
    full = PredictorEnsemble()
    full.fit(X, y, [f"f{i}" for i in range(X.shape[1])])
    baselines = [
        _rule_based_baseline(X, y),
        _gbdt_only_baseline(X, y),
        _llm_only_baseline(X, y),
        _fixed_pipeline_baseline(X, y),
    ]
    return {
        "full_model": {
            "name": "Full Ensemble + Dynamic Agent",
            "auc_roc": full.metrics.auc_roc,
            "auc_pr": full.metrics.auc_pr,
            "f1": full.metrics.f1,
        },
        "baselines": baselines,
    }
