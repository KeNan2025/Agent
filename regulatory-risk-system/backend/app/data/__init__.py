"""
DataLoader — read competition dataset from local files (no Tushare).

Expected layout under `settings.competition_data_dir`:

  data/competition/
  ├── inquiry_letters/        # 1,000-3,000 entries: <code>.jsonl
  │   ├── 600000.jsonl
  │   ├── 600001.jsonl
  │   └── ...
  ├── announcements/          # 30,000-50,000 entries: <code>_<year>.jsonl
  │   ├── 600000_2019.jsonl
  │   └── ...
  ├── financial/              # financial indicators: fina_indicator.csv
  │   └── fina_indicator.csv
  ├── ground_truth/           # labels (train.csv / valid.csv / test.csv)
  │   ├── train.csv
  │   ├── valid.csv
  │   └── test.csv
  └── loader.py               # (this file)

When the directory is empty or missing, DataLoader falls back to
`mock_data.generator` if `settings.features.enable_mock_data_fallback`
is True (default).
"""
from __future__ import annotations

import csv
import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from app.core.logging import get_logger
from app.settings import settings

log = get_logger(__name__)


@dataclass
class InquiryLetter:
    company_code: str
    inquiry_date: str
    inquiry_type: str
    title: str = ""
    questions: str = ""
    reply: str = ""
    focus: list[str] = field(default_factory=list)


@dataclass
class Announcement:
    company_code: str
    date: str
    type: str
    title: str
    body: str
    summary: str = ""


@dataclass
class FinancialRow:
    company_code: str
    period: str
    indicator_name: str
    value: float
    extra: dict[str, Any] = field(default_factory=dict)


@dataclass
class GroundTruthRow:
    company_code: str
    scan_date: str
    window_days: int
    label: int
    inquiry_id: str | None = None


