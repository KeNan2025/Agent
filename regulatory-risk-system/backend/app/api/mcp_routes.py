"""MCP Server endpoints — exposes registered Skills via JSON-RPC-like REST."""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.core import get_registry
from app.database import SkillRepository

router = APIRouter(prefix="/mcp/v1", tags=["mcp"])


class ToolCallRequest(BaseModel):
    name: str
    arguments: dict[str, Any] = Field(default_factory=dict)
    scan_id: str | None = None


@router.post("/tools/list")
async def list_tools() -> dict[str, Any]:
    """MCP tools/list — return all registered Skills with input schemas."""
    return {"tools": get_registry().to_mcp_list()}


@router.get("/tools/list")
async def list_tools_get() -> dict[str, Any]:
    """Convenience GET — same payload as POST tools/list."""
    return {"tools": get_registry().to_mcp_list()}


@router.post("/tools/call")
async def call_tool(req: ToolCallRequest) -> dict[str, Any]:
    """MCP tools/call — dispatch a single tool invocation."""
    reg = get_registry()
    sk = reg.get(req.name)
    if sk is None:
        raise HTTPException(status_code=404, detail=f"Unknown tool: {req.name}")
    result = reg.call(req.name, **req.arguments)
    # Persist call to audit log
    repo = SkillRepository()
    try:
        await repo.log_call(
            skill_name=req.name,
            input_json=req.arguments,
            output_json=result,
            duration_ms=int(result.get("duration_ms", 0)),
            success=bool(result.get("ok", False)),
            scan_id=req.scan_id,
        )
    except Exception:
        pass  # audit logging never blocks the response
    return result


@router.get("/tools/stats")
async def tools_stats(since_hours: int = 24) -> dict[str, Any]:
    repo = SkillRepository()
    stats = await repo.stats(since_hours)
    return {"window_hours": since_hours, "stats": stats}
