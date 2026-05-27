"""Evaluation endpoints: LLM-as-Judge, ablation experiments, baseline comparison."""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.eval.judge import judge_report
from app.eval.ablation import run_ablation
from app.eval.baseline import run_baseline_compare

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