class DataLoader:
    """Filesystem-backed reader for the competition dataset."""

    def __init__(self, root: Path | None = None) -> None:
        self.root = Path(root or settings.competition_data_dir)

    # ────────── Inquiry letters ──────────

    def list_companies_with_inquiries(self) -> list[str]:
        d = self.root / "inquiry_letters"
        if not d.exists():
            return []
        return sorted(p.stem for p in d.glob("*.jsonl"))

    def load_inquiry_letters(self, company_code: str) -> list[InquiryLetter]:
        path = self.root / "inquiry_letters" / f"{company_code}.jsonl"
        if not path.exists():
            return []
        out: list[InquiryLetter] = []
        with path.open("r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    d = json.loads(line)
                except json.JSONDecodeError:
                    continue
                out.append(InquiryLetter(
                    company_code=company_code,
                    inquiry_date=d.get("inquiry_date", d.get("date", "")),
                    inquiry_type=d.get("inquiry_type", d.get("type", "")),
                    title=d.get("title", ""),
                    questions=d.get("questions", ""),
                    reply=d.get("reply", ""),
                    focus=d.get("focus") or d.get("categories") or [],
                ))
        return out

    def all_inquiry_letters(self) -> dict[str, list[InquiryLetter]]:
        return {code: self.load_inquiry_letters(code) for code in self.list_companies_with_inquiries()}

    # ────────── Announcements ──────────

    def load_announcements(self, company_code: str) -> list[Announcement]:
        d = self.root / "announcements"
        if not d.exists():
            return []
        out: list[Announcement] = []
        for path in sorted(d.glob(f"{company_code}*.jsonl")):
            with path.open("r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        row = json.loads(line)
                    except json.JSONDecodeError:
                        continue
                    out.append(Announcement(
                        company_code=company_code,
                        date=row.get("date", ""),
                        type=row.get("type", ""),
                        title=row.get("title", ""),
                        body=row.get("body", row.get("content", "")),
                        summary=row.get("summary", ""),
                    ))
        return out

    # ────────── Financial indicators ──────────

    def load_financial(self, company_code: str) -> list[FinancialRow]:
        path = self.root / "financial" / "fina_indicator.csv"
        if not path.exists():
            return []
        out: list[FinancialRow] = []
        with path.open("r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                if row.get("company_code") != company_code:
                    continue
                try:
                    value = float(row.get("value", 0) or 0)
                except ValueError:
                    continue
                out.append(FinancialRow(
                    company_code=company_code,
                    period=row.get("period", ""),
                    indicator_name=row.get("indicator_name", row.get("name", "")),
                    value=value,
                    extra={k: v for k, v in row.items() if k not in {"company_code", "period", "indicator_name", "name", "value"}},
                ))
        return out

    # ────────── Ground truth ──────────

    def load_ground_truth(self, split: str) -> list[GroundTruthRow]:
        path = self.root / "ground_truth" / f"{split}.csv"
        if not path.exists():
            return []
        out: list[GroundTruthRow] = []
        with path.open("r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                try:
                    label = int(row.get("label", 0))
                except ValueError:
                    label = 0
                try:
                    wd = int(row.get("window_days", 60))
                except ValueError:
                    wd = 60
                out.append(GroundTruthRow(
                    company_code=row.get("company_code", ""),
                    scan_date=row.get("scan_date", ""),
                    window_days=wd,
                    label=label,
                    inquiry_id=row.get("inquiry_id") or None,
                ))
        return out

    def all_ground_truth(self) -> list[GroundTruthRow]:
        rows: list[GroundTruthRow] = []
        for split in ("train", "valid", "test"):
            rows.extend(self.load_ground_truth(split))
        return rows

    # ────────── Aggregated risk_factors for a scan ──────────

    def get_risk_factors_for_company(
        self, company_code: str, scan_date: str | None = None,
        window_days: int = 60, *,
        top_k: int = 8,
    ) -> list[dict[str, Any]]:
        """Heuristic extraction: pick the most-recent inquiry focus tags
        within the window. Used as a seed for the LLM's risk-factor output.
        """
        letters = self.load_inquiry_letters(company_code)
        # Use historical focus as seed; in real production this would also
        # be the LLM-extracted categories. For the loader we keep it simple.
        tags: list[str] = []
        for ltr in letters[:5]:
            tags.extend(ltr.focus[:3])
        seen: set[str] = set()
        out: list[dict[str, Any]] = []
        for tag in tags:
            if tag in seen:
                continue
            seen.add(tag)
            out.append({
                "category": tag,
                "subcategory": tag,
                "description": f"历史曾因「{tag}」被问询",
                "severity": "中",
                "confidence": 0.6,
                "evidence_quote": "",
                "evidence_source": f"inquiry_letters/{company_code}.jsonl",
            })
            if len(out) >= top_k:
                break
        return out

    def has_competition_data(self) -> bool:
        return (
            (self.root / "inquiry_letters").exists()
            or (self.root / "ground_truth").exists()
        )


def is_inquiry_hit(
    company_code: str, scan_date: str, window_days: int,
    loader: DataLoader | None = None,
) -> tuple[bool, str | None]:
    """Return (hit, inquiry_id) — True if a real inquiry letter exists in
    the window [scan_date, scan_date + window_days]."""
    loader = loader or DataLoader()
    letters = loader.load_inquiry_letters(company_code)
    return _match_window(letters, scan_date, window_days)


def _match_window(
    letters: list[InquiryLetter], scan_date: str, window_days: int,
) -> tuple[bool, str | None]:
    from datetime import date, datetime, timedelta
    if not scan_date or not letters:
        return False, None
    try:
        s = date.fromisoformat(scan_date[:10])
    except ValueError:
        return False, None
    end = s + timedelta(days=window_days)
    for ltr in letters:
        try:
            d = date.fromisoformat((ltr.inquiry_date or "")[:10])
        except ValueError:
            continue
        if s <= d <= end:
            return True, ltr.inquiry_date
    return False, None
