"""
Observability ORM models:
- LLMUsageLog: every LLM call logs model, tokens, latency, request_id, etc.
- AppStartupEvent: app boot log
"""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Float, Integer, String, Text
from sqlalchemy.orm import Mapped

from app.database.session import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class LLMUsageLog(Base):
    """One row per LLM call (real or mock)."""
    __tablename__ = "llm_usage_log"

    id: Mapped[int] = Column(Integer, primary_key=True, autoincrement=True)
    timestamp: Mapped[datetime] = Column(DateTime, default=_utcnow, index=True)
    request_id: Mapped[str | None] = Column(String(64), index=True, nullable=True)
    scan_id: Mapped[str | None] = Column(String(64), index=True, nullable=True)
    user_id: Mapped[int | None] = Column(Integer, nullable=True)
    agent_name: Mapped[str | None] = Column(String(64), index=True, nullable=True)
    role: Mapped[str | None] = Column(String(64), nullable=True)
    model: Mapped[str] = Column(String(128), nullable=False)
    mode: Mapped[str] = Column(String(16), default="mock")  # mock / real
    prompt_tokens: Mapped[int] = Column(Integer, default=0)
    completion_tokens: Mapped[int] = Column(Integer, default=0)
    total_tokens: Mapped[int] = Column(Integer, default=0)
    latency_ms: Mapped[int] = Column(Integer, default=0)
    call_kind: Mapped[str | None] = Column(String(32), nullable=True)  # chat / tool / final
    turn_index: Mapped[int | None] = Column(Integer, nullable=True)
    cache_lane: Mapped[str | None] = Column(String(32), nullable=True)
    api_key_alias: Mapped[str | None] = Column(String(64), nullable=True)
    success: Mapped[bool] = Column(default=True)
    error_message: Mapped[str | None] = Column(Text, nullable=True)


class AppStartupEvent(Base):
    """Boot event for diagnostics / audit."""
    __tablename__ = "app_startup_event"

    id: Mapped[int] = Column(Integer, primary_key=True, autoincrement=True)
    created_at: Mapped[datetime] = Column(DateTime, default=_utcnow, index=True)
    payload: Mapped[str] = Column(Text, default="{}")
