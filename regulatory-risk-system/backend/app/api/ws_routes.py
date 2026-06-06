"""
WebSocket routes — live trace push.
"""
from __future__ import annotations

from fastapi import APIRouter, WebSocket

from app.core.logging import get_logger
from app.services.ws_manager import ws_scan_endpoint

log = get_logger(__name__)

router = APIRouter()


@router.websocket("/ws/scan/{scan_id}")
async def ws_scan(websocket: WebSocket, scan_id: str) -> None:
    """Stream real-time trace events for the given scan."""
    await ws_scan_endpoint(websocket, scan_id)
