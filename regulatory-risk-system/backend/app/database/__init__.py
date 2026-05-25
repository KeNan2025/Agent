"""
Database persistence layer.

Uses SQLAlchemy 2.x async with SQLite by default (PostgreSQL in production via
DATABASE_URL env var).

Persisted entities:
- ScanRecord: every scan invocation (input + final result)
- TraceLog: every TraceEvent emitted by the agent framework
- Checkpoint: ScanState snapshots after each node
- SkillCall: every MCP skill invocation (audit log)
"""
from .session import async_engine, async_session, init_db, get_session
from .models import ScanRecord, TraceLog, Checkpoint, SkillCall
from .repository import ScanRepository, TraceRepository, CheckpointRepository, SkillRepository

__all__ = [
    "async_engine", "async_session", "init_db", "get_session",
    "ScanRecord", "TraceLog", "Checkpoint", "SkillCall",
    "ScanRepository", "TraceRepository", "CheckpointRepository", "SkillRepository",
]
