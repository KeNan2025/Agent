"""
Data layer: registry + plugin loader.

Adapted from BestAITrader's `data.api_registry` + `common_data_{source}`
JSONB pattern. We do NOT use Tushare (per project decision); instead
`LocalDataSource` reads from `data/competition/`.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from app.core.logging import get_logger
from app.data import (
    Announcement, DataLoader, FinancialRow, GroundTruthRow, InquiryLetter,
)

log = get_logger(__name__)


@dataclass
class SourceSpec:
    """Describes a single data source for the registry."""
    source_name: str
    storage_mode: str = "jsonb"
    target_table: str = "common_data_local"
    dedup_keys: list[str] = field(default_factory=list)
    update_strategy: str = "replace"
    description: str = ""


class DataRegistry:
    """In-process registry of data sources. Mirrors BestAITrader's pattern."""

    def __init__(self) -> None:
        self._sources: dict[str, SourceSpec] = {}
        self._local = DataLoader()
        self.register(SourceSpec(
            source_name="competition",
            target_table="common_data_local",
            dedup_keys=["company_code", "indicator_name", "period"],
            update_strategy="upsert",
            description="Local competition dataset (inquiry letters / announcements / financials)",
        ))

    def register(self, spec: SourceSpec) -> None:
        if spec.source_name in self._sources:
            log.debug("data.source_already_registered", source=spec.source_name)
            return
        self._sources[spec.source_name] = spec
        log.info("data.source_registered", source=spec.source_name)

    def get(self, name: str) -> SourceSpec | None:
        return self._sources.get(name)

    def list_sources(self) -> list[SourceSpec]:
        return list(self._sources.values())

    # ────────── Proxy to LocalDataLoader ──────────

    def load_inquiry_letters(self, code: str) -> list[InquiryLetter]:
        return self._local.load_inquiry_letters(code)

    def load_announcements(self, code: str) -> list[Announcement]:
        return self._local.load_announcements(code)

    def load_financial(self, code: str) -> list[FinancialRow]:
        return self._local.load_financial(code)

    def load_ground_truth(self, split: str) -> list[GroundTruthRow]:
        return self._local.load_ground_truth(split)

    def all_ground_truth(self) -> list[GroundTruthRow]:
        return self._local.all_ground_truth()

    def get_risk_factors_for_company(
        self, code: str, scan_date: str | None = None, window_days: int = 60,
    ) -> list[dict[str, Any]]:
        return self._local.get_risk_factors_for_company(code, scan_date, window_days)

    def has_competition_data(self) -> bool:
        return self._local.has_competition_data()


_GLOBAL = DataRegistry()


def get_data_registry() -> DataRegistry:
    return _GLOBAL
