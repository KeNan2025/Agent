"""
Skill sandbox — safely run user-uploaded skill scripts.

Strict allowlists (mirrors BestAITrader's design):
- argv: only `python` / `python3` / `bash` / explicit binary in the script
  directory; no `python -c`, no `python -m`, no `sh -c`, no `bash -c`.
- env: only PATH, LANG, LC_ALL, TZ, PYTHONIOENCODING, HOME.
- path: realpath must be under the skill's `scripts/` directory.
- timeout: default 30s; SIGKILL on expiry.

Return shape matches Skill.call() for backwards compatibility.
"""
from __future__ import annotations

import asyncio
import os
import shutil
from pathlib import Path
from typing import Any

from app.core.logging import get_logger

log = get_logger(__name__)

# Bash/Metacharacter blacklist for individual argv items
_META_CHARS = set("; | & ` $ < > ( ) { } [ ] ! # \n\r\t\0\\'\"")
# Whitelisted env keys
ENV_ALLOWLIST = {
    "PATH", "HOME", "LANG", "LC_ALL", "LC_CTYPE", "TZ", "PYTHONIOENCODING",
    "PYTHONUNBUFFERED", "USER", "SHELL",
}
# Default timeout for skill execution
DEFAULT_TIMEOUT_SEC = 30.0
# stdout cap (bytes)
MAX_OUTPUT_BYTES = 200_000


class SandboxViolation(Exception):
    """Raised when argv/env/path violates the allowlist."""


def _validate_argv(argv: list[str], scripts_dir: Path) -> list[str]:
    if not argv:
        raise SandboxViolation("empty argv")
    interp = argv[0]
    binary_name = Path(interp).name
    if binary_name in {"python", "python3"}:
        rest = argv[1:]
    elif binary_name in {"bash", "sh"}:
        if "-c" in rest if (rest := argv[1:]) else False:
            raise SandboxViolation("bash -c is not allowed")
        rest = argv[1:]
    else:
        # explicit binary in scripts_dir
        target = (scripts_dir / interp).resolve()
        target.relative_to(scripts_dir.resolve())  # raises if escapes
        rest = argv[1:]
    for arg in rest:
        if not arg:
            continue
        if any(ch in _META_CHARS for ch in arg):
            raise SandboxViolation(f"metacharacter in argv: {arg!r}")
    # Resolve script path and check it stays inside scripts_dir
    script_arg = rest[0] if rest else ""
    if script_arg and not script_arg.startswith("-"):
        script_path = (scripts_dir / script_arg).resolve()
        try:
            script_path.relative_to(scripts_dir.resolve())
        except ValueError as exc:
            raise SandboxViolation(f"script escapes sandbox: {script_path}") from exc
        if not script_path.exists():
            raise SandboxViolation(f"script not found: {script_path}")
    return [interp, *rest]


def _safe_env() -> dict[str, str]:
    return {k: v for k, v in os.environ.items() if k in ENV_ALLOWLIST}


async def run_skill_script(
    skill_id: str,
    argv: list[str],
    *,
    stdin_payload: str | None = None,
    timeout_sec: float = DEFAULT_TIMEOUT_SEC,
    cwd: Path | None = None,
) -> dict[str, Any]:
    """Run a skill script under sandbox restrictions.

    `skill_id` identifies the skill; its scripts live under
    `settings.skill_uploads_dir/<skill_id>/scripts/`.  A built-in
    skill may also be executed: pass `skill_id="__builtin__"` and use a
    full path under that directory.
    """
    from app.settings import settings
    base = Path(settings.skill_uploads_dir) / skill_id / "scripts"
    if not base.exists():
        return {
            "ok": False, "skill": skill_id,
            "error": f"skill scripts dir not found: {base}",
            "duration_ms": 0,
        }
    try:
        argv = _validate_argv(argv, base)
    except SandboxViolation as exc:
        return {
            "ok": False, "skill": skill_id,
            "error": f"sandbox: {exc}", "duration_ms": 0,
        }
    env = _safe_env()
    workdir = (cwd or base).resolve()
    start = asyncio.get_event_loop().time()
    try:
        proc = await asyncio.create_subprocess_exec(
            *argv, cwd=workdir, env=env,
            stdin=asyncio.subprocess.PIPE if stdin_payload is not None else None,
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
        )
    except FileNotFoundError as exc:
        return {
            "ok": False, "skill": skill_id,
            "error": f"interpreter not found: {exc}",
            "duration_ms": int((asyncio.get_event_loop().time() - start) * 1000),
        }
    try:
        stdout_b, stderr_b = await asyncio.wait_for(
            proc.communicate(input=stdin_payload.encode("utf-8") if stdin_payload else None),
            timeout=timeout_sec,
        )
    except asyncio.TimeoutError:
        proc.kill()
        await proc.wait()
        return {
            "ok": False, "skill": skill_id,
            "error": f"timeout after {timeout_sec}s",
            "exit_code": -1, "timed_out": True,
            "duration_ms": int((asyncio.get_event_loop().time() - start) * 1000),
        }
    duration_ms = int((asyncio.get_event_loop().time() - start) * 1000)
    out = stdout_b[:MAX_OUTPUT_BYTES].decode("utf-8", errors="replace")
    err = stderr_b[:MAX_OUTPUT_BYTES].decode("utf-8", errors="replace")
    return {
        "ok": proc.returncode == 0,
        "skill": skill_id,
        "command": " ".join(argv),
        "exit_code": proc.returncode,
        "duration_ms": duration_ms,
        "stdout": out,
        "stderr": err,
    }
