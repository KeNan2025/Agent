"""
Redis Pub/Sub — a thin wrapper used by AgentNode to push trace events
to subscribed WebSocket clients.

In dev (no REDIS_URL configured) this falls back to an in-process queue
so the API still works without external dependencies.
"""
from __future__ import annotations

import asyncio
import json
import os
from collections import defaultdict
from typing import Any

from app.core.logging import get_logger
from app.settings import settings

log = get_logger(__name__)

try:
    import redis.asyncio as aioredis  # type: ignore
except Exception:  # noqa: BLE001
    aioredis = None


class InMemoryPubSub:
    def __init__(self) -> None:
        self._subscribers: dict[str, set[asyncio.Queue]] = defaultdict(set)

    async def publish(self, channel: str, payload: dict[str, Any]) -> None:
        for q in list(self._subscribers.get(channel, ())):
            try:
                q.put_nowait(payload)
            except asyncio.QueueFull:  # noqa: PERF203
                pass

    async def subscribe(self, channel: str) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize=200)
        self._subscribers[channel].add(q)
        return q

    async def unsubscribe(self, channel: str, q: asyncio.Queue) -> None:
        self._subscribers[channel].discard(q)
        if not self._subscribers[channel]:
            self._subscribers.pop(channel, None)


class RedisPubSub:
    def __init__(self, url: str) -> None:
        if aioredis is None:
            raise RuntimeError("redis not installed")
        self.url = url
        self._client: Any | None = None
        # Keep strong references to relay tasks so they don't get GC'd
        # mid-flight (which can happen if the caller drops the queue ref).
        self._relay_tasks: set[asyncio.Task] = set()

    async def _get(self) -> Any:
        if self._client is None:
            self._client = aioredis.from_url(self.url, decode_responses=True)
        return self._client

    async def publish(self, channel: str, payload: dict[str, Any]) -> None:
        try:
            c = await self._get()
            await c.publish(channel, json.dumps(payload, ensure_ascii=False, default=str))
        except Exception as exc:  # noqa: BLE001
            log.warning("pubsub.publish_failed", channel=channel, error=str(exc))

    async def subscribe(self, channel: str) -> asyncio.Queue:
        c = await self._get()
        q: asyncio.Queue = asyncio.Queue(maxsize=200)
        pubsub = c.pubsub()
        await pubsub.subscribe(channel)

        async def relay() -> None:
            try:
                async for msg in pubsub.listen():
                    if msg.get("type") != "message":
                        continue
                    try:
                        data = json.loads(msg["data"])
                    except Exception:
                        continue
                    await q.put(data)
            except asyncio.CancelledError:
                pass
            finally:
                with __import__("contextlib").suppress(Exception):
                    await pubsub.unsubscribe(channel)
                    await pubsub.close()
        t = asyncio.create_task(relay())
        self._relay_tasks.add(t)
        t.add_done_callback(self._relay_tasks.discard)
        return q

    async def unsubscribe(self, channel: str, q: asyncio.Queue) -> None:
        # The relay task owns pubsub.unsubscribe; cancelling it will
        # trigger the `finally` cleanup.
        pass


def _build_pubsub() -> Any:
    redis_url = os.getenv("REDIS_URL", "")
    if aioredis is not None and redis_url:
        try:
            return RedisPubSub(redis_url)
        except Exception as exc:  # noqa: BLE001
            log.warning("pubsub.redis_init_failed", error=str(exc))
    return InMemoryPubSub()


_PUBSUB: Any | None = None


def get_pubsub() -> Any:
    global _PUBSUB
    if _PUBSUB is None:
        _PUBSUB = _build_pubsub()
    return _PUBSUB
