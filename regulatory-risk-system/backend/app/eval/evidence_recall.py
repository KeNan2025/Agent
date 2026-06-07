"""
Evidence recall evaluation.

The competition requires "关键证据片段召回率 ≥ 85%". This module
computes recall over ground-truth evidence quotes provided by the
human annotator vs the model's extracted `evidence_quote`.

Approach:
- Both sides reduced to bag-of-tokens.
- A predicted quote is considered to "hit" a gold quote if the Jaccard
  similarity of token sets ≥ 0.5 (default). Configurable.
- Recall = #(gold quotes hit) / #(gold quotes).

Also computes "regulation-focus" classification accuracy:
- Each predicted (category, subcategory) is checked against gold.
- Accuracy = #correctly classified / #gold.
"""
from __future__ import annotations

import re
from typing import Any


def _tokenize(text: str) -> set[str]:
    if not text:
        return set()
    text = re.sub(r"[\s,.;:!?'\"(){}\[\]<>/\\|`~@#$%^&*+=_-]+", " ", text.lower())
    return {t for t in text.split() if len(t) > 1}


def jaccard(a: set[str], b: set[str]) -> float:
    if not a or not b:
        return 0.0
    inter = len(a & b)
    union = len(a | b)
    return inter / union if union else 0.0


def evaluate_evidence_recall(
    predictions: list[dict[str, Any]],
    gold: list[dict[str, Any]],
    *,
    threshold: float = 0.5,
) -> dict[str, Any]:
    """
    Each item in `predictions` / `gold` must carry an `evidence_quote`
    field (string). Optionally also `category`, `subcategory`.
    """
    if not gold:
        return {"recall": 0.0, "matched": 0, "total_gold": 0}
    pred_tokens = [_tokenize(p.get("evidence_quote", "")) for p in predictions]
    matched = 0
    detail: list[dict[str, Any]] = []
    for g in gold:
        g_tokens = _tokenize(g.get("evidence_quote", ""))
        best_score = 0.0
        best_idx = -1
        for i, pt in enumerate(pred_tokens):
            s = jaccard(g_tokens, pt)
            if s > best_score:
                best_score = s
                best_idx = i
        hit = best_score >= threshold
        if hit:
            matched += 1
        detail.append({
            "gold_quote": g.get("evidence_quote", "")[:200],
            "best_match_idx": best_idx,
            "best_jaccard": round(best_score, 3),
            "hit": hit,
        })
    return {
        "recall": round(matched / len(gold), 4),
        "matched": matched,
        "total_gold": len(gold),
        "threshold": threshold,
        "detail": detail,
    }


def evaluate_focus_classification(
    predictions: list[dict[str, Any]],
    gold: list[dict[str, Any]],
) -> dict[str, Any]:
    """Accuracy = fraction of gold (category, subcategory) pairs that
    appear in any prediction.
    """
    if not gold:
        return {"accuracy": 0.0, "matched": 0, "total_gold": 0}
    pred_pairs = {
        (p.get("category", ""), p.get("subcategory", ""))
        for p in predictions
    }
    hits = 0
    detail: list[dict[str, Any]] = []
    for g in gold:
        pair = (g.get("category", ""), g.get("subcategory", ""))
        hit = pair in pred_pairs
        if hit:
            hits += 1
        detail.append({"gold_pair": pair, "hit": hit})
    return {
        "accuracy": round(hits / len(gold), 4),
        "matched": hits,
        "total_gold": len(gold),
        "detail": detail,
    }


def evaluate_case_topk(
    predicted_case_codes: list[str],
    gold_case_codes: list[str],
    *,
    k: int = 5,
) -> dict[str, Any]:
    """Top-K hit rate for similar-case retrieval.

    Hit = at least one of the gold case codes appears in the top-K
    predictions. Aggregate over (query) samples is handled by the caller.
    """
    top_k = predicted_case_codes[:k]
    hit = any(c in top_k for c in gold_case_codes)
    return {
        "top_k": k,
        "hit": int(hit),
        "predicted": top_k,
        "gold": gold_case_codes,
    }
