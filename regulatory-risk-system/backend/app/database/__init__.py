"""
Database persistence layer.

Uses SQLAlchemy 2.x async; default sqlite for dev, PostgreSQL in production.

Persisted entities:
- ScanRecord: every scan invocation (input + final result)
- TraceLog: every TraceEvent emitted by the agent framework
- Checkpoint: ScanState snapshots after each node
- SkillCall: every MCP skill invocation (audit log)
- LLMUsageLog / AppStartupEvent: observability
"""
from .session import async_engine, async_session, init_db, get_session
from .models import ScanRecord, TraceLog, Checkpoint, SkillCall, SkillFile
from .repository import (
    ScanRepository, TraceRepository, CheckpointRepository,
    SkillRepository, SkillFileRepository,
)

__all__ = [
    "async_engine", "async_session", "init_db", "get_session",
    "ScanRecord", "TraceLog", "Checkpoint", "SkillCall", "SkillFile",
    "ScanRepository", "TraceRepository", "CheckpointRepository",
    "SkillRepository", "SkillFileRepository",
]
