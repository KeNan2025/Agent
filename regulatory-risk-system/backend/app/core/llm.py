"""
LLM client abstraction.

Provides:
- MockLLMClient (deterministic, default for demo/tests)
- OpenAICompatibleClient (real, for Qwen/DeepSeek/OpenAI)
- tool-calling support via `chat_with_tools` (Phase 2)
- structured output support via `complete_with_schema`
- automatic LLMUsageLog persistence (Phase 1)

Switching modes is driven by `LLM_MODE` env (or settings.llm.mode).
"""
from __future__ import annotations

import asyncio
import hashlib
import json
import os
import time
from abc import ABC, abstractmethod
from contextlib import suppress
from dataclasses import dataclass, field
from typing import Any, Optional

from app.core.logging import get_logger, get_request_id
from app.settings import settings

log = get_logger(__name__)


# ─────────────────────────── Response ───────────────────────────


@dataclass
class ToolCall:
    """A single tool call emitted by the LLM."""
    id: str
    name: str
    arguments: dict[str, Any]


@dataclass
class LLMResponse:
    text: str = ""
    tool_calls: list[ToolCall] = field(default_factory=list)
    tokens_used: int = 0
    prompt_tokens: int = 0
    completion_tokens: int = 0
    model: str = ""
    latency_ms: int = 0
    raw: Any = None
    finish_reason: str = ""

    def parse_json(self) -> Any:
        """Try to parse text as JSON; tolerant of code fences."""
        txt = self.text.strip()
        if txt.startswith("```"):
            lines = txt.splitlines()
            if lines and lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].startswith("```"):
                lines = lines[:-1]
            txt = "\n".join(lines)
        return json.loads(txt)


# ─────────────────────────── Abstract ───────────────────────────


class LLMClient(ABC):
    name: str = "abstract"

    @abstractmethod
    async def chat(
        self,
        messages: list[dict[str, Any]],
        *,
        temperature: float = 0.0,
        max_tokens: int = 1024,
        response_format: Optional[dict[str, Any]] = None,
    ) -> LLMResponse:
        ...

    async def complete(self, prompt: str, **kwargs: Any) -> LLMResponse:
        return await self.chat([{"role": "user", "content": prompt}], **kwargs)

    async def chat_with_tools(
        self,
        messages: list[dict[str, Any]],
        tools: list[dict[str, Any]],
        *,
        temperature: float = 0.0,
        max_tokens: int = 2048,
        tool_choice: str | dict[str, Any] = "auto",
    ) -> LLMResponse:
        """Default: tools ignored, fall back to chat. Real client overrides."""
        return await self.chat(messages, temperature=temperature, max_tokens=max_tokens)


# ─────────────────────────── Mock LLM ───────────────────────────


