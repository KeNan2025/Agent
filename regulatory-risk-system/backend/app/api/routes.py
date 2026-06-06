"""Main scan API routes — refactored to use the self-built Agent framework and ensemble predictor."""
from __future__ import annotations

import asyncio
from typing import Any

import numpy as np
from fastapi import APIRouter, HTTPException, Query

from app.agents.orchestrator import run_scan_async
from app.core.framework import Checkpointer, Tracer
from app.features.engineer import FeatureEngineer
from app.graph import get_graph
from app.ml.training import get_or_train
from app.mock_data.generator import (
    get_all_companies, get_all_predictions, get_full_prediction,
)
from app.models.schemas import (
    AgentStep, BatchScanRequest, FinancialFeatures, PredictionResult,
    RankingItem, RankingResponse, RiskLevel, ScanRequest, ShapFeature,
    SimilarCase, RiskFactor, CompanyInfo,
)

router = APIRouter(prefix="/api/v1", tags=["scan"])

# Shared singletons
_TRACER = Tracer()
_CHECKPOINTER = Checkpointer()


def _ml_predict(
    company: CompanyInfo, fin: FinancialFeatures, risk_factors: list[RiskFactor],
) -> dict[str, float] | None:
    """Run the trained ensemble on the engineered feature vector."""
    try:
        model = get_or_train()
        eng = FeatureEngineer()
        graph_metrics = get_graph().metrics_for(company.code).to_feature_dict()
        vec = eng.build_vector(company, fin, risk_factors, history=None, graph_metrics=graph_metrics)
        return model.predict_one(vec)
    except Exception as exc:
        # Predictor unavailable — fall back to the seed probability
        print(f"[ml] predict failed, falling back: {exc}")
        return None


async def _persist_scan(
    final_state, probability: float, risk_level: str,
) -> None:
    from app.database.session import async_session
    from app.database.models import ScanRecord, TraceLog
    try:
        async with async_session() as session:
            async with session.begin():
                scan = ScanRecord(
                    scan_id=final_state.scan_id,
                    company_code=final_state.company_code,
                    window_days=final_state.window_days,
                    probability=probability,
                    risk_level=risk_level,
                    risk_hypothesis=final_state.risk_hypothesis,
                    analysis_plan=str(final_state.analysis_plan),
                    full_state=final_state.model_dump(mode="json"),
                )
                session.add(scan)
                for ev in final_state.trace_events:
                    d = ev.model_dump()
                    session.add(TraceLog(
                        scan_id=final_state.scan_id,
                        event_id=d.get("event_id", ""),
                        node_name=d.get("node_name", ""),
                        action=d.get("action", ""),
                        input_summary=d.get("input_summary", ""),
                        output_summary=d.get("output_summary", ""),
                        skills_called=str(d.get("skills_called", [])),
                        duration_ms=d.get("duration_ms", 0),
                        tokens_used=d.get("tokens_used", 0),
                    ))
    except Exception as exc:
        print(f"[persist] scan persistence skipped: {exc}")


@router.post("/scan/single", response_model=PredictionResult)
async def scan_single(req: ScanRequest):
    seed = get_full_prediction(req.company_code, req.window_days)
    if seed is None:
        raise HTTPException(status_code=404, detail=f"公司 {req.company_code} 未找到")

    fin: FinancialFeatures = seed["financial"]
    risk_factors: list[RiskFactor] = seed["risk_factors"]
    probability = seed["probability"]
    risk_level: RiskLevel = seed["risk_level"]
    company: CompanyInfo = seed["company"]
    shap_features: list[ShapFeature] = seed["shap_features"]

    # Try ML inference; if it succeeds, use its stacking probability
    ml = _ml_predict(company, fin, risk_factors)
    if ml is not None and "stacking" in ml:
        probability = float(ml["stacking"])
        risk_level = (
            RiskLevel.HIGH if probability >= 0.6 else
            RiskLevel.MEDIUM if probability >= 0.3 else RiskLevel.LOW
        )

    # Run the dynamic-planning agent graph
    final_state = await run_scan_async(
        company_code=req.company_code,
        window_days=req.window_days,
        financial_data=fin.model_dump(),
        risk_factors=risk_factors,
        shap_features=[s.model_dump() for s in shap_features],
        prediction_result={
            "catboost": ml.get("catboost", probability) if ml else probability,
            "lightgbm": ml.get("lightgbm", probability) if ml else probability,
            "tabpfn": ml.get("tabpfn", probability) if ml else probability,
            "stacking": probability,
            "risk_level": risk_level.value,
        },
        tracer=_TRACER,
        checkpointer=_CHECKPOINTER,
    )

    # Build trace returned to UI
    agent_trace = [
        AgentStep(
            step_id=i,
            agent_name=ev.node_name,
            action=ev.action,
            input_summary=ev.input_summary,
            output_summary=ev.output_summary,
            skills_called=ev.skills_called,
            duration_ms=ev.duration_ms,
            tokens_used=ev.tokens_used,
        )
        for i, ev in enumerate(final_state.trace_events, 1)
    ]
    total_tokens = sum(s.tokens_used for s in agent_trace)
    total_time = sum(s.duration_ms for s in agent_trace)
    report_md = final_state.report_markdown or seed["report_markdown"]

    # Persist scan + trace asynchronously
    asyncio.create_task(_persist_scan(final_state, probability, risk_level.value))

    return PredictionResult(
        company=company,
        inquiry_probability=probability,
        risk_level=risk_level,
        confidence=round(probability * 0.95 + 0.02, 3),
        window_days=req.window_days,
        risk_factors=risk_factors,
        shap_features=shap_features,
        similar_cases=seed["similar_cases"],
        agent_trace=agent_trace,
        report_markdown=report_md,
        analysis_time_ms=total_time,
        llm_calls=sum(1 for s in agent_trace if s.tokens_used > 0),
        total_tokens=total_tokens,
    )


