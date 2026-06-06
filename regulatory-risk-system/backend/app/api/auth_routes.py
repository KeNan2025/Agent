"""
Auth routes — register / login / refresh / WebSocket ticket.
"""
from __future__ import annotations

import time
import uuid
from typing import Any

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from app.auth import create_access_token, hash_password, verify_password
from app.core.logging import get_logger
from app.database.models_users import User
from app.database.session import async_session
from app.services.ws_manager import issue_ticket
from app.settings import settings

log = get_logger(__name__)

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=64)
    password: str = Field(min_length=6, max_length=128)
    role: str = "user"


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    role: str


@router.post("/register", response_model=TokenResponse)
async def register(req: RegisterRequest) -> TokenResponse:
    try:
        async with async_session() as session:
            async with session.begin():
                user = User(
                    username=req.username,
                    password_hash=hash_password(req.password),
                    role=req.role,
                )
                session.add(user)
                await session.flush()
                user_id = user.id
    except Exception as exc:  # noqa: BLE001
        log.warning("auth.register_failed", error=str(exc))
        raise HTTPException(status_code=400, detail=f"register failed: {exc}") from exc
    token = create_access_token(user_id=user_id, role=req.role)
    return TokenResponse(access_token=token, user_id=user_id, role=req.role)


@router.post("/login", response_model=TokenResponse)
async def login(req: LoginRequest) -> TokenResponse:
    async with async_session() as session:
        from sqlalchemy import select
        stmt = select(User).where(User.username == req.username)
        user = (await session.execute(stmt)).scalar_one_or_none()
        if user is None or not verify_password(req.password, user.password_hash):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid credentials")
        if not user.is_active:
            raise HTTPException(status_code=403, detail="user disabled")
        token = create_access_token(user_id=user.id, role=user.role)
        return TokenResponse(access_token=token, user_id=user.id, role=user.role)


@router.get("/ws-ticket/{scan_id}")
async def ws_ticket(scan_id: str) -> dict[str, Any]:
    """Issue a one-time WebSocket ticket for a scan_id."""
    ticket = issue_ticket(scan_id)
    return {"ticket": ticket, "scan_id": scan_id, "ttl_sec": settings.security.ws_ticket_ttl_sec}