class MockLLMClient(LLMClient):
    """
    Deterministic mock LLM. Returns templated responses based on prompt keywords.
    Supports tool-calling in mock mode for tests:
    - if `tools` provided and last user msg contains keyword like 'tool:financial_calc'
      the mock returns a synthetic ToolCall so BaseAgent main loop can be tested.
    """

    name = "mock"

    async def chat(
        self,
        messages: list[dict[str, Any]],
        *,
        temperature: float = 0.0,
        max_tokens: int = 1024,
        response_format: Optional[dict[str, Any]] = None,
    ) -> LLMResponse:
        joined = "\n".join(
            m.get("content", "") for m in messages if m.get("role") == "user"
        )
        seed = int(hashlib.md5(joined.encode("utf-8")).hexdigest()[:8], 16)
        text = self._template(joined, seed)
        return LLMResponse(
            text=text,
            tokens_used=min(max_tokens, max(100, len(text) // 2)),
            prompt_tokens=max(50, len(joined) // 3),
            completion_tokens=max(50, len(text) // 3),
            model="mock-llm",
            latency_ms=50,
        )

    async def chat_with_tools(
        self,
        messages: list[dict[str, Any]],
        tools: list[dict[str, Any]],
        *,
        temperature: float = 0.0,
        max_tokens: int = 2048,
        tool_choice: str | dict[str, Any] = "auto",
    ) -> LLMResponse:
        """Mock tool-calling:
        - if any tool name appears in the last user message, emit one ToolCall
        - else fall through to plain chat
        """
        last_user = next(
            (m for m in reversed(messages) if m.get("role") == "user"),
            {"content": ""},
        )
        last_text = (last_user.get("content") or "").lower()
        for tool in tools or []:
            fn = (tool.get("function") or {}).get("name") or tool.get("name")
            if fn and fn.lower().split(".")[-1] in last_text:
                args = self._default_args_for(tool)
                return LLMResponse(
                    text="",
                    tool_calls=[ToolCall(id="mock-tc-1", name=fn, arguments=args)],
                    tokens_used=200,
                    prompt_tokens=200,
                    completion_tokens=80,
                    model="mock-llm",
                    latency_ms=80,
                    finish_reason="tool_calls",
                )
        return await self.chat(messages, temperature=temperature, max_tokens=max_tokens)

    def _default_args_for(self, tool: dict[str, Any]) -> dict[str, Any]:
        fn = (tool.get("function") or {})
        params = (fn.get("parameters") or {}).get("properties") or {}
        required = (fn.get("parameters") or {}).get("required") or []
        out: dict[str, Any] = {}
        for k in required:
            t = (params.get(k) or {}).get("type", "string")
            out[k] = 0 if t in ("number", "integer") else (False if t == "boolean" else ([] if t == "array" else ""))
        return out

    def _template(self, prompt: str, seed: int) -> str:
        if "risk_hypothesis" in prompt or "风险假设" in prompt:
            choices = [
                ["财务异常", "信息披露"],
                ["关联交易", "资金问题"],
                ["公司治理", "财务异常"],
                ["经营合理性"],
            ]
            return json.dumps({"hypothesis": choices[seed % len(choices)]}, ensure_ascii=False)
        if "judge" in prompt.lower() or "评估" in prompt:
            return json.dumps({
                "scores": {
                    "accuracy": 86 + (seed % 8),
                    "evidence": 88 + (seed % 6),
                    "logic": 84 + (seed % 10),
                    "cases": 82 + (seed % 8),
                    "utility": 80 + (seed % 12),
                },
                "weighted_total": 85 + (seed % 7),
                "issues": [],
                "suggestions": ["可进一步细化证据片段定位"],
            }, ensure_ascii=False)
        if "attribution" in prompt or "归因" in prompt:
            return (
                "基于多维度分析，该公司在财务指标、公告语义、关联关系等方面存在异常信号。"
                "核心驱动因素包括收入确认异常、关联交易扩大以及现金流偏离等。"
                "结合历史同类问询案例，监管关注概率较高，建议密切关注后续披露。"
            )
        if "extract" in prompt or "抽取" in prompt:
            return json.dumps({
                "risk_factors": [
                    {
                        "category": "财务异常",
                        "subcategory": "收入确认异常",
                        "description": "应收增速远超收入增速",
                        "evidence_quote": "本期营业收入较上年同期增长45.2%",
                        "evidence_source": "2024年年报 P28",
                        "severity": "高",
                        "confidence": 0.88,
                    }
                ]
            }, ensure_ascii=False)
        return "已完成分析，请查看具体结果。"


# ─────────────────────────── OpenAI-Compatible Client ───────────────────────────


class OpenAICompatibleClient(LLMClient):
    """Calls any OpenAI-compatible Chat Completions endpoint (incl. LiteLLM Gateway)."""

    def __init__(
        self,
        api_key: str,
        base_url: str,
        model: str = "qwen-plus",
        timeout: float = 30.0,
    ):
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.timeout = timeout
        self.name = f"openai-compat:{model}"
        self._async_client: Any = None

    def _get_async_client(self) -> Any:
        if self._async_client is None:
            try:
                import httpx
            except ImportError as exc:
                raise RuntimeError("httpx is required for OpenAICompatibleClient") from exc
            self._async_client = httpx.AsyncClient(timeout=self.timeout)
        return self._async_client

    async def chat(
        self,
        messages: list[dict[str, Any]],
        *,
        temperature: float = 0.0,
        max_tokens: int = 1024,
        response_format: Optional[dict[str, Any]] = None,
    ) -> LLMResponse:
        payload: dict[str, Any] = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if response_format:
            payload["response_format"] = response_format
        return await self._post(payload, tools=None, tool_choice=None)

    async def chat_with_tools(
        self,
        messages: list[dict[str, Any]],
        tools: list[dict[str, Any]],
        *,
        temperature: float = 0.0,
        max_tokens: int = 2048,
        tool_choice: str | dict[str, Any] = "auto",
    ) -> LLMResponse:
        payload: dict[str, Any] = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if tools:
            payload["tools"] = tools
            payload["tool_choice"] = tool_choice
        return await self._post(payload, tools=tools, tool_choice=tool_choice)

    async def _post(
        self,
        payload: dict[str, Any],
        *,
        tools: list[dict[str, Any]] | None,
        tool_choice: Any,
    ) -> LLMResponse:
        try:
            import httpx
        except ImportError as exc:
            raise RuntimeError("httpx is required for OpenAICompatibleClient") from exc

        url = f"{self.base_url}/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        start = time.time()
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.post(url, json=payload, headers=headers)
            resp.raise_for_status()
            data = resp.json()
        latency_ms = int((time.time() - start) * 1000)
        choice = data["choices"][0]
        msg = choice["message"]
        text = msg.get("content") or ""
        tool_calls: list[ToolCall] = []
        for tc in msg.get("tool_calls") or []:
            try:
                args = json.loads(tc["function"]["arguments"])
            except Exception:
                args = {}
            tool_calls.append(ToolCall(id=tc.get("id", ""), name=tc["function"]["name"], arguments=args))
        usage = data.get("usage", {}) or {}
        return LLMResponse(
            text=text,
            tool_calls=tool_calls,
            tokens_used=usage.get("total_tokens", 0),
            prompt_tokens=usage.get("prompt_tokens", 0),
            completion_tokens=usage.get("completion_tokens", 0),
            model=self.model,
            latency_ms=latency_ms,
            raw=data,
            finish_reason=choice.get("finish_reason", ""),
        )


# ─────────────────────────── Usage Log ───────────────────────────


async def _log_usage(
    *,
    model: str,
    mode: str,
    prompt_tokens: int,
    completion_tokens: int,
    latency_ms: int,
    scan_id: str | None = None,
    agent_name: str | None = None,
    call_kind: str | None = None,
    turn_index: int | None = None,
    success: bool = True,
    error_message: str | None = None,
) -> None:
    """Persist one LLMUsageLog row. Best-effort; never raises."""
    from app.database.models_observability import LLMUsageLog
    from app.database.session import async_session

    try:
        async with async_session() as session:
            session.add(
                LLMUsageLog(
                    request_id=get_request_id(),
                    scan_id=scan_id,
                    agent_name=agent_name,
                    model=model,
                    mode=mode,
                    prompt_tokens=prompt_tokens,
                    completion_tokens=completion_tokens,
                    total_tokens=prompt_tokens + completion_tokens,
                    latency_ms=latency_ms,
                    call_kind=call_kind,
                    turn_index=turn_index,
                    success=success,
                    error_message=error_message,
                )
            )
            await session.commit()
    except Exception as exc:  # noqa: BLE001
        log.warning("llm.log_persist_failed", error=str(exc))


# ─────────────────────────── Structured Output Helper ───────────────────────────


async def complete_with_schema(
    client: LLMClient,
    prompt: str,
    schema: dict[str, Any],
    *,
    max_retries: int | None = None,
    scan_id: str | None = None,
    agent_name: str | None = None,
) -> dict[str, Any]:
    """
    Ask the LLM for JSON conforming to a schema.
    Retries up to `max_retries` times if the first parse fails.
    """
    retries = max_retries if max_retries is not None else settings.llm.structured_retry_limit
    schema_hint = json.dumps(schema, ensure_ascii=False)
    current = prompt
    last_error = ""
    for attempt in range(retries + 1):
        full_prompt = current if attempt == 0 else (
            f"{current}\n\n【系统提示】请严格按以下 JSON Schema 返回，仅输出 JSON 不要任何解释：\n{schema_hint}"
        )
        try:
            resp = await client.complete(full_prompt)
            await _log_usage(
                model=resp.model,
                mode=client.name,
                prompt_tokens=resp.prompt_tokens,
                completion_tokens=resp.completion_tokens,
                latency_ms=resp.latency_ms,
                scan_id=scan_id,
                agent_name=agent_name,
                call_kind="schema",
                turn_index=attempt,
            )
            data = resp.parse_json()
            if not isinstance(data, dict):
                raise ValueError("expected dict response")
            return data
        except Exception as exc:  # noqa: BLE001
            last_error = str(exc)
            log.warning("llm.schema_retry", attempt=attempt, error=last_error)
    raise RuntimeError(f"structured output failed after {retries + 1} attempts: {last_error}")


# ─────────────────────────── Factory ───────────────────────────


_CLIENT: LLMClient | None = None


def get_llm_client() -> LLMClient:
    """Return the global LLM client (singleton)."""
    global _CLIENT
    if _CLIENT is not None:
        return _CLIENT
    mode = settings.llm.mode.lower()
    if mode == "real":
        api_key = settings.llm.api_key or os.getenv("LLM_API_KEY", "")
        base_url = settings.llm.base_url or os.getenv("LLM_BASE_URL", "")
        model = os.getenv("LLM_MODEL", settings.llm.default_model)
        if not api_key or not base_url:
            log.warning("llm.real_mode_fallback_to_mock", reason="missing API key or base url")
            _CLIENT = MockLLMClient()
        else:
            _CLIENT = OpenAICompatibleClient(api_key=api_key, base_url=base_url, model=model)
    else:
        _CLIENT = MockLLMClient()
    return _CLIENT


def reset_llm_client() -> None:
    """Useful for tests."""
    global _CLIENT
    _CLIENT = None


# ─────────────────────────── Backwards compat ───────────────────────────


# Phase 1: keep `app.config.DATABASE_URL` etc. working.
# `app/config.py` re-imports from here.
LLM_MODE = settings.llm.mode
LLM_API_KEY = settings.llm.api_key
LLM_BASE_URL = settings.llm.base_url


__all__ = [
    "LLMClient", "MockLLMClient", "OpenAICompatibleClient",
    "LLMResponse", "ToolCall",
    "get_llm_client", "reset_llm_client",
    "complete_with_schema",
]
