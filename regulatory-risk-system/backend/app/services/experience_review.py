"""
Experience review worker — periodically checks pending experience events
and, for each, decides whether the prediction was right by inspecting
the local competition dataset for an actual inquiry letter in the
predicted window.

Modelled after BestAITrader's `experience_review` worker, but uses the
local `DataLoader` instead of Tushare (per project decision). The CQRS
event table pattern is preserved: a single `experience_event` row
encodes the lifecycle of one review.
"""
from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Any

from app.core.logging import get_logger
from app.data import DataLoader, is_inquiry_hit
from app.database.models_tasks import ExperienceEvent
from app.database.session import async_session

log = get_logger(__name__)


async def record_pending(
    *,
    scan_id: str,
    company_code: str,
    window_days: int,
    scan_date: date | None,
    predicted_probability: float,
    predicted_risk_level: str,
) -> str:
    """Create a new `experience_event` row in `pending_review` state."""
    if scan_date is None:
        scan_date = datetime.now(timezone.utc).date()
    event_id = f"exp_{uuid.uuid4().hex[:12]}"
    try:
        async with async_session() as session:
            async with session.begin():
                session.add(ExperienceEvent(
                    event_id=event_id,
                    scan_id=scan_id,
                    company_code=company_code,
                    window_days=window_days,
                    scan_date=scan_date,
                    due_at=scan_date + timedelta(days=window_days),
                    predicted_probability=predicted_probability,
                    predicted_risk_level=predicted_risk_level,
                    state="pending_review",
                    created_at=datetime.now(timezone.utc),
                ))
    except Exception as exc:  # noqa: BLE001
        log.warning("experience.record_failed", error=str(exc))
    return event_id


async def review_pending_events(loader: DataLoader | None = None) -> dict[str, int]:
    """One pass: for each pending event with due_at <= today, compute label.

    Returns counts: {reviewed, hit, miss, skipped, errors}.
    """
    loader = loader or DataLoader()
    today = datetime.now(timezone.utc).date()
    counts = {"reviewed": 0, "hit": 0, "miss": 0, "skipped": 0, "errors": 0}
    try:
        async with async_session() as session:
            # Read pending events due today or earlier
            from sqlalchemy import select
            stmt = select(ExperienceEvent).where(
                ExperienceEvent.state == "pending_review",
                ExperienceEvent.due_at != None,  # noqa: E711
                ExperienceEvent.due_at <= today,
            )
            result = await session.execute(stmt)
            pending = result.scalars().all()

            # Phase 5b: lazy-create a MemoryServiceClient once per pass.
            memory_client = None
            try:
                from app.services.memory import MemoryServiceClient, build_session
                from app.settings import settings as _settings
                if _settings.features.enable_memo_flux:
                    memory_client = MemoryServiceClient()
            except Exception:  # noqa: BLE001
                memory_client = None

            for ev in pending:
                if not ev.scan_date or not ev.company_code:
                    counts["skipped"] += 1
                    continue
                hit, gid = is_inquiry_hit(
                    ev.company_code, ev.scan_date.isoformat(), ev.window_days, loader=loader,
                )
                ev.label = 1 if hit else 0
                ev.ground_truth_inquiry_id = gid
                ev.state = "reviewed"
                ev.reviewed_at = datetime.now(timezone.utc)
                counts["reviewed"] += 1
                counts["hit" if hit else "miss"] += 1

                # Phase 5b: write the verified outcome back to long-term memory
                if memory_client is not None:
                    try:
                        from app.services.memory import build_session  # noqa: F811
                        session_key = build_session(user_id=0, company_code=ev.company_code)
                        content = (
                            f"[CASE_PATTERN reviewed] scan_date={ev.scan_date} "
                            f"window={ev.window_days}d "
                            f"predicted={ev.predicted_probability:.2f} "
                            f"actual={'问询命中' if hit else '未命中'} "
                            f"inquiry_id={gid or '-'}"
                        )
                        await memory_client.write_memory(session_key, content)
                    except Exception:  # noqa: BLE001
                        pass

            await session.commit()
    except Exception as exc:  # noqa: BLE001
        log.warning("experience.review_failed", error=str(exc))
        counts["errors"] += 1
    log.info("experience.review_pass", **counts)
    return counts


async def get_event(event_id: str) -> dict[str, Any] | None:
    try:
        async with async_session() as session:
            from sqlalchemy import select
            stmt = select(ExperienceEvent).where(ExperienceEvent.event_id == event_id)
            row = (await session.execute(stmt)).scalar_one_or_none()
            if row is None:
                return None
            return {
                "event_id": row.event_id,
                "scan_id": row.scan_id,
                "company_code": row.company_code,
                "window_days": row.window_days,
                "scan_date": row.scan_date.isoformat() if row.scan_date else None,
                "due_at": row.due_at.isoformat() if row.due_at else None,
                "predicted_probability": row.predicted_probability,
                "predicted_risk_level": row.predicted_risk_level,
                "label": row.label,
                "ground_truth_inquiry_id": row.ground_truth_inquiry_id,
                "state": row.state,
                "created_at": row.created_at.isoformat() if row.created_at else None,
                "reviewed_at": row.reviewed_at.isoformat() if row.reviewed_at else None,
            }
    except Exception as exc:  # noqa: BLE001
        log.warning("experience.get_event_failed", error=str(exc))
        return None
