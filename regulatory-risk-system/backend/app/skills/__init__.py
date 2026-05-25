"""
MCP Skills registry.

This package contains all business-logic skills exposed via the MCP protocol.
Importing this package triggers registration of every skill in the global
`SkillRegistry` (`app.core.skill.get_registry`).

Each skill is decorated with `@skill(name=..., description=..., input_schema=...)`.
"""
# Importing the modules below registers each skill at module import time.
from app.skills import (  # noqa: F401  side-effects
    announcement,
    financial,
    case,
    graph,
    report,
)
