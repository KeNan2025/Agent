"""
APScheduler wrapper — registers periodic jobs (training, experience
review, zombie cleanup). Started at FastAPI lifespan.
"""
from __future__ import annotations

import asyncio
import json
from datetime import datetime, timezone
from typing import Callable

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

from app.core.logging import get_logger
from app.database.models_tasks import ScheduledJob
from app.database.session import async_session
from app.services.experience_review import review_pending_events
from app.settings import settings

log = get_logger(__name__)


_scheduler: AsyncIOScheduler | None = None


def get_scheduler() -> AsyncIOScheduler:
    global _scheduler
    if _scheduler is None:
        _scheduler = AsyncIOScheduler(timezone="Asia/Shanghai")
    return _scheduler


async def _persist_job(job_id: str, name: str, trigger_type: str, trigger_args: dict) -> None:
    try:
        async with async_session() as session:
            async with session.begin():
                row = await session.get(ScheduledJob, job_id)
                if row is None:
                    session.add(ScheduledJob(
                        id=job_id, name=name,
                        trigger_type=trigger_type,
                        trigger_args_json=json.dumps(trigger_args, ensure_ascii=False),
                        enabled=True,
                        created_at=datetime.now(timezone.utc),
                    ))
    except Exception as exc:  # noqa: BLE001
        log.warning("scheduler.persist_failed", job_id=job_id, error=str(exc))


def register_default_jobs() -> None:
    """Register the three core jobs. Idempotent."""
    sched = get_scheduler()

    # 1. Experience review — every hour
    sched.add_job(
        review_pending_events,
        trigger=IntervalTrigger(hours=1),
        id="experience_review",
        name="Experience Review (hourly)",
        replace_existing=True,
        coalesce=True,
        max_instances=1,
    )
    # 2. Zombie cleanup — every 30 minutes (defensive)
    async def _zombie_loop() -> None:
        from app.services.startup import cleanup_zombie_scans
        await cleanup_zombie_scans()
    sched.add_job(
        _zombie_loop,
        trigger=IntervalTrigger(minutes=30),
        id="zombie_cleanup",
        name="Zombie scan cleanup",
        replace_existing=True,
        coalesce=True,
        max_instances=1,
    )
    # 3. Weekly retrain reminder — Sunday 03:00
    async def _retrain_log() -> None:
        log.info("scheduler.retrain_due")
    sched.add_job(
        _retrain_log,
        trigger=CronTrigger(day_of_week="sun", hour=3, minute=0),
        id="weekly_retrain_log",
        name="Weekly retrain reminder",
        replace_existing=True,
        coalesce=True,
        max_instances=1,
    )
    log.info("scheduler.default_jobs_registered")


def start_scheduler() -> None:
    sched = get_scheduler()
    if not sched.running:
        register_default_jobs()
        sched.start()
        # Persist registry mirror (best-effort, fire-and-forget)
        try:
            loop = asyncio.get_event_loop()
            loop.create_task(_persist_job("experience_review", "Experience Review (hourly)", "interval", {"hours": 1}))
            loop.create_task(_persist_job("zombie_cleanup", "Zombie scan cleanup", "interval", {"minutes": 30}))
            loop.create_task(_persist_job("weekly_retrain_log", "Weekly retrain reminder", "cron", {"day_of_week": "sun", "hour": 3}))
        except Exception:
            pass
        log.info("scheduler.started", job_count=len(sched.get_jobs()))


def stop_scheduler() -> None:
    sched = get_scheduler()
    if sched.running:
        sched.shutdown(wait=False)
        log.info("scheduler.stopped")
