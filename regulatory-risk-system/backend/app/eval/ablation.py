"""
Ablation experiments: quantify each module's contribution.

Each experiment removes a feature family (or replaces an architectural choice)
and measures the impact on validation AUC / F1 vs the full pipeline.
"""
from __future__ import annotations

from typing import Any

import numpy as np

from app.features.engineer import FEATURE_GROUPS
from app.ml.predictor import PredictorEnsemble, SklearnFallbackModel
from app.ml.training import make_dataset


def _train_and_eval(X: np.ndarray, y: np.ndarray, label: str) -> dict[str, Any]:
    ens = PredictorEnsemble()
    ens.fit(X, y, [f"f{i}" for i in range(X.shape[1])])
    return {
        "label": label,
        "auc_roc": ens.metrics.auc_roc,
        "auc_pr": ens.metrics.auc_pr,
        "f1": ens.metrics.f1,
    }


def _train_single(X: np.ndarray, y: np.ndarray, label: str) -> dict[str, Any]:
    m = SklearnFallbackModel()
    # Quick scoring via OOF-style holdout
    from sklearn.model_selection import StratifiedKFold
    from sklearn.metrics import roc_auc_score, average_precision_score, f1_score
    skf = StratifiedKFold(n_splits=min(5, max(2, int(y.sum()))), shuffle=True, random_state=42) if y.sum() >= 2 else None
    preds = np.zeros(len(y))
    if skf is None:
        m.fit(X, y)
        preds = m.predict_proba(X)
    else:
        for tr, va in skf.split(X, y):
            m2 = SklearnFallbackModel()
            m2.fit(X[tr], y[tr])
            preds[va] = m2.predict_proba(X[va])
    yhat = (preds >= 0.5).astype(int)
    return {
        "label": label,
        "auc_roc": float(roc_auc_score(y, preds)) if len(np.unique(y)) > 1 else 0.5,
        "auc_pr": float(average_precision_score(y, preds)) if len(np.unique(y)) > 1 else float(y.mean()),
        "f1": float(f1_score(y, yhat)) if (yhat.sum() and y.sum()) else 0.0,
    }


def run_ablation() -> dict[str, Any]:
    """Run all 6 ablation experiments and the full-model baseline."""
    X, y, names = make_dataset(200)
    full = _train_and_eval(X, y, "full")

    experiments: list[dict[str, Any]] = []

    # Ablation-1: remove LLM semantic features (group B)
    s, e = FEATURE_GROUPS["B_announcement"]
    X1 = np.delete(X, slice(s, e), axis=1)
    experiments.append({"name": "Ablation-1 去除 LLM 语义特征",
                        **_train_and_eval(X1, y, "no_semantic"),
                        "expected": "AUC 下降 3-5%"})

    # Ablation-2: remove knowledge graph
    s, e = FEATURE_GROUPS["E_graph"]
    X2 = np.delete(X, slice(s, e), axis=1)
    experiments.append({"name": "Ablation-2 去除知识图谱特征",
                        **_train_and_eval(X2, y, "no_graph"),
                        "expected": "AUC 下降 1-3%"})

    # Ablation-3: remove historical regulatory
    s, e = FEATURE_GROUPS["D_history"]
    X3 = np.delete(X, slice(s, e), axis=1)
    experiments.append({"name": "Ablation-3 去除历史监管特征",
                        **_train_and_eval(X3, y, "no_history"),
                        "expected": "AUC 下降 2-4%"})

    # Ablation-4: single model vs ensemble
    experiments.append({"name": "Ablation-4 单 GBDT vs 异质集成",
                        **_train_single(X, y, "single_model"),
                        "expected": "F1 下降 3-8%"})

    # Ablation-5: fixed pipeline vs dynamic planning (mock: use single LR)
    experiments.append({"name": "Ablation-5 固定 Pipeline vs 动态规划",
                        **_train_single(X, y, "fixed_pipeline_proxy"),
                        "expected": "解释有效性降 5-10 分",
                        "note": "代理实验：固定 Pipeline 等价于禁用 Replan，效果以单模型近似"})

    # Ablation-6: remove evidence verification (mock: use temporal+market only)
    s1, e1 = FEATURE_GROUPS["C_market"]
    s2, e2 = FEATURE_GROUPS["F_temporal"]
    indices = list(range(s1, e1)) + list(range(s2, e2))
    X6 = X[:, indices]
    experiments.append({"name": "Ablation-6 去除防幻觉机制（仅市场+时序特征）",
                        **_train_and_eval(X6, y, "no_verification_proxy"),
                        "expected": "证据召回率降 10-15%"})

    return {
        "full_model": full,
        "ablations": experiments,
        "summary": {
            "n_samples": int(len(X)), "n_features": int(X.shape[1]),
            "positive_rate": float(y.mean()),
        },
    }
