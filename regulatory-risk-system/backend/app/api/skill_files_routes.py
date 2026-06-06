"""Skill file management — upload, view, edit, download, delete."""
from __future__ import annotations

import json
from typing import Any

from fastapi import APIRouter, HTTPException, Query, UploadFile, File, Form
from fastapi.responses import PlainTextResponse

from app.database.repository import SkillFileRepository

router = APIRouter(prefix="/api/v1/skills/files", tags=["skill-files"])


@router.get("")
async def list_files(skill_name: str | None = Query(None)) -> dict[str, Any]:
    repo = SkillFileRepository()
    rows = await repo.list_all(skill_name)
    return {
        "total": len(rows),
        "files": [
            {
                "id": r.id,
                "filename": r.filename,
                "original_name": r.original_name,
                "content_type": r.content_type,
                "size_bytes": r.size_bytes,
                "skill_name": r.skill_name,
                "description": r.description,
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "updated_at": r.updated_at.isoformat() if r.updated_at else None,
            }
            for r in rows
        ],
    }


@router.get("/{file_id}")
async def get_file(file_id: int) -> dict[str, Any]:
    repo = SkillFileRepository()
    row = await repo.get(file_id)
    if not row:
        raise HTTPException(status_code=404, detail="文件未找到")
    return {
        "id": row.id,
        "filename": row.filename,
        "original_name": row.original_name,
        "content_type": row.content_type,
        "size_bytes": row.size_bytes,
        "skill_name": row.skill_name,
        "description": row.description,
        "content": row.content,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


@router.get("/{file_id}/download")
async def download_file(file_id: int):
    repo = SkillFileRepository()
    row = await repo.get(file_id)
    if not row:
        raise HTTPException(status_code=404, detail="文件未找到")
    return PlainTextResponse(
        content=row.content,
        media_type=row.content_type or "text/plain",
        headers={"Content-Disposition": f'attachment; filename="{row.filename}"'},
    )


@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    skill_name: str | None = Form(None),
    description: str = Form(""),
):
    content_bytes = await file.read()
    content = content_bytes.decode("utf-8")
    repo = SkillFileRepository()
    row = await repo.create(
        filename=file.filename or "unnamed",
        original_name=file.filename or "unnamed",
        content=content,
        content_type=file.content_type or "text/plain",
        size_bytes=len(content_bytes),
        skill_name=skill_name,
        description=description,
    )
    return {
        "id": row.id,
        "filename": row.filename,
        "skill_name": row.skill_name,
        "message": "文件上传成功",
    }


@router.put("/{file_id}")
async def update_file(
    file_id: int,
    content: str = Form(...),
    description: str = Form(""),
) -> dict[str, Any]:
    repo = SkillFileRepository()
    row = await repo.update_content(file_id, content, description)
    if not row:
        raise HTTPException(status_code=404, detail="文件未找到")
    return {
        "id": row.id,
        "filename": row.filename,
        "message": "文件更新成功",
    }


@router.delete("/{file_id}")
async def delete_file(file_id: int) -> dict[str, Any]:
    repo = SkillFileRepository()
    ok = await repo.delete(file_id)
    if not ok:
        raise HTTPException(status_code=404, detail="文件未找到")
    return {"message": "文件删除成功"}