"""Digital twin API routes — market overview and pipeline status for the twin frontend."""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Query

from app.database import ScanRepository, TraceRepository
from app.mock_data.generator import get_all_predictions, get_all_companies

router = APIRouter(prefix="/api/v1/twin", tags=["digital-twin"])


@router.get("/market-overview")
async def market_overview(window_days: int = Query(60)) -> dict[str, Any]:
    """Aggregate risk distribution across all 200 monitored companies, grouped by industry."""
    preds = get_all_predictions(window_days)
    industry_map: dict[str, dict[str, Any]] = {}
    for p in preds:
        ind = p["company"].industry
        if ind not in industry_map:
            industry_map[ind] = {
                "industry": ind,
                "total": 0,
                "high": 0,
                "medium": 0,
                "low": 0,
                "prob_sum": 0.0,
                "companies": [],
            }
        slot = industry_map[ind]
        slot["total"] += 1
        level = p["risk_level"].value
        if level == "高风险":
            slot["high"] += 1
        elif level == "中风险":
            slot["medium"] += 1
        else:
            slot["low"] += 1
        slot["prob_sum"] += p["probability"]
        slot["companies"].append({
            "code": p["company"].code,
            "name": p["company"].name,
            "probability": p["probability"],
            "risk_level": level,
            "market_cap": p["company"].market_cap,
        })

    industries = []
    for slot in sorted(industry_map.values(), key=lambda s: -s["high"]):
        avg = slot["prob_sum"] / max(1, slot["total"])
        industries.append({
            "industry": slot["industry"],
            "total": slot["total"],
            "high": slot["high"],
            "medium": slot["medium"],
            "low": slot["low"],
            "avg_probability": round(avg, 4),
            "companies": sorted(slot["companies"], key=lambda c: -c["probability"]),
        })

    total_high = sum(s["high"] for s in industry_map.values())
    total_med = sum(s["medium"] for s in industry_map.values())
    total_low = sum(s["low"] for s in industry_map.values())
    total = len(preds)
    avg_all = sum(p["probability"] for p in preds) / max(1, total)

    return {
        "window_days": window_days,
        "total_companies": total,
        "total_high": total_high,
        "total_medium": total_med,
        "total_low": total_low,
        "avg_probability": round(avg_all, 4),
        "industries": industries,
    }


@router.get("/pipeline-status")
async def pipeline_status(limit: int = Query(5)) -> dict[str, Any]:
    """Return recent scan pipeline execution summaries for the pipeline twin view."""
    repo = ScanRepository()
    scans = await repo.list_recent(limit)
    trace_repo = TraceRepository()
    results = []
    for scan in scans:
        events = await trace_repo.list_for_scan(scan.scan_id)
        nodes = []
        for ev in events:
            nodes.append({
                "node_name": ev.node_name,
                "action": ev.action,
                "duration_ms": ev.duration_ms,
                "tokens_used": ev.tokens_used,
                "skills_called": ev.skills_called,
                "status": "error" if ev.error else "completed",
                "error": ev.error,
            })
        results.append({
            "scan_id": scan.scan_id,
            "company_code": scan.company_code,
            "probability": scan.probability,
            "risk_level": scan.risk_level,
            "created_at": scan.created_at.isoformat() if scan.created_at else None,
            "total_nodes": len(nodes),
            "total_duration_ms": sum(n["duration_ms"] for n in nodes),
            "total_tokens": sum(n["tokens_used"] for n in nodes),
            "nodes": nodes,
        })
    return {"total": len(results), "pipelines": results}
