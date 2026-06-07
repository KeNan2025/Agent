"""
Database persistence layer.

Uses SQLAlchemy 2.x async; default sqlite for dev, PostgreSQL in production.

Persisted entities:
- ScanRecord: every scan invocation (input + final result)
- TraceLog: every TraceEvent emitted by the agent framework
- Checkpoint: ScanState snapshots after each node
- SkillCall: every MCP skill invocation (audit log)
- LLMUsageLog / AppStartupEvent: observability
- AsyncTask / ScheduledJob / ExperienceEvent: Phase 4 tasks & review
- User / UserCompanyPool: Phase 5 auth
"""
from .session import async_engine, async_session, init_db, get_session
from .models import ScanRecord, TraceLog, Checkpoint, SkillCall, SkillFile
from .repository import (
    ScanRepository, TraceRepository, CheckpointRepository,
    SkillRepository, SkillFileRepository,
)
# Eager-import the auxiliary model modules so all tables register with
# Base.metadata BEFORE init_db() is called by app.main:lifespan. Without
# this, table creation relies on router-import side effects, which is
# fragile (order-dependent and breaks under partial test imports).
from . import models_observability  # noqa: F401
from . import models_tasks  # noqa: F401
from . import models_users  # noqa: F401

__all__ = [
    "async_engine", "async_session", "init_db", "get_session",
    "ScanRecord", "TraceLog", "Checkpoint", "SkillCall", "SkillFile",
    "ScanRepository", "TraceRepository", "CheckpointRepository",
    "SkillRepository", "SkillFileRepository",
]
