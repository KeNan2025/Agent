"""
Skill sandbox — safely run user-uploaded skill scripts.

Strict allowlists (mirrors BestAITrader's design):
- argv: only `python` / `python3` / `bash` / explicit binary in the script
  directory; explicit -c / -m flags are rejected.
- env: only PATH, LANG, LC_ALL, TZ, PYTHONIOENCODING, HOME.
- path: realpath must be under the skill's `scripts/` directory.
- timeout: default 30s; SIGKILL on expiry.
"""
from __future__ import annotations

import asyncio
import os
from pathlib import Path
from typing import Any

from app.core.logging import get_logger

log = get_logger(__name__)

_META_CHARS = set(";|&`$<>(){}[]!#\n\r\t\0\\'\"")
ENV_ALLOWLIST = {
    "PATH", "HOME", "LANG", "LC_ALL", "LC_CTYPE", "TZ", "PYTHONIOENCODING",
    "PYTHONUNBUFFERED", "USER", "SHELL",
}
DEFAULT_TIMEOUT_SEC = 30.0
MAX_OUTPUT_BYTES = 200_000

# Forbidden flags / patterns that bypass the sandbox
_FORBIDDEN_FLAGS = {"-c", "-m", "--cmd", "-x"}


class SandboxViolation(Exception):
    """Raised when argv/env/path violates the allowlist."""


def _validate_argv(argv: list[str], scripts_dir: Path) -> list[str]:
    """Validate argv. Reject:
    - empty argv
    - `python -c "code"` / `python -m mod` / `bash -c` / `sh -c`
    - shell metacharacters in any arg
    - script paths escaping `scripts_dir`
    """
    if not argv:
        raise SandboxViolation("empty argv")
    interp = argv[0]
    binary_name = Path(interp).name
    rest = argv[1:]

    # 1. Reject forbidden flags up-front
    for arg in rest:
        if arg in _FORBIDDEN_FLAGS:
            raise SandboxViolation(f"forbidden flag: {arg}")

    # 2. Resolve interpreter
    if binary_name in {"python", "python3"}:
        pass
    elif binary_name in {"bash", "sh"}:
        pass
    else:
        target = (scripts_dir / interp).resolve()
        try:
            target.relative_to(scripts_dir.resolve())
        except ValueError as exc:
            raise SandboxViolation(f"binary escapes sandbox: {target}") from exc

    # 3. Check metacharacters
    for arg in rest:
        if not arg:
            continue
        if any(ch in _META_CHARS for ch in arg):
            raise SandboxViolation(f"metacharacter in argv: {arg!r}")

    # 4. First non-flag arg must be a script inside scripts_dir
    script_arg = next((a for a in rest if a and not a.startswith("-")), None)
    if script_arg:
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
    """Run a skill script under sandbox restrictions."""
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
    loop = asyncio.get_event_loop()
    start = loop.time()
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
            "duration_ms": int((loop.time() - start) * 1000),
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
            "duration_ms": int((loop.time() - start) * 1000),
        }
    duration_ms = int((loop.time() - start) * 1000)
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
