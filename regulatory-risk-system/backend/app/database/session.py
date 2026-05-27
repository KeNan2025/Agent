"""Async SQLAlchemy session & engine."""
from __future__ import annotations

import os
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncSession, async_sessionmaker, create_async_engine,
)

from app.config import DATABASE_URL
from app.database.models import Base


_url = os.getenv("DATABASE_URL", DATABASE_URL)

async_engine = create_async_engine(_url, echo=False, future=True)
async_session = async_sessionmaker(
    async_engine, class_=AsyncSession, expire_on_commit=False,
)


async def init_db() -> None:
    """Create all tables (idempotent)."""
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency."""
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()
