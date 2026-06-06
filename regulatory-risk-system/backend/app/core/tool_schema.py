"""
Convert MCP `Skill` registry into OpenAI-compatible tools schema.

This bridges the self-built Skill registry (decorated with `@skill(...)`)
to the LLM function-calling API. The schema is what gets sent as
`tools=[...]` in the chat completion request.
"""
from __future__ import annotations

from typing import Any

from app.core.skill import Skill, SkillRegistry


def skill_to_openai_tool(sk: Skill) -> dict[str, Any]:
    """Convert a single Skill to OpenAI function-calling tool format."""
    return {
        "type": "function",
        "function": {
            "name": sk.name,
            "description": sk.description,
            "parameters": sk.input_schema or {"type": "object", "properties": {}},
        },
    }


def registry_to_openai_tools(
    registry: SkillRegistry,
    *,
    filter_names: list[str] | None = None,
) -> list[dict[str, Any]]:
    """Return all (or filtered) skills as OpenAI tools schema."""
    skills = registry.list_skills()
    if filter_names:
        keep = set(filter_names)
        skills = [s for s in skills if s.name in keep]
    return [skill_to_openai_tool(s) for s in skills]
