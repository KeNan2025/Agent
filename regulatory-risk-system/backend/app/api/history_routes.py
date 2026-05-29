"""Scan history & audit endpoints — query persisted ScanRecord/TraceLog."""
from __future__ import annotations

import json
from typing import Any

from fastapi import APIRouter
from fastapi.responses import PlainTextResponse

from app.database import ScanRepository, TraceRepository

router = APIRouter(prefix="/api/v1/history", tags=["history"])


@router.get("/scans")
async def list_scans(limit: int = 50) -> dict[str, Any]:
    repo = ScanRepository()
    rows = await repo.list_recent(limit)
    return {
        "total": len(rows),
        "scans": [
            {
                "scan_id": r.scan_id,
                "company_code": r.company_code,
                "window_days": r.window_days,
                "probability": r.probability,
                "risk_level": r.risk_level,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ],
    }


@router.get("/scans/by-company/{company_code}")
async def list_scans_by_company(company_code: str, limit: int = 20) -> dict[str, Any]:
    repo = ScanRepository()
    rows = await repo.list_by_company(company_code, limit)
    return {
        "company_code": company_code,
        "total": len(rows),
        "scans": [
            {
                "scan_id": r.scan_id,
                "window_days": r.window_days,
                "probability": r.probability,
                "risk_level": r.risk_level,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ],
    }


@router.get("/scans/{scan_id}/trace")
async def get_scan_trace(scan_id: str) -> dict[str, Any]:
    repo = TraceRepository()
    rows = await repo.list_for_scan(scan_id)
    return {
        "scan_id": scan_id,
        "events": [
            {
                "event_id": r.event_id,
                "node_name": r.node_name,
                "action": r.action,
                "input_summary": r.input_summary,
                "output_summary": r.output_summary,
                "skills_called": r.skills_called,
                "duration_ms": r.duration_ms,
                "tokens_used": r.tokens_used,
                "timestamp": r.timestamp.isoformat() if r.timestamp else None,
                "error": r.error,
            }
            for r in rows
        ],
    }


@router.get("/scans/{scan_id}/trace/export")
async def export_scan_trace(scan_id: str):
    """Export Agent trace as a downloadable JSON file."""
    repo = TraceRepository()
    rows = await repo.list_for_scan(scan_id)
    events = [
        {
            "event_id": r.event_id,
            "node_name": r.node_name,
            "action": r.action,
            "input_summary": r.input_summary,
            "output_summary": r.output_summary,
            "skills_called": r.skills_called,
            "duration_ms": r.duration_ms,
            "tokens_used": r.tokens_used,
            "timestamp": r.timestamp.isoformat() if r.timestamp else None,
            "error": r.error,
        }
        for r in rows
    ]
    content = json.dumps({"scan_id": scan_id, "events": events}, ensure_ascii=False, indent=2)
    return PlainTextResponse(
        content=content,
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="trace_{scan_id}.json"'},
    )
