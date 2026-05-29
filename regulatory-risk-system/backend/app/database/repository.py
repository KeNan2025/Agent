"""Repository layer — thin async accessors over the ORM models."""
from __future__ import annotations

import json
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import desc, select

from app.database.models import (
    Checkpoint, ScanRecord, SkillCall, TraceLog,
)
from app.database.session import async_session


class ScanRepository:
    async def create(
        self, scan_id: str, company_code: str, window_days: int,
        probability: float, risk_level: str,
        risk_hypothesis: list[str], analysis_plan: list[str],
        full_state: dict[str, Any] | None = None,
    ) -> None:
        async with async_session() as s:
            row = ScanRecord(
                scan_id=scan_id, company_code=company_code,
                window_days=window_days, probability=probability,
                risk_level=risk_level,
                risk_hypothesis=json.dumps(risk_hypothesis, ensure_ascii=False),
                analysis_plan=json.dumps(analysis_plan, ensure_ascii=False),
                full_state=full_state,
            )
            s.add(row)
            await s.commit()

    async def get(self, scan_id: str) -> ScanRecord | None:
        async with async_session() as s:
            r = await s.execute(select(ScanRecord).where(ScanRecord.scan_id == scan_id))
            return r.scalars().first()

    async def list_by_company(self, company_code: str, limit: int = 20) -> list[ScanRecord]:
        async with async_session() as s:
            r = await s.execute(
                select(ScanRecord)
                .where(ScanRecord.company_code == company_code)
                .order_by(desc(ScanRecord.created_at))
                .limit(limit)
            )
            return list(r.scalars().all())

    async def list_recent(self, limit: int = 50) -> list[ScanRecord]:
        async with async_session() as s:
            r = await s.execute(
                select(ScanRecord).order_by(desc(ScanRecord.created_at)).limit(limit)
            )
            return list(r.scalars().all())


class TraceRepository:
    async def add_many(self, scan_id: str, events: list[dict[str, Any]]) -> None:
        async with async_session() as s:
            for ev in events:
                row = TraceLog(
                    scan_id=scan_id,
                    event_id=ev.get("event_id", ""),
                    node_name=ev.get("node_name", ""),
                    action=ev.get("action", "")[:255],
                    input_summary=ev.get("input_summary", ""),
                    output_summary=ev.get("output_summary", ""),
                    skills_called=json.dumps(ev.get("skills_called", []), ensure_ascii=False),
                    duration_ms=int(ev.get("duration_ms", 0)),
                    tokens_used=int(ev.get("tokens_used", 0)),
                    error=ev.get("error"),
                )
                s.add(row)
            await s.commit()

    async def list_for_scan(self, scan_id: str) -> list[TraceLog]:
        async with async_session() as s:
            r = await s.execute(
                select(TraceLog).where(TraceLog.scan_id == scan_id)
                .order_by(TraceLog.timestamp)
            )
            return list(r.scalars().all())


class CheckpointRepository:
    async def save(self, scan_id: str, node_name: str, state: dict[str, Any]) -> None:
        async with async_session() as s:
            row = Checkpoint(scan_id=scan_id, node_name=node_name, state_json=state)
            s.add(row)
            await s.commit()

    async def latest(self, scan_id: str) -> Checkpoint | None:
        async with async_session() as s:
            r = await s.execute(
                select(Checkpoint).where(Checkpoint.scan_id == scan_id)
                .order_by(desc(Checkpoint.created_at)).limit(1)
            )
            return r.scalars().first()

    async def list_for_scan(self, scan_id: str) -> list[Checkpoint]:
        async with async_session() as s:
            r = await s.execute(
                select(Checkpoint).where(Checkpoint.scan_id == scan_id)
                .order_by(Checkpoint.created_at)
            )
            return list(r.scalars().all())


class SkillRepository:
    async def log_call(
        self, skill_name: str, input_json: dict[str, Any],
        output_json: dict[str, Any], duration_ms: int, success: bool,
        scan_id: str | None = None,
    ) -> None:
        async with async_session() as s:
            row = SkillCall(
                scan_id=scan_id, skill_name=skill_name,
                input_json=input_json, output_json=output_json,
                duration_ms=duration_ms, success=int(success),
            )
            s.add(row)
            await s.commit()

    async def recent(self, limit: int = 50) -> list[SkillCall]:
        async with async_session() as s:
            r = await s.execute(
                select(SkillCall).order_by(desc(SkillCall.created_at)).limit(limit)
            )
            return list(r.scalars().all())

    async def stats(self, since_hours: int = 24) -> dict[str, Any]:
        since = datetime.utcnow() - timedelta(hours=since_hours)
        async with async_session() as s:
            r = await s.execute(
                select(SkillCall).where(SkillCall.created_at >= since)
            )
            calls = list(r.scalars().all())
        agg: dict[str, dict[str, Any]] = {}
        for c in calls:
            slot = agg.setdefault(c.skill_name, {"count": 0, "success": 0, "duration_ms": 0})
            slot["count"] += 1
            slot["success"] += int(c.success)
            slot["duration_ms"] += int(c.duration_ms)
        for k, v in agg.items():
            v["avg_ms"] = round(v["duration_ms"] / max(1, v["count"]), 1)
            v["success_rate"] = round(v["success"] / max(1, v["count"]), 3)
        return agg


class SkillFileRepository:
    async def create(
        self, filename: str, original_name: str, content: str,
        content_type: str = "text/plain", size_bytes: int = 0,
        skill_name: str | None = None, description: str = "",
    ) -> SkillFile:
        from app.database.models import SkillFile
        async with async_session() as s:
            row = SkillFile(
                filename=filename, original_name=original_name,
                content=content, content_type=content_type,
                size_bytes=size_bytes, skill_name=skill_name,
                description=description,
            )
            s.add(row)
            await s.commit()
            await s.refresh(row)
            return row

    async def list_all(self, skill_name: str | None = None) -> list[SkillFile]:
        from app.database.models import SkillFile
        async with async_session() as s:
            q = select(SkillFile).order_by(desc(SkillFile.updated_at))
            if skill_name:
                q = q.where(SkillFile.skill_name == skill_name)
            r = await s.execute(q)
            return list(r.scalars().all())

    async def get(self, file_id: int) -> SkillFile | None:
        from app.database.models import SkillFile
        async with async_session() as s:
            r = await s.execute(select(SkillFile).where(SkillFile.id == file_id))
            return r.scalars().first()

    async def update_content(self, file_id: int, content: str, description: str = "") -> SkillFile | None:
        from app.database.models import SkillFile
        async with async_session() as s:
            r = await s.execute(select(SkillFile).where(SkillFile.id == file_id))
            row = r.scalars().first()
            if not row:
                return None
            row.content = content
            if description:
                row.description = description
            row.updated_at = datetime.utcnow()
            await s.commit()
            await s.refresh(row)
            return row

    async def delete(self, file_id: int) -> bool:
        from app.database.models import SkillFile
        async with async_session() as s:
            r = await s.execute(select(SkillFile).where(SkillFile.id == file_id))
            row = r.scalars().first()
            if not row:
                return False
            await s.delete(row)
            await s.commit()
            return True
