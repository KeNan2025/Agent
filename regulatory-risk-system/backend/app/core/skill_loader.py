"""
Skill loader — register user-uploaded SkillFile rows as callable Skills.

A user-uploaded SkillFile can declare a `skill.json` (name, description,
input_schema) in its body. The loader parses it, wraps the script as
a sandboxed subprocess Skill, and registers it in the global registry.

This unblocks the "user-uploaded SkillFile is just CRUD" issue noted
in the audit: uploads now actually run.
"""
from __future__ import annotations

import json
import re
from typing import Any

from app.core.logging import get_logger
from app.core.skill_sandbox import run_skill_script
from app.core.skill import Skill, get_registry
from app.database.models import SkillFile
from app.settings import settings

log = get_logger(__name__)


_SKILL_JSON_RE = re.compile(r"\{[^{}]*\"name\"[^{}]*\"description\"[^{}]*\}", re.DOTALL)


def _parse_skill_json(content: str) -> dict[str, Any] | None:
    """Best-effort parse of a `skill.json` block in uploaded file content."""
    if not content:
        return None
    # Try the whole file as JSON first
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        pass
    # Then look for a JSON object in a ```json ... ``` block
    m = re.search(r"```json\s*(\{.*?\})\s*```", content, re.DOTALL)
    if m:
        try:
            return json.loads(m.group(1))
        except json.JSONDecodeError:
            pass
    return None


def _materialize_skill_filesystem(sf: SkillFile) -> str | None:
    """Write the SkillFile content to disk under
    settings.skill_uploads_dir/{skill_name}/scripts/{filename}.

    Returns the absolute scripts dir, or None on failure.
    """
    if not sf.skill_name:
        return None
    base = settings.skill_uploads_dir / sf.skill_name
    scripts = base / "scripts"
    try:
        scripts.mkdir(parents=True, exist_ok=True)
        out = scripts / sf.filename
        out.write_text(sf.content or "", encoding="utf-8")
        # Also write skill.json if available
        manifest = _parse_skill_json(sf.description or "")
        if manifest:
            (base / "skill.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
        return str(scripts)
    except Exception as exc:  # noqa: BLE001
        log.warning("skill_loader.materialize_failed", skill=sf.skill_name, error=str(exc))
        return None


def _make_skill_from_sf(sf: SkillFile) -> Skill | None:
    manifest = _parse_skill_json(sf.description or "")
    name = (manifest or {}).get("name") or sf.skill_name
    if not name:
        return None
    description = (manifest or {}).get("description") or f"User-uploaded skill: {sf.filename}"
    input_schema = (manifest or {}).get("inputSchema") or (manifest or {}).get("input_schema") or {
        "type": "object",
        "properties": {"input_json": {"type": "string"}},
        "required": ["input_json"],
    }
    scripts_dir = _materialize_skill_filesystem(sf)
    if scripts_dir is None:
        return None

    def _func(**kwargs: Any) -> dict[str, Any]:
        import asyncio
        import json as _json
        stdin = _json.dumps(kwargs, ensure_ascii=False)
        # Determine argv: prefer a `main` field in manifest, else run
        # the file as a python module/script.
        main = (manifest or {}).get("main") or sf.filename
        if main.endswith(".py"):
            argv = ["python3", main]
        elif main.endswith(".sh"):
            argv = ["bash", main]
        else:
            argv = [main]
        return asyncio.run(run_skill_script(
            sf.skill_name, argv, stdin_payload=stdin, timeout_sec=30.0,
        ))

    return Skill(
        name=name, description=description,
        input_schema=input_schema, func=_func,
        tags=["user-uploaded"],
    )


def try_register(sf: SkillFile) -> bool:
    """Materialise a SkillFile to disk and register a sandboxed Skill."""
    reg = get_registry()
    if reg.get(sf.skill_name or "") is not None:
        return True  # already registered
    sk = _make_skill_from_sf(sf)
    if sk is None:
        return False
    try:
        reg.register(sk)
        log.info("skill_loader.registered", skill=sk.name)
        return True
    except ValueError:
        return False


def reload_user_skills() -> int:
    """Re-register all SkillFile rows. Called on app startup."""
    from app.database.session import async_session
    from sqlalchemy import select

    async def _do() -> int:
        n = 0
        async with async_session() as session:
            stmt = select(SkillFile)
            rows = (await session.execute(stmt)).scalars().all()
            for sf in rows:
                if try_register(sf):
                    n += 1
        return n

    import asyncio
    try:
        return asyncio.run(_do())
    except Exception as exc:  # noqa: BLE001
        log.warning("skill_loader.reload_failed", error=str(exc))
        return 0
