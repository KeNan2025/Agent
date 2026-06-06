"""
WebSocket manager — bridges Redis/in-memory Pub/Sub to connected clients.

Each scan has a dedicated channel `scan:{scan_id}`. Frontend connects
to `/ws/scan/{scan_id}` and receives trace events in real time.
"""
from __future__ import annotations

import asyncio
import json
import uuid
from typing import Any

from fastapi import WebSocket

from app.core.logging import get_logger
from app.services.pubsub import get_pubsub
from app.settings import settings

log = get_logger(__name__)


def issue_ticket(scan_id: str) -> str:
    """One-time WebSocket ticket.

    Phase 5 will tie this to a JWT user; for now we just generate a uuid
    stored in a short-lived in-process map.
    """
    ticket = uuid.uuid4().hex
    _TICKETS[ticket] = scan_id
    return ticket


_TICKETS: dict[str, str] = {}


def validate_ticket(ticket: str) -> str | None:
    return _TICKETS.pop(ticket, None)


async def ws_scan_endpoint(websocket: WebSocket, scan_id: str) -> None:
    """WebSocket endpoint: stream trace events for the given scan."""
    await websocket.accept()
    pubsub = get_pubsub()
    q = await pubsub.subscribe(f"scan:{scan_id}")
    log.info("ws.connected", scan_id=scan_id)
    try:
        while True:
            payload = await q.get()
            await websocket.send_text(json.dumps(payload, ensure_ascii=False, default=str))
    except Exception as exc:  # noqa: BLE001
        log.info("ws.disconnected", scan_id=scan_id, error=str(exc))
    finally:
        await pubsub.unsubscribe(f"scan:{scan_id}", q)
        with __import__("contextlib").suppress(Exception):
            await websocket.close()
