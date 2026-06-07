"""Async SQLAlchemy session & engine."""
from __future__ import annotations

from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncSession, async_sessionmaker, create_async_engine,
)

from app.database.models import Base
from app.settings import settings

# Build engine from settings. Honour explicit env override (e.g. docker-compose)
import os
_url = os.getenv("DATABASE_URL", settings.db.url)

async_engine = create_async_engine(
    _url,
    echo=False,
    future=True,
    pool_size=settings.db.pool_size,
    max_overflow=settings.db.max_overflow,
    pool_recycle=settings.db.pool_recycle,
    pool_pre_ping=settings.db.pool_pre_ping,
)

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
