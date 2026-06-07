"""Async SQLAlchemy session & engine."""
from __future__ import annotations

import os
from typing import Any, AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncSession, async_sessionmaker, create_async_engine,
)

from app.database.models import Base
from app.settings import settings

# Build engine from settings. Honour explicit env override (e.g. docker-compose)
_url = os.getenv("DATABASE_URL", settings.db.url)


def _is_sqlite(url: str) -> bool:
    return url.startswith("sqlite")


def _build_engine_kwargs(url: str) -> dict[str, Any]:
    """SQLite uses NullPool under aiosqlite — it doesn't accept the
    server-side pool tunables. Only pass them for real server drivers."""
    kw: dict[str, Any] = {"echo": False, "future": True}
    if _is_sqlite(url):
        # aiosqlite ships its own pool; pool_size / max_overflow / pool_recycle
        # are rejected by create_engine for the SQLite dialect.
        return kw
    kw.update({
        "pool_size": settings.db.pool_size,
        "max_overflow": settings.db.max_overflow,
        "pool_recycle": settings.db.pool_recycle,
        "pool_pre_ping": settings.db.pool_pre_ping,
    })
    return kw


async_engine = create_async_engine(_url, **_build_engine_kwargs(_url))

async_session = async_sessionmaker(
    async_engine, class_=AsyncSession, expire_on_commit=False,
)


async def init_db() -> None:
    """Create all tables (idempotent — Alembic is the source of truth in prod).

    `app.database.__init__` already eagerly imports models_observability /
    models_tasks / models_users so every Base subclass is registered with
    Base.metadata by the time we reach this call.
    """
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency."""
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()
