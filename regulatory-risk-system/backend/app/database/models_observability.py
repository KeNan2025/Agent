"""
Observability ORM models:
- LLMUsageLog: every LLM call logs model, tokens, latency, request_id, etc.
- AppStartupEvent: app boot log
"""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database.models import Base  # Base lives in models.py, not session.py


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class LLMUsageLog(Base):
    """One row per LLM call (real or mock)."""
    __tablename__ = "llm_usage_log"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=_utcnow, index=True)
    request_id: Mapped[str | None] = mapped_column(String(64), index=True, nullable=True)
    scan_id: Mapped[str | None] = mapped_column(String(64), index=True, nullable=True)
    user_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    agent_name: Mapped[str | None] = mapped_column(String(64), index=True, nullable=True)
    role: Mapped[str | None] = mapped_column(String(64), nullable=True)
    model: Mapped[str] = mapped_column(String(128), nullable=False)
    mode: Mapped[str] = mapped_column(String(16), default="mock")
    prompt_tokens: Mapped[int] = mapped_column(Integer, default=0)
    completion_tokens: Mapped[int] = mapped_column(Integer, default=0)
    total_tokens: Mapped[int] = mapped_column(Integer, default=0)
    latency_ms: Mapped[int] = mapped_column(Integer, default=0)
    call_kind: Mapped[str | None] = mapped_column(String(32), nullable=True)
    turn_index: Mapped[int | None] = mapped_column(Integer, nullable=True)
    cache_lane: Mapped[str | None] = mapped_column(String(32), nullable=True)
    api_key_alias: Mapped[str | None] = mapped_column(String(64), nullable=True)
    success: Mapped[bool] = mapped_column(Boolean, default=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)


class AppStartupEvent(Base):
    """Boot event for diagnostics / audit."""
    __tablename__ = "app_startup_event"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow, index=True)
    payload: Mapped[str] = mapped_column(Text, default="{}")
