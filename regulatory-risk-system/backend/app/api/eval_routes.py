"""Evaluation endpoints: LLM-as-Judge, ablation, baseline, backtest, evidence recall."""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from app.eval.judge import judge_report
from app.eval.ablation import run_ablation
from app.eval.baseline import run_baseline_compare
from app.eval.backtest import run_backtest
from app.eval.evidence_recall import (
    evaluate_evidence_recall, evaluate_focus_classification, evaluate_case_topk,
)

router = APIRouter(prefix="/api/v1/eval", tags=["evaluation"])


class JudgeRequest(BaseModel):
    company_code: str
    window_days: int = 60


@router.post("/judge")
async def judge(req: JudgeRequest) -> dict[str, Any]:
    """LLM-as-Judge evaluation of a single company's report."""
    from app.mock_data.generator import get_full_prediction
    r = get_full_prediction(req.company_code, req.window_days)
    if r is None:
        raise HTTPException(status_code=404, detail=f"company not found: {req.company_code}")
    return judge_report(r["report_markdown"])


@router.post("/ablation")
async def ablation() -> dict[str, Any]:
    """Run all 6 ablation experiments and return results."""
    return run_ablation()


@router.post("/baseline")
async def baseline() -> dict[str, Any]:
    """Run 4 baseline comparisons and return metrics."""
    return run_baseline_compare()


@router.post("/backtest")
async def backtest(
    window_days: int = Query(default=60, ge=1, le=365),
    top_k_frac: float = Query(default=0.10, gt=0.0, le=1.0),
    max_samples: int | None = Query(default=None, ge=1),
) -> dict[str, Any]:
    """Rolling-window backtest. Returns AUC / F1 / Top-K recall.

    Used to verify the competition pass thresholds:
    - AUC ≥ 0.75
    - F1 ≥ 0.65
    - Top-10% recall ≥ 35%
    """
    return run_backtest(
        window_days=window_days, top_k_frac=top_k_frac, max_samples=max_samples,
    )


class EvidenceEvalRequest(BaseModel):
    predictions: list[dict[str, Any]]
    gold: list[dict[str, Any]]
    jaccard_threshold: float = 0.5


@router.post("/evidence-recall")
async def evidence_recall(req: EvidenceEvalRequest) -> dict[str, Any]:
    """Evidence-quote recall — competition target ≥ 85%."""
    return evaluate_evidence_recall(
        req.predictions, req.gold, threshold=req.jaccard_threshold,
    )


@router.post("/focus-accuracy")
async def focus_accuracy(req: EvidenceEvalRequest) -> dict[str, Any]:
    """Regulation focus point classification accuracy — target ≥ 80%."""
    return evaluate_focus_classification(req.predictions, req.gold)


class CaseTopKRequest(BaseModel):
    predicted_case_codes: list[str]
    gold_case_codes: list[str]
    k: int = 5


@router.post("/case-topk")
async def case_topk(req: CaseTopKRequest) -> dict[str, Any]:
    """Top-K case retrieval hit rate — target ≥ 70%."""
    return evaluate_case_topk(
        req.predicted_case_codes, req.gold_case_codes, k=req.k,
    )


@router.get("/regulation-focus-vocab")
async def regulation_focus_vocab() -> dict[str, Any]:
    """Return the controlled vocabulary for regulation focus points."""
    from app.models.regulation_focus import (
        REGULATION_FOCUS_VOCAB, list_categories,
    )
    return {
        "categories": list_categories(),
        "vocab": [
            {"category": fp.category, "subcategory": fp.subcategory,
             "description": fp.description}
            for fp in REGULATION_FOCUS_VOCAB
        ],
    }