@router.post("/scan/batch")
async def scan_batch(req: BatchScanRequest):
    results = []
    for code in req.company_codes:
        r = get_full_prediction(code, req.window_days)
        if not r:
            continue
        ml = _ml_predict(r["company"], r["financial"], r["risk_factors"])
        prob = float(ml["stacking"]) if ml and "stacking" in ml else r["probability"]
        risk_level = (
            RiskLevel.HIGH if prob >= 0.6 else
            RiskLevel.MEDIUM if prob >= 0.3 else RiskLevel.LOW
        )
        results.append({
            "company_code": code,
            "company_name": r["company"].name,
            "inquiry_probability": prob,
            "risk_level": risk_level.value,
            "top_risk_factor": r["risk_factors"][0].subcategory if r["risk_factors"] else "无",
        })
    results.sort(key=lambda x: -x["inquiry_probability"])
    return {"total": len(results), "results": results}


@router.get("/ranking", response_model=RankingResponse)
async def get_ranking(
    window_days: int = Query(60, description="预测窗口天数"),
    top_n: int = Query(50, description="返回前N条"),
    industry: str | None = Query(None, description="行业筛选"),
):
    all_preds = get_all_predictions(window_days)
    if industry:
        all_preds = [p for p in all_preds if p["company"].industry == industry]
    items = []
    for i, p in enumerate(all_preds[:top_n], 1):
        items.append(RankingItem(
            rank=i,
            company=p["company"],
            inquiry_probability=p["probability"],
            risk_level=p["risk_level"],
            top_risk_factor=p["top_risk"],
        ))
    return RankingResponse(total=len(all_preds), window_days=window_days, items=items)


@router.get("/report/{company_code}")
async def get_report(company_code: str, window_days: int = Query(60)):
    result = get_full_prediction(company_code, window_days)
    if result is None:
        raise HTTPException(status_code=404, detail=f"公司 {company_code} 未找到")
    return {
        "company_code": company_code,
        "company_name": result["company"].name,
        "report_markdown": result["report_markdown"],
    }


@router.get("/report/{company_code}/download")
async def download_report(company_code: str, window_days: int = Query(60)):
    """Download the risk report as a Markdown file."""
    result = get_full_prediction(company_code, window_days)
    if result is None:
        raise HTTPException(status_code=404, detail=f"公司 {company_code} 未找到")
    from fastapi.responses import PlainTextResponse
    filename = f"risk_report_{company_code}_{window_days}d.md"
    return PlainTextResponse(
        content=result["report_markdown"],
        media_type="text/markdown; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/trace/{company_code}")
async def get_trace(company_code: str, window_days: int = Query(60)):
    result = get_full_prediction(company_code, window_days)
    if result is None:
        raise HTTPException(status_code=404, detail=f"公司 {company_code} 未找到")
    return {
        "company_code": company_code,
        "company_name": result["company"].name,
        "agent_trace": [s.model_dump() for s in result["agent_trace"]],
        "total_time_ms": result["analysis_time_ms"],
        "total_llm_calls": result["llm_calls"],
        "total_tokens": result["total_tokens"],
    }


@router.get("/companies")
async def list_companies():
    companies = get_all_companies()
    return {"total": len(companies), "companies": [c.model_dump() for c in companies]}


@router.get("/industries")
async def list_industries():
    companies = get_all_companies()
    industries = sorted(set(c.industry for c in companies))
    return {"industries": industries}


@router.get("/financial/{company_code}")
async def get_financial(company_code: str, window_days: int = Query(60)) -> dict[str, Any]:
    """Expose detailed financial features for the front-end."""
    result = get_full_prediction(company_code, window_days)
    if result is None:
        raise HTTPException(status_code=404, detail=f"公司 {company_code} 未找到")
    return {
        "company_code": company_code,
        "company_name": result["company"].name,
        "industry": result["company"].industry,
        "financial": result["financial"].model_dump(),
    }
