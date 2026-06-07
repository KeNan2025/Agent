"""
BaseAgent: real tool-calling main loop (Phase 2).

Inherits from the existing `AgentNode` (Phase 1) so backwards compatibility
is preserved. Subclasses declare a list of Skill names they may call,
and the LLM is asked to pick one. Up to `MAX_LLM_ITERATIONS` rounds are
allowed; the final assistant message is parsed as the structured response.

Mirrors BestAITrader's BaseAgent (60-iteration tool-calling loop with
output summarization and structured-output retry), adapted to our
self-built framework so we don't have to adopt LangGraph.
"""
from __future__ import annotations

import asyncio
import json
import time
from typing import Any, Sequence

from app.core.framework import AgentNode, ScanState
from app.core.llm import (
    LLMClient, LLMResponse, ToolCall, complete_with_schema, get_llm_client,
)
from app.core.logging import get_logger, get_request_id
from app.core.skill import SkillRegistry, get_registry
from app.core.tool_schema import registry_to_openai_tools
from app.settings import settings

log = get_logger(__name__)

# Hard cap on tool-calling rounds; matches BestAITrader convention.
MAX_LLM_ITERATIONS = 60

# Token threshold for summarising long tool outputs.
TOOL_OUTPUT_SUMMARY_THRESHOLD = 8000


class BaseAgent(AgentNode):
    """
    Real tool-calling agent base class.

    Subclasses override `_initial_messages(state)` and `_extract_final(state, response)`.
    They may set the class attribute `tools` to a list of Skill names that
    this agent is allowed to invoke; if None, all registered skills are exposed.
    """

    name: str = ""
    action: str = "执行"
    tools: list[str] | None = None  # None → all skills
    system_prompt: str = "你是一个严谨的金融风险审查助手，请基于可用工具完成任务。"

    def __init__(
        self,
        tracer=None,
        checkpointer=None,
        llm: LLMClient | None = None,
        registry: SkillRegistry | None = None,
    ):
        super().__init__(tracer=tracer, checkpointer=checkpointer)
        self.llm = llm
        self.registry = registry

    # ──────────────────────── Public entrypoint ────────────────────────

    async def execute(self, state: ScanState) -> ScanState:
        llm = self.llm or get_llm_client()
        registry = self.registry or get_registry()
        tools_schema = registry_to_openai_tools(registry, filter_names=self.tools)

        messages = self._initial_messages(state)
        if self.system_prompt:
            messages = [{"role": "system", "content": self.system_prompt}] + messages

        last_text = ""
        for turn in range(MAX_LLM_ITERATIONS):
            # Final forced turn: ask the LLM to produce text only
            if turn == MAX_LLM_ITERATIONS - 1:
                messages = messages + [
                    {"role": "system", "content": "请不要再调用任何工具，直接以 JSON 文本输出最终结论。"}
                ]

            try:
                resp = await llm.chat_with_tools(
                    messages, tools=tools_schema,
                )
            except Exception as exc:  # noqa: BLE001
                log.warning(
                    "base_agent.llm_failed",
                    agent=self.name, turn=turn, error=str(exc),
                )
                # Degrade to plain chat
                resp = await llm.chat(
                    [m for m in messages if m.get("role") != "tool"],
                )

            self._record_tokens(resp.tokens_used)
            # Always preserve any free-text the LLM emitted, even when
            # tool_calls coexist with content.
            if resp.text:
                last_text = resp.text

            if not resp.tool_calls:
                break

            # Append assistant turn with tool_calls and dispatch each
            messages.append(self._assistant_tool_message(resp.tool_calls, resp.text))
            for tc in resp.tool_calls:
                result = await self._dispatch_tool(registry, tc)
                messages.append(self._tool_result_message(tc, result))
                self._record_skill(tc.name)

        return self._extract_final(state, last_text)

    # ──────────────────────── Hooks for subclasses ────────────────────────

    def _initial_messages(self, state: ScanState) -> list[dict[str, Any]]:
        """Return the initial user-side messages describing the task."""
        return [{
            "role": "user",
            "content": (
                f"请分析上市公司 {state.company_code} 在 {state.window_days} 天内被监管问询的风险，"
                "可使用工具检索公告、财务指标、关联图谱或历史问询案例。"
            ),
        }]

    def _extract_final(self, state: ScanState, final_text: str) -> ScanState:
        """Parse the LLM's final text and write results back to state.

        Default behaviour: stash the text into `state.attribution['text']`.
        Subclasses should override and write into the right field.
        """
        attribution = dict(state.attribution or {})
        attribution.setdefault("agent", self.name)
        attribution.setdefault("text", final_text)
        state.attribution = attribution
        return state

    # ──────────────────────── Internals ────────────────────────

    async def _dispatch_tool(
        self, registry: SkillRegistry, tc: ToolCall,
    ) -> dict[str, Any]:
        log.info(
            "base_agent.tool_call",
            agent=self.name, skill=tc.name, args=list(tc.arguments.keys()),
        )
        loop = asyncio.get_event_loop()
        # Skill.func is sync; run it in a thread so we don't block the loop.
        result = await loop.run_in_executor(
            None, registry.call, tc.name, **tc.arguments,
        )
        if not result.get("ok"):
            log.warning(
                "base_agent.tool_failed",
                agent=self.name, skill=tc.name, error=result.get("error"),
            )
        return result

    def _summarize_if_long(self, payload: Any) -> str:
        text = json.dumps(payload, ensure_ascii=False, default=str)
        # crude 1 char ≈ 1/3 token approximation
        approx_tokens = len(text) // 3
        if approx_tokens <= TOOL_OUTPUT_SUMMARY_THRESHOLD:
            return text
        # Truncate; in real production this would call LLM for a summary.
        return text[: TOOL_OUTPUT_SUMMARY_THRESHOLD * 3] + "\n... [TRUNCATED]"

    def _assistant_tool_message(
        self, tool_calls: Sequence[ToolCall], text: str = "",
    ) -> dict[str, Any]:
        return {
            "role": "assistant",
            "content": text or None,
            "tool_calls": [
                {
                    "id": tc.id,
                    "type": "function",
                    "function": {
                        "name": tc.name,
                        "arguments": json.dumps(tc.arguments, ensure_ascii=False),
                    },
                }
                for tc in tool_calls
            ],
        }

    def _tool_result_message(self, tc: ToolCall, result: dict[str, Any]) -> dict[str, Any]:
        return {
            "role": "tool",
            "tool_call_id": tc.id,
            "name": tc.name,
            "content": self._summarize_if_long(result),
        }


__all__ = ["BaseAgent", "MAX_LLM_ITERATIONS", "TOOL_OUTPUT_SUMMARY_THRESHOLD"]
