"""
ASGI middleware: Request ID injection + access logging.
"""
from __future__ import annotations

import time
import uuid
from typing import Awaitable, Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.logging import bind_request_id, get_logger
from app.settings import settings

log = get_logger(__name__)

_REQUEST_ID_HEADER = "X-Request-ID"

# Sensitive query keys to redact in access log
_SENSITIVE_KEYS = {
    "access_token", "api_key", "password", "secret", "token",
    "authorization", "auth", "pwd", "key", "credential", "credentials",
}


def _sanitize_query(qs: str) -> str:
    if not qs:
        return ""
    if len(qs) > 1024:
        qs = qs[:1024] + "…"
    parts = []
    for kv in qs.split("&")[:50]:
        k, _, v = kv.partition("=")
        if k.lower() in _SENSITIVE_KEYS:
            parts.append(f"{k}=[REDACTED]")
        else:
            parts.append(kv)
    return "&".join(parts)


class RequestIDMiddleware(BaseHTTPMiddleware):
    """Attach a request id to every request for trace correlation."""

    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        rid = request.headers.get(_REQUEST_ID_HEADER) or uuid.uuid4().hex[:16]
        bind_request_id(rid)
        response = await call_next(request)
        response.headers[_REQUEST_ID_HEADER] = rid
        return response


class LoggingMiddleware(BaseHTTPMiddleware):
    """Access log: method, path, status, latency_ms, client_ip."""

    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        if not settings.obs.enable_access_log:
            return await call_next(request)
        start = time.perf_counter()
        try:
            response = await call_next(request)
            status = response.status_code
        except Exception as exc:
            latency_ms = (time.perf_counter() - start) * 1000
            log.exception(
                "http.error",
                method=request.method,
                path=request.url.path,
                latency_ms=round(latency_ms, 1),
                error=str(exc),
            )
            raise
        latency_ms = (time.perf_counter() - start) * 1000
        log.info(
            "http.access",
            method=request.method,
            path=request.url.path,
            query=_sanitize_query(request.url.query or ""),
            status=status,
            latency_ms=round(latency_ms, 1),
            client_ip=(request.client.host if request.client else None),
        )
        return response
