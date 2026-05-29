"""ORM models for persistent storage."""
from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import JSON, Column, DateTime, Float, Integer, String, Text, Index
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class ScanRecord(Base):
    __tablename__ = "scan_records"

    scan_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    company_code: Mapped[str] = mapped_column(String(20), index=True)
    window_days: Mapped[int] = mapped_column(Integer)
    probability: Mapped[float] = mapped_column(Float)
    risk_level: Mapped[str] = mapped_column(String(20))
    risk_hypothesis: Mapped[str] = mapped_column(Text, default="[]")
    analysis_plan: Mapped[str] = mapped_column(Text, default="[]")
    full_state: Mapped[dict[str, Any] | None] = mapped_column(JSON, default=None)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)

    __table_args__ = (
        Index("ix_scan_company_created", "company_code", "created_at"),
    )


class TraceLog(Base):
    __tablename__ = "trace_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    scan_id: Mapped[str] = mapped_column(String(64), index=True)
    event_id: Mapped[str] = mapped_column(String(32))
    node_name: Mapped[str] = mapped_column(String(64))
    action: Mapped[str] = mapped_column(String(255))
    input_summary: Mapped[str] = mapped_column(Text)
    output_summary: Mapped[str] = mapped_column(Text)
    skills_called: Mapped[str] = mapped_column(Text, default="[]")
    duration_ms: Mapped[int] = mapped_column(Integer, default=0)
    tokens_used: Mapped[int] = mapped_column(Integer, default=0)
    error: Mapped[str | None] = mapped_column(Text, default=None)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)


class Checkpoint(Base):
    __tablename__ = "checkpoints"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    scan_id: Mapped[str] = mapped_column(String(64), index=True)
    node_name: Mapped[str] = mapped_column(String(64))
    state_json: Mapped[dict[str, Any]] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("ix_checkpoint_scan_node", "scan_id", "node_name"),
    )


class SkillCall(Base):
    __tablename__ = "skill_calls"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    scan_id: Mapped[str | None] = mapped_column(String(64), index=True, default=None)
    skill_name: Mapped[str] = mapped_column(String(64), index=True)
    input_json: Mapped[dict[str, Any]] = mapped_column(JSON)
    output_json: Mapped[dict[str, Any] | None] = mapped_column(JSON, default=None)
    duration_ms: Mapped[int] = mapped_column(Integer, default=0)
    success: Mapped[bool] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class SkillFile(Base):
    """User-uploaded skill files — scripts, configs, data files for Skills."""
    __tablename__ = "skill_files"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    filename: Mapped[str] = mapped_column(String(255))
    original_name: Mapped[str] = mapped_column(String(255))
    content_type: Mapped[str] = mapped_column(String(100), default="text/plain")
    size_bytes: Mapped[int] = mapped_column(Integer, default=0)
    content: Mapped[str] = mapped_column(Text, default="")
    skill_name: Mapped[str | None] = mapped_column(String(64), index=True, default=None)
    description: Mapped[str] = mapped_column(String(500), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
