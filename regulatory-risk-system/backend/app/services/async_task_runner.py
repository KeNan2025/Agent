"""
AsyncTaskRunner — in-process background task runner with semaphore-based
concurrency limit and DB-persisted status.

Modelled after BestAITrader's `AsyncTaskRunner` (in-process, no Celery
or Redis queue), but light-weight enough to start with no external
dependencies. The runner is created at FastAPI startup, lives for the
process lifetime, and is queried via `get_status(task_id)`.
"""
from __future__ import annotations

import asyncio
import json
import traceback
import uuid
from datetime import datetime, timezone
from typing import Any, Awaitable, Callable

from app.core.logging import get_logger
from app.database.models_tasks import AsyncTask
from app.database.session import async_session
from app.settings import settings

log = get_logger(__name__)


class AsyncTaskRunner:
    def __init__(self, max_concurrent: int | None = None) -> None:
        self.max_concurrent = max_concurrent or settings.async_task_max_concurrent
        self._semaphore = asyncio.Semaphore(self.max_concurrent)
        self._tasks: dict[str, asyncio.Task[Any]] = {}

    async def submit(
        self,
        coro_factory: Callable[[], Awaitable[Any]],
        *,
        kind: str = "scan",
        scan_id: str | None = None,
        input_payload: dict[str, Any] | None = None,
    ) -> str:
        """Submit a coroutine to run in the background; return a task_id."""
        task_id = f"task_{uuid.uuid4().hex[:12]}"
        now = datetime.now(timezone.utc)
        # Persist initial row
        try:
            async with async_session() as session:
                async with session.begin():
                    session.add(AsyncTask(
                        task_id=task_id, scan_id=scan_id, kind=kind,
                        status="pending",
                        input_json=json.dumps(input_payload or {}, ensure_ascii=False),
                        created_at=now,
                    ))
        except Exception as exc:  # noqa: BLE001
            log.warning("task.persist_failed", task_id=task_id, error=str(exc))
        # Launch
        t = asyncio.create_task(self._run(task_id, coro_factory))
        self._tasks[task_id] = t
        return task_id

    async def _run(self, task_id: str, coro_factory: Callable[[], Awaitable[Any]]) -> None:
        async with self._semaphore:
            await self._update_status(task_id, "running", started_at=datetime.now(timezone.utc))
            try:
                result = await coro_factory()
            except Exception as exc:  # noqa: BLE001
                log.warning("task.failed", task_id=task_id, error=str(exc))
                await self._update_status(
                    task_id, "failed",
                    error_message=f"{type(exc).__name__}: {exc}\n{traceback.format_exc()[:2000]}",
                    completed_at=datetime.now(timezone.utc),
                )
                return
            ok = True
            output = result if isinstance(result, dict) else {"result": str(result)}
            if isinstance(output, dict) and output.get("status") == "failed":
                ok = False
            await self._update_status(
                task_id, "completed" if ok else "failed",
                output_json=json.dumps(output, ensure_ascii=False, default=str),
                completed_at=datetime.now(timezone.utc),
            )
            log.info("task.completed", task_id=task_id, ok=ok)

    async def _update_status(
        self, task_id: str, status: str,
        *, started_at: datetime | None = None,
        completed_at: datetime | None = None,
        output_json: str | None = None,
        error_message: str | None = None,
    ) -> None:
        try:
            async with async_session() as session:
                async with session.begin():
                    row = await session.get(AsyncTask, task_id)
                    if row is None:
                        return
                    row.status = status
                    if started_at is not None:
                        row.started_at = started_at
                    if completed_at is not None:
                        row.completed_at = completed_at
                    if output_json is not None:
                        row.output_json = output_json
                    if error_message is not None:
                        row.error_message = error_message
        except Exception as exc:  # noqa: BLE001
            log.warning("task.update_status_failed", task_id=task_id, error=str(exc))

    async def get_status(self, task_id: str) -> dict[str, Any] | None:
        try:
            async with async_session() as session:
                row = await session.get(AsyncTask, task_id)
                if row is None:
                    return None
                return {
                    "task_id": row.task_id,
                    "kind": row.kind,
                    "status": row.status,
                    "input": json.loads(row.input_json or "{}"),
                    "output": json.loads(row.output_json or "{}"),
                    "error_message": row.error_message,
                    "created_at": row.created_at.isoformat() if row.created_at else None,
                    "started_at": row.started_at.isoformat() if row.started_at else None,
                    "completed_at": row.completed_at.isoformat() if row.completed_at else None,
                }
        except Exception as exc:  # noqa: BLE001
            log.warning("task.get_status_failed", task_id=task_id, error=str(exc))
            return None

    async def shutdown(self) -> None:
        for t in self._tasks.values():
            t.cancel()


# Global singleton; created at app startup
_RUNNER: AsyncTaskRunner | None = None


def get_task_runner() -> AsyncTaskRunner:
    global _RUNNER
    if _RUNNER is None:
        _RUNNER = AsyncTaskRunner()
    return _RUNNER
