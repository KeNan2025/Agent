"""
Find the optimal decision threshold on a PR curve.

Returns the threshold that maximises F1. If a non-empty `target_recall`
is supplied, the threshold that achieves at least that recall with the
highest precision is chosen.
"""
from __future__ import annotations

from typing import Iterable

import numpy as np


def find_optimal_threshold(
    y_true: Iterable[int],
    y_proba: Iterable[float],
    *,
    target_recall: float | None = None,
) -> tuple[float, float]:
    """Return (threshold, best_f1).

    If `target_recall` is provided, returns the smallest threshold that
    achieves that recall and reports the corresponding F1.
    """
    y_true = np.asarray(list(y_true))
    y_proba = np.asarray(list(y_proba))
    if y_true.size == 0 or y_proba.size == 0:
        return 0.5, 0.0
    # Candidate thresholds = unique predicted probs (clipped to avoid extremes)
    candidates = np.unique(np.round(y_proba, 4))
    if candidates.size < 2:
        return 0.5, 0.0
    best_f1 = -1.0
    best_thr = 0.5
    best_recall = 0.0
    for thr in candidates:
        pred = (y_proba >= thr).astype(int)
        tp = int(((pred == 1) & (y_true == 1)).sum())
        fp = int(((pred == 1) & (y_true == 0)).sum())
        fn = int(((pred == 0) & (y_true == 1)).sum())
        if tp == 0:
            f1 = 0.0
            recall = 0.0
        else:
            precision = tp / (tp + fp) if (tp + fp) else 0.0
            recall = tp / (tp + fn) if (tp + fn) else 0.0
            f1 = 2 * precision * recall / (precision + recall) if (precision + recall) else 0.0
        if target_recall is not None:
            if recall >= target_recall and recall > best_recall:
                best_thr = float(thr)
                best_f1 = f1
                best_recall = recall
        else:
            if f1 > best_f1:
                best_f1 = f1
                best_thr = float(thr)
                best_recall = recall
    return best_thr, best_f1
