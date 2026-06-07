"""
Structured logging (structlog) with Request ID context.

Usage:
    from app.core.logging import get_logger, bind_request_id
    log = get_logger(__name__)
    bind_request_id("req-abc-123")
    log.info("scan.started", company_code="600000")
"""
from __future__ import annotations

import logging
import sys
from contextvars import ContextVar
from typing import Any, Optional

import structlog

from app.settings import settings

_request_id_var: ContextVar[Optional[str]] = ContextVar("request_id", default=None)


def bind_request_id(request_id: str) -> None:
    _request_id_var.set(request_id)


def get_request_id() -> Optional[str]:
    return _request_id_var.get()


def _add_request_id(_, __, event_dict: dict) -> dict:
    rid = get_request_id()
    if rid:
        event_dict["request_id"] = rid
    return event_dict


def configure_logging() -> None:
    """Initialize structlog + stdlib logging. Idempotent."""
    level = getattr(logging, settings.obs.log_level.upper(), logging.INFO)

    timestamper = structlog.processors.TimeStamper(fmt="iso", utc=True)

    # NOTE: `add_logger_name` requires the underlying logger to be a
    # stdlib `logging.Logger` (it reads `.name`). We use
    # `PrintLoggerFactory` for zero-dependency printing, whose
    # `PrintLogger` does NOT expose `.name`. So we skip that processor.
    shared_processors: list[Any] = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_log_level,
        _add_request_id,
        timestamper,
        structlog.processors.StackInfoRenderer(),
    ]

    if settings.obs.json_logs:
        # Production: JSON
        processors = shared_processors + [
            structlog.processors.format_exc_info,
            structlog.processors.JSONRenderer(),
        ]
    else:
        # Development: colored console
        processors = shared_processors + [
            structlog.dev.set_exc_info,
            structlog.dev.ConsoleRenderer(colors=True),
        ]

    structlog.configure(
        processors=processors,
        wrapper_class=structlog.make_filtering_bound_logger(level),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(file=sys.stdout),
        # IMPORTANT: do NOT cache. Module-level `log = get_logger(__name__)`
        # calls fire BEFORE configure_logging() runs from lifespan; caching
        # would freeze them onto the *default* (stdlib-flavoured) processor
        # chain, which includes `add_logger_name` and crashes on the
        # PrintLogger backend used here.
        cache_logger_on_first_use=False,
    )

    # Configure stdlib logging to also use a simple stream handler so
    # 3rd-party libs (uvicorn, sqlalchemy, etc.) keep printing without
    # interfering with structlog.
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter("%(message)s"))
    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(level)


def get_logger(name: str | None = None) -> structlog.stdlib.BoundLogger:
    """Return a structlog logger bound to the given name."""
    return structlog.get_logger(name)


# Configure once at import time so any module-level `log = get_logger(...)`
# (called BEFORE lifespan runs) is already bound to the correct processor
# chain. `configure_logging()` may be invoked again from lifespan to pick
# up env-driven overrides.
configure_logging()
