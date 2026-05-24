from fastapi import APIRouter, HTTPException, Query
from app.models.schemas import (
    ScanRequest, BatchScanRequest, PredictionResult,
    RankingResponse, RankingItem,
)
from app.mock_data.generator import (
    get_full_prediction, get_all_predictions, get_all_companies,
)
from app.agents.orchestrator import run_scan_pipeline

router = APIRouter(prefix="/api/v1", tags=["scan"])


@router.post("/scan/single", response_model=PredictionResult)
async def scan_single(req: ScanRequest):
    result = get_full_prediction(req.company_code, req.window_days)
    if result is None:
        raise HTTPException(status_code=404, detail=f"公司 {req.company_code} 未找到")

    fin_data = result["financial"].model_dump()
    agent_trace = run_scan_pipeline(
        company_code=req.company_code,
        window_days=req.window_days,
        financial_data=fin_data,
        risk_factors=result["risk_factors"],
        similar_cases=result["similar_cases"],
        probability=result["probability"],
        risk_level=result["risk_level"].value,
    )
    total_tokens = sum(s.tokens_used for s in agent_trace)
    total_time = sum(s.duration_ms for s in agent_trace)

    return PredictionResult(
        company=result["company"],
        inquiry_probability=result["probability"],
        risk_level=result["risk_level"],
        confidence=round(result["probability"] * 0.95 + 0.02, 3),
        window_days=req.window_days,
        risk_factors=result["risk_factors"],
        shap_features=result["shap_features"],
        similar_cases=result["similar_cases"],
        agent_trace=agent_trace,
        report_markdown=result["report_markdown"],
        analysis_time_ms=total_time,
        llm_calls=sum(1 for s in agent_trace if s.tokens_used > 0),
        total_tokens=total_tokens,
    )


@router.post("/scan/batch")
async def scan_batch(req: BatchScanRequest):
    results = []
    for code in req.company_codes:
        r = get_full_prediction(code, req.window_days)
        if r:
            results.append({
                "company_code": code,
                "company_name": r["company"].name,
                "inquiry_probability": r["probability"],
                "risk_level": r["risk_level"].value,
                "top_risk_factor": r["risk_factors"][0].subcategory if r["risk_factors"] else "无",
            })
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
