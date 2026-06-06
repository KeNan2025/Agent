"""
ORM models for the async task runner, scheduled jobs, and experience
events (Phase 4).
"""
from __future__ import annotations

from datetime import date, datetime, timezone

from sqlalchemy import JSON, Boolean, Column, Date, DateTime, Float, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database.models import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class AsyncTask(Base):
    """One row per submitted background task."""
    __tablename__ = "async_task"

    task_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    scan_id: Mapped[str | None] = mapped_column(String(64), index=True, default=None)
    kind: Mapped[str] = mapped_column(String(32))  # scan / train / review / retrain
    status: Mapped[str] = mapped_column(String(16), default="pending", index=True)
    input_json: Mapped[str] = mapped_column(Text, default="{}")
    output_json: Mapped[str] = mapped_column(Text, default="{}")
    error_message: Mapped[str | None] = mapped_column(Text, default=None)
    started_at: Mapped[datetime | None] = mapped_column(DateTime, default=None)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, default=None)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)


class ScheduledJob(Base):
    """APScheduler registry mirror — what jobs are running on this instance."""
    __tablename__ = "scheduled_job"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(128))
    trigger_type: Mapped[str] = mapped_column(String(16))  # cron / interval
    trigger_args_json: Mapped[str] = mapped_column(Text, default="{}")
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    last_run_at: Mapped[datetime | None] = mapped_column(DateTime, default=None)
    next_run_at: Mapped[datetime | None] = mapped_column(DateTime, default=None)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)


class ExperienceEvent(Base):
    """One row per scan's experience-review lifecycle.

    state: pending_review → reviewed (label set) → (optional) written_to_memory
    """
    __tablename__ = "experience_event"

    event_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    scan_id: Mapped[str] = mapped_column(String(64), index=True)
    company_code: Mapped[str] = mapped_column(String(20), index=True)
    window_days: Mapped[int] = mapped_column(Integer, default=60)
    scan_date: Mapped[date | None] = mapped_column(Date, default=None)
    due_at: Mapped[date | None] = mapped_column(Date, index=True, default=None)
    predicted_probability: Mapped[float] = mapped_column(Float, default=0.0)
    predicted_risk_level: Mapped[str] = mapped_column(String(20), default="")
    label: Mapped[int | None] = mapped_column(Integer, default=None)  # 1=hit, 0=miss
    ground_truth_inquiry_id: Mapped[str | None] = mapped_column(String(64), default=None)
    state: Mapped[str] = mapped_column(String(20), default="pending_review")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime, default=None)
