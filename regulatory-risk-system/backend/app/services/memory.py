"""
MemoFlux long-term memory client.

Mirrors BestAITrader's `memory_client.py`. Wraps the upstream
`ghcr.io/marvekg/memoflux` service over HTTP. Sessions follow the
convention `user:{uid}:company:{code}` (or `user:{uid}:general` for
cross-company notes).
"""
from __future__ import annotations

import json
from typing import Any

import httpx

from app.core.logging import get_logger
from app.settings import settings

log = get_logger(__name__)


class MemoryServiceClient:
    def __init__(self, base_url: str | None = None, timeout: float | None = None) -> None:
        self.base_url = (base_url or settings.memory_service_base_url).rstrip("/")
        self.timeout = timeout or settings.memory_service_timeout_sec

    @property
    def _client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(base_url=self.base_url, timeout=self.timeout)

    async def write_memory(
        self, session: str, content: str, *,
        occurred_at: str | None = None, importance: float = 0.5,
    ) -> dict[str, Any]:
        try:
            async with self._client as c:
                r = await c.post("/v1/ingest", json={
                    "session": session, "content": content,
                    "occurred_at": occurred_at, "importance": importance,
                })
                r.raise_for_status()
                return r.json()
        except Exception as exc:  # noqa: BLE001
            log.warning("memoflux.write_failed", session=session, error=str(exc))
            return {"ok": False, "error": str(exc)}

    async def recall_memory(
        self, session: str, query: str, *, top_k: int = 5,
    ) -> list[dict[str, Any]]:
        try:
            async with self._client as c:
                r = await c.post("/v1/recall", json={
                    "session": session, "query": query, "top_k": top_k,
                })
                r.raise_for_status()
                return r.json().get("items", [])
        except Exception as exc:  # noqa: BLE001
            log.warning("memoflux.recall_failed", session=session, error=str(exc))
            return []

    async def health(self) -> bool:
        try:
            async with self._client as c:
                r = await c.get("/v1/health", timeout=2.0)
                return r.status_code == 200
        except Exception:
            return False


# 5 standard memory topics for the regulatory risk business
MEMORY_TOPICS = [
    "FINANCIAL_PATTERN",      # 公司财务异常历史
    "GOVERNANCE_EVENT",       # 高管 / 控股股东事件
    "DISCLOSURE_HISTORY",     # 历史信披问题
    "RELATED_TX_NETWORK",     # 关联交易网络变化
    "CASE_PATTERN",           # 该公司命中 / 未命中复盘
]


def build_session(user_id: int, company_code: str | None = None) -> str:
    if company_code:
        return f"user:{user_id}:company:{company_code}"
    return f"user:{user_id}:general"
