"""
Task routes — query status of async tasks.
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException

from app.services.async_task_runner import get_task_runner

router = APIRouter(prefix="/api/v1/tasks", tags=["tasks"])


@router.get("/{task_id}")
async def get_task_status(task_id: str) -> dict[str, Any]:
    runner = get_task_runner()
    status = await runner.get_status(task_id)
    if status is None:
        raise HTTPException(status_code=404, detail=f"task {task_id} not found")
    return status
