"""
MCP Skill protocol implementation.

Implements the Skill abstraction from `技术路线与解决方案.md` §3.3.5:
- `@skill` decorator registers a function as an MCP-compatible tool
- `SkillRegistry` maintains the global registry
- Each Skill exposes:
  - name, description, input_schema (JSON Schema)
  - sync `call(**kwargs)` interface

The registry can be exposed via MCP Server endpoints
(/mcp/v1/tools/list, /mcp/v1/tools/call).
"""
from __future__ import annotations

import inspect
import time
from dataclasses import dataclass, field
from typing import Any, Callable


@dataclass
class Skill:
    """Represents an MCP-compatible Tool/Skill."""
    name: str
    description: str
    input_schema: dict[str, Any]
    func: Callable[..., Any]
    tags: list[str] = field(default_factory=list)

    def call(self, **kwargs: Any) -> dict[str, Any]:
        """Invoke the skill, returning a dict with result and metadata."""
        start = time.time()
        try:
            result = self.func(**kwargs)
            duration_ms = int((time.time() - start) * 1000)
            return {
                "ok": True,
                "result": result,
                "duration_ms": duration_ms,
                "skill": self.name,
            }
        except Exception as exc:
            duration_ms = int((time.time() - start) * 1000)
            return {
                "ok": False,
                "error": f"{type(exc).__name__}: {exc}",
                "duration_ms": duration_ms,
                "skill": self.name,
            }

    def to_mcp_dict(self) -> dict[str, Any]:
        """Convert to MCP `tools/list` response item format."""
        return {
            "name": self.name,
            "description": self.description,
            "inputSchema": self.input_schema,
        }


class SkillRegistry:
    """Global registry of all registered skills."""

    def __init__(self) -> None:
        self._skills: dict[str, Skill] = {}

    def register(self, sk: Skill) -> None:
        if sk.name in self._skills:
            raise ValueError(f"Skill {sk.name} already registered")
        self._skills[sk.name] = sk

    def get(self, name: str) -> Skill | None:
        return self._skills.get(name)

    def list_skills(self) -> list[Skill]:
        return sorted(self._skills.values(), key=lambda s: s.name)

    def call(self, name: str, **kwargs: Any) -> dict[str, Any]:
        sk = self.get(name)
        if sk is None:
            return {"ok": False, "error": f"unknown skill: {name}", "skill": name}
        return sk.call(**kwargs)

    def to_mcp_list(self) -> list[dict[str, Any]]:
        return [s.to_mcp_dict() for s in self.list_skills()]

    def clear(self) -> None:
        self._skills.clear()


_GLOBAL = SkillRegistry()


def get_registry() -> SkillRegistry:
    return _GLOBAL


def skill(
    name: str,
    description: str,
    input_schema: dict[str, Any] | None = None,
    tags: list[str] | None = None,
) -> Callable[[Callable[..., Any]], Callable[..., Any]]:
    """
    Decorator: register a function as an MCP-compatible skill.

    Example:
        @skill(
            name="financial_calc",
            description="Compute financial anomaly scores",
            input_schema={
                "type": "object",
                "properties": {"company_code": {"type": "string"}},
                "required": ["company_code"],
            },
        )
        def financial_calc(company_code: str) -> dict:
            ...
    """

    def decorator(func: Callable[..., Any]) -> Callable[..., Any]:
        # Auto-derive a basic schema from signature if not provided
        schema = input_schema or _derive_schema(func)
        sk = Skill(
            name=name,
            description=description,
            input_schema=schema,
            func=func,
            tags=tags or [],
        )
        _GLOBAL.register(sk)
        func._skill = sk  # type: ignore[attr-defined]
        return func

    return decorator


def _derive_schema(func: Callable[..., Any]) -> dict[str, Any]:
    """Best-effort: build a JSON Schema from function signature."""
    sig = inspect.signature(func)
    props: dict[str, Any] = {}
    required: list[str] = []
    type_map = {
        int: "integer", float: "number", str: "string",
        bool: "boolean", list: "array", dict: "object",
    }
    for pname, p in sig.parameters.items():
        ann = p.annotation if p.annotation != inspect.Parameter.empty else str
        # Strip Optional[]
        origin = getattr(ann, "__origin__", None)
        if origin is not None:
            ann = ann.__args__[0] if ann.__args__ else str
        json_type = type_map.get(ann, "string")
        props[pname] = {"type": json_type}
        if p.default is inspect.Parameter.empty:
            required.append(pname)
    return {"type": "object", "properties": props, "required": required}
