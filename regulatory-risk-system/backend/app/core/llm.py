"""
LLM client abstraction.

Provides a uniform interface for:
- Mock LLM (deterministic, for demo / unit tests)
- OpenAI-compatible API (works with Qwen3 via DashScope, DeepSeek, etc.)

Switching modes is driven by the `LLM_MODE` env var.
"""
from __future__ import annotations

import hashlib
import json
import os
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any, Optional


@dataclass
class LLMResponse:
    text: str
    tokens_used: int = 0
    model: str = ""
    latency_ms: int = 0
    raw: Any = None

    def parse_json(self) -> Any:
        """Try to parse the response as JSON; tolerant of code fences."""
        txt = self.text.strip()
        if txt.startswith("```"):
            # Strip ```json ... ```
            lines = txt.splitlines()
            if lines and lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].startswith("```"):
                lines = lines[:-1]
            txt = "\n".join(lines)
        return json.loads(txt)


class LLMClient(ABC):
    """Uniform interface for LLM backends."""

    name: str = "abstract"

    @abstractmethod
    def chat(
        self,
        messages: list[dict[str, str]],
        *,
        temperature: float = 0.0,
        max_tokens: int = 1024,
        response_format: Optional[dict[str, Any]] = None,
    ) -> LLMResponse:
        ...

    def complete(self, prompt: str, **kwargs: Any) -> LLMResponse:
        return self.chat([{"role": "user", "content": prompt}], **kwargs)


# ─────────────────────────── Mock LLM ───────────────────────────


class MockLLMClient(LLMClient):
    """
    Deterministic mock LLM. Returns templated responses based on prompt keywords.
    Used in demo mode and unit tests — never makes real API calls.
    """

    name = "mock"

    def chat(
        self,
        messages: list[dict[str, str]],
        *,
        temperature: float = 0.0,
        max_tokens: int = 1024,
        response_format: Optional[dict[str, Any]] = None,
    ) -> LLMResponse:
        # Concatenate user turns
        joined = "\n".join(m.get("content", "") for m in messages if m.get("role") == "user")
        seed = int(hashlib.md5(joined.encode("utf-8")).hexdigest()[:8], 16)
        # Templates keyed by intent
        text = self._template(joined, seed)
        return LLMResponse(
            text=text,
            tokens_used=min(max_tokens, max(100, len(text) // 2)),
            model="mock-llm",
            latency_ms=50,
        )

    def _template(self, prompt: str, seed: int) -> str:
        """Pick a deterministic response based on keywords."""
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
    """
    Calls any OpenAI-compatible Chat Completions endpoint.
    Works with:
    - DashScope (Qwen3): https://dashscope.aliyuncs.com/compatible-mode/v1
    - DeepSeek:         https://api.deepseek.com/v1
    - OpenAI:           https://api.openai.com/v1
    """

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

    def chat(
        self,
        messages: list[dict[str, str]],
        *,
        temperature: float = 0.0,
        max_tokens: int = 1024,
        response_format: Optional[dict[str, Any]] = None,
    ) -> LLMResponse:
        # Lazy import to keep mock mode dependency-free
        try:
            import httpx
        except ImportError as exc:
            raise RuntimeError("httpx is required for OpenAICompatibleClient") from exc

        payload: dict[str, Any] = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if response_format:
            payload["response_format"] = response_format

        url = f"{self.base_url}/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        start = time.time()
        with httpx.Client(timeout=self.timeout) as client:
            resp = client.post(url, json=payload, headers=headers)
            resp.raise_for_status()
            data = resp.json()
        latency_ms = int((time.time() - start) * 1000)
        choice = data["choices"][0]
        text = choice["message"]["content"]
        usage = data.get("usage", {})
        return LLMResponse(
            text=text,
            tokens_used=usage.get("total_tokens", 0),
            model=self.model,
            latency_ms=latency_ms,
            raw=data,
        )


# ─────────────────────────── Factory ───────────────────────────


_CLIENT: LLMClient | None = None


def get_llm_client() -> LLMClient:
    """Return the global LLM client based on env. Singleton."""
    global _CLIENT
    if _CLIENT is not None:
        return _CLIENT
    mode = os.getenv("LLM_MODE", "mock").lower()
    if mode == "real":
        api_key = os.getenv("LLM_API_KEY", "")
        base_url = os.getenv("LLM_BASE_URL", "")
        model = os.getenv("LLM_MODEL", "qwen-plus")
        if not api_key or not base_url:
            # Fallback to mock with a warning
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
