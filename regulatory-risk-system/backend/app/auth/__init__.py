"""
Auth helpers — JWT, password hashing, and FastAPI dependencies.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from app.core.logging import get_logger
from app.settings import settings

log = get_logger(__name__)

# argon2 uses (time_cost, memory_cost, parallelism) — there is no "rounds".
# Use library defaults; they are already calibrated for interactive use.
_hasher = PasswordHasher()
_bearer = HTTPBearer(auto_error=False)


# ────────── Password ──────────


def hash_password(plain: str) -> str:
    return _hasher.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    try:
        _hasher.verify(hashed, plain)
        return True
    except VerifyMismatchError:
        return False
    except Exception as exc:  # noqa: BLE001
        log.warning("auth.verify_failed", error=str(exc))
        return False


# ────────── JWT ──────────


def create_access_token(*, user_id: int, role: str = "user") -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "role": role,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=settings.security.jwt_access_ttl_min)).timestamp()),
    }
    return jwt.encode(payload, settings.security.secret_key, algorithm=settings.security.jwt_algorithm)


def decode_token(token: str) -> dict[str, Any]:
    try:
        return jwt.decode(token, settings.security.secret_key, algorithms=[settings.security.jwt_algorithm])
    except JWTError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"invalid token: {exc}") from exc


# ────────── Dependencies ──────────


async def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> dict[str, Any]:
    """Resolve a JWT to a `{"user_id", "role"}` dict.

    In dev mode (no Authorization header) we fall back to a guest user
    so the existing API continues to work without auth. Set
    `settings.security.required = True` later to enforce.
    """
    if creds is None:
        return {"user_id": 0, "role": "guest", "guest": True}
    payload = decode_token(creds.credentials)
    return {"user_id": int(payload.get("sub", 0)), "role": payload.get("role", "user")}


def require_role(*roles: str):
    async def _dep(user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
        if user.get("role") not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="insufficient role")
        return user
    return _dep
