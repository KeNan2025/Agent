"""
WebSocket routes — live trace push, gated by a one-time ticket.
"""
from __future__ import annotations

from fastapi import APIRouter, Query, WebSocket

from app.core.logging import get_logger
from app.services.ws_manager import ws_scan_endpoint

log = get_logger(__name__)

router = APIRouter()


@router.websocket("/ws/scan/{scan_id}")
async def ws_scan(
    websocket: WebSocket, scan_id: str, ticket: str = Query(default=""),
) -> None:
    """Stream real-time trace events for the given scan.

    Ticket must be obtained from `GET /api/v1/auth/ws-ticket/{scan_id}`
    and is one-time use within `settings.security.ws_ticket_ttl_sec`.
    """
    await ws_scan_endpoint(websocket, scan_id, ticket=ticket)
