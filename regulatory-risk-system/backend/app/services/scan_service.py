"""
ScanService — transactional scan orchestration.

Replaces the fire-and-forget `_persist_scan` in `app/api/routes.py`. The
service commits the entire scan (record + trace events + skill call log)
in a single DB transaction, so a crash mid-scan leaves either a complete
record or no record — never a half-written one.
"""
from __future__ import annotations

import json
import time
from typing import Any

from app.core.framework import Checkpointer, ScanState, Tracer
from app.core.logging import get_logger
from app.database.models import ScanRecord, SkillCall, TraceLog
from app.database.session import async_session
from app.services.report_quality import auto_attach_evidence, enforce_sections

log = get_logger(__name__)


class ScanService:
    """Owns the lifecycle of a single scan run."""

    def __init__(self, tracer: Tracer | None = None, checkpointer: Checkpointer | None = None):
        self.tracer = tracer or Tracer()
        self.checkpointer = checkpointer or Checkpointer()

    async def run_single(
        self,
        *,
        scan_id: str,
        company_code: str,
        window_days: int,
        probability: float,
        risk_level: str,
        risk_hypothesis: list[str],
        analysis_plan: list[str],
        state: ScanState,
    ) -> dict[str, Any]:
        """
        Persist the scan + trace + skill call audit in one transaction.
        Returns a summary dict (also written as `full_state` on the row).
        """
        # Final shape check + evidence attach on the report
        report_md = enforce_sections(
            state.report_markdown or "",
            risk_level=risk_level, probability=probability,
        )
        report_md = auto_attach_evidence(report_md, state.risk_factors or [])
        state.report_markdown = report_md

        try:
            async with async_session() as session:
                async with session.begin():
                    record = ScanRecord(
                        scan_id=scan_id,
                        company_code=company_code,
                        window_days=window_days,
                        probability=probability,
                        risk_level=risk_level,
                        risk_hypothesis=json.dumps(risk_hypothesis or [], ensure_ascii=False),
                        analysis_plan=json.dumps(analysis_plan or [], ensure_ascii=False),
                        full_state=state.model_dump(mode="json"),
                    )
                    session.add(record)
                    # Bulk-insert trace events
                    for ev in state.trace_events:
                        session.add(TraceLog(
                            scan_id=scan_id,
                            event_id=ev.event_id,
                            node_name=ev.node_name,
                            action=ev.action,
                            input_summary=ev.input_summary[:2000],
                            output_summary=ev.output_summary[:2000],
                            skills_called=json.dumps(ev.skills_called, ensure_ascii=False),
                            duration_ms=ev.duration_ms,
                            tokens_used=ev.tokens_used,
                            error=ev.error,
                        ))
                    # Best-effort: include any skill calls attached to the state
                    for sc in getattr(state, "skill_calls", []) or []:
                        session.add(SkillCall(
                            scan_id=scan_id,
                            skill_name=sc.get("skill_name", ""),
                            input_json=sc.get("input", {}),
                            output_json=sc.get("output", {}),
                            duration_ms=sc.get("duration_ms", 0),
                            success=1 if sc.get("ok") else 0,
                        ))
        except Exception as exc:  # noqa: BLE001
            log.warning("scan.persist_failed", scan_id=scan_id, error=str(exc))
            return {"ok": False, "error": str(exc), "scan_id": scan_id}

        # Also persist the latest checkpoint file (best-effort, non-blocking)
        try:
            self.checkpointer.save(state, "final")
        except Exception as exc:  # noqa: BLE001
            log.debug("scan.ckpt_skipped", error=str(exc))

        log.info("scan.persisted", scan_id=scan_id, company=company_code,
                 risk=risk_level, probability=round(probability, 4))
        return {
            "ok": True,
            "scan_id": scan_id,
            "company_code": company_code,
            "window_days": window_days,
            "probability": probability,
            "risk_level": risk_level,
            "trace_event_count": len(state.trace_events),
            "report_sections_ok": _check_sections(report_md),
        }


def _check_sections(md: str) -> bool:
    from app.services.report_quality import check_report_shape
    return check_report_shape(md).get("ok", False)
