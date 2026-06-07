"""
WebSocket manager — bridges Redis/in-memory Pub/Sub to connected clients.

Each scan has a dedicated channel `scan:{scan_id}`. Frontend connects
to `/ws/scan/{scan_id}?ticket=...` and receives trace events in real
time. Tickets are one-time, TTL-bound, and scoped to a specific scan_id.
"""
from __future__ import annotations

import asyncio
import json
import time
import uuid
from typing import Any

from fastapi import WebSocket, WebSocketDisconnect, status

from app.core.logging import get_logger
from app.services.pubsub import get_pubsub
from app.settings import settings

log = get_logger(__name__)


# ────────── Ticket store (in-memory, TTL-bound) ──────────
# Each ticket maps to {"scan_id": str, "issued_at": float}.

_TICKETS: dict[str, dict[str, Any]] = {}


def issue_ticket(scan_id: str) -> str:
    """Issue a one-time ticket bound to scan_id, valid for ws_ticket_ttl_sec."""
    ticket = uuid.uuid4().hex
    _TICKETS[ticket] = {"scan_id": scan_id, "issued_at": time.time()}
    # Opportunistic GC of expired tickets
    _gc_expired()
    return ticket


def validate_ticket(ticket: str, expected_scan_id: str | None = None) -> str | None:
    """Return the bound scan_id and consume the ticket; None if invalid/expired."""
    if not ticket:
        return None
    entry = _TICKETS.pop(ticket, None)
    if entry is None:
        return None
    if time.time() - entry["issued_at"] > settings.security.ws_ticket_ttl_sec:
        return None
    scan_id = entry["scan_id"]
    if expected_scan_id is not None and scan_id != expected_scan_id:
        return None
    return scan_id


def _gc_expired() -> None:
    now = time.time()
    ttl = settings.security.ws_ticket_ttl_sec
    stale = [t for t, e in _TICKETS.items() if now - e["issued_at"] > ttl]
    for t in stale:
        _TICKETS.pop(t, None)


# ────────── Endpoint ──────────


async def ws_scan_endpoint(
    websocket: WebSocket, scan_id: str, ticket: str | None = None,
) -> None:
    """Stream trace events for the given scan, gated by a valid ticket."""
    bound = validate_ticket(ticket or "", expected_scan_id=scan_id)
    if bound is None:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        log.warning("ws.rejected", reason="invalid_ticket", scan_id=scan_id)
        return

    await websocket.accept()
    pubsub = get_pubsub()
    q = await pubsub.subscribe(f"scan:{scan_id}")
    log.info("ws.connected", scan_id=scan_id)
    try:
        while True:
            payload = await q.get()
            await websocket.send_text(
                json.dumps(payload, ensure_ascii=False, default=str)
            )
    except WebSocketDisconnect:
        log.info("ws.disconnected", scan_id=scan_id)
    except Exception as exc:  # noqa: BLE001
        log.info("ws.error", scan_id=scan_id, error=str(exc))
    finally:
        try:
            await pubsub.unsubscribe(f"scan:{scan_id}", q)
        except Exception:  # noqa: BLE001
            pass
