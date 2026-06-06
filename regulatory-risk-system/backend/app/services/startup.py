"""
Startup / shutdown hooks.
- configure_logging()
- cleanup_zombie_scans(): mark active scan_records as failed on startup
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import select, update

from app.core.logging import get_logger
from app.database.session import async_session
from app.settings import settings

log = get_logger(__name__)


async def cleanup_zombie_scans() -> int:
    """Mark scan records that were 'running' when the process died as 'failed'.

    A scan is considered a zombie if it has been in 'running' state longer
    than `async_task_zombie_timeout_min` (default 2h).
    Returns the number of records marked as failed.
    """
    from app.database.models import ScanRecord  # local import to avoid cycle

    threshold = datetime.now(timezone.utc) - timedelta(
        minutes=settings.async_task_zombie_timeout_min
    )
    marked = 0
    try:
        async with async_session() as session:
            stmt = (
                update(ScanRecord)
                .where(
                    ScanRecord.status == "running",
                    ScanRecord.created_at < threshold,
                )
                .values(
                    status="failed",
                    error_message="zombie: process died or task did not complete",
                    completed_at=datetime.now(timezone.utc),
                )
            )
            result = await session.execute(stmt)
            await session.commit()
            marked = result.rowcount or 0
    except Exception as exc:
        log.warning("startup.zombie_cleanup_failed", error=str(exc))
        return 0
    if marked:
        log.info("startup.zombie_cleanup", marked=marked)
    else:
        log.info("startup.zombie_cleanup", marked=0, note="no zombies")
    return marked


async def record_startup_event(payload: dict[str, Any]) -> None:
    """Append a row to app_startup_event."""
    from app.database.models_observability import AppStartupEvent

    try:
        async with async_session() as session:
            session.add(AppStartupEvent(payload=payload, created_at=datetime.now(timezone.utc)))
            await session.commit()
    except Exception as exc:
        log.warning("startup.event_record_failed", error=str(exc))
