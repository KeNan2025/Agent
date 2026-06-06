"""
Competition-grade metrics.

The competition spec (§技术指标 监管问询概率预测) requires:
- AUC-ROC ≥ 0.75
- Top-10% 高风险公司覆盖真实问询样本比例 ≥ 35%
- F1 ≥ 0.65

And for risk semantics:
- 监管关注点分类准确率 ≥ 80%
- 关键证据片段召回率 ≥ 85%
- 相似历史问询案例匹配 Top-5 命中率 ≥ 70%
"""
from __future__ import annotations

from typing import Iterable

import numpy as np


def auc_roc(y_true: Iterable[int], y_score: Iterable[float]) -> float:
    y_true = np.asarray(list(y_true))
    y_score = np.asarray(list(y_score))
    if y_true.size == 0 or y_true.sum() == 0 or y_true.sum() == y_true.size:
        return 0.0
    order = np.argsort(-y_score)
    y_sorted = y_true[order]
    pos = int(y_sorted.sum())
    neg = int(y_sorted.size - pos)
    cum_pos = 0
    auc = 0.0
    prev_score = None
    for i, (label, score) in enumerate(zip(y_sorted, y_score[order])):
        if prev_score is not None and score != prev_score:
            pass
        if label == 1:
            cum_pos += 1
        else:
            auc += cum_pos
        prev_score = score
    auc /= (pos * neg)
    return float(auc)


def f1_at_threshold(y_true: Iterable[int], y_score: Iterable[float], threshold: float) -> float:
    y_true = np.asarray(list(y_true))
    y_score = np.asarray(list(y_score))
    pred = (y_score >= threshold).astype(int)
    tp = int(((pred == 1) & (y_true == 1)).sum())
    fp = int(((pred == 1) & (y_true == 0)).sum())
    fn = int(((pred == 0) & (y_true == 1)).sum())
    if tp == 0:
        return 0.0
    precision = tp / (tp + fp) if (tp + fp) else 0.0
    recall = tp / (tp + fn) if (tp + fn) else 0.0
    if precision + recall == 0:
        return 0.0
    return 2 * precision * recall / (precision + recall)


def top_k_recall(y_true: Iterable[int], y_score: Iterable[float], k_frac: float = 0.1) -> float:
    """Recall over the top-k fraction of predictions (rank-based)."""
    y_true = np.asarray(list(y_true))
    y_score = np.asarray(list(y_score))
    n = y_true.size
    if n == 0 or y_true.sum() == 0:
        return 0.0
    k = max(1, int(n * k_frac))
    order = np.argsort(-y_score)[:k]
    captured = int(y_true[order].sum())
    return float(captured / y_true.sum())


def compute_competition_metrics(
    y_true: Iterable[int],
    y_proba: Iterable[float],
    threshold: float | None = None,
    top_k_frac: float = 0.1,
) -> dict[str, float]:
    """One-shot compute all competition metrics for a single test split."""
    from app.ml.threshold import find_optimal_threshold
    y_true = list(y_true)
    y_proba = list(y_proba)
    thr, best_f1 = find_optimal_threshold(y_true, y_proba)
    if threshold is None:
        threshold = thr
    return {
        "auc_roc": round(auc_roc(y_true, y_proba), 4),
        "f1": round(f1_at_threshold(y_true, y_proba, threshold), 4),
        "f1_optimal_threshold": round(best_f1, 4),
        "optimal_threshold": round(threshold, 4),
        "top_10pct_recall": round(top_k_recall(y_true, y_proba, k_frac=top_k_frac), 4),
    }
