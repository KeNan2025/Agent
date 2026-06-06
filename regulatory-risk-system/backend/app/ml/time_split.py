"""
Time-based train/test split.

The competition spec calls for time-ordered data: a scan is "positive" if
a real inquiry letter arrived in the window AFTER the scan date. So we
split by **scan date**, not by random row.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timezone
from typing import Iterable


@dataclass
class TimeSplit:
    train_indices: list[int]
    test_indices: list[int]
    train_cutoff: date
    test_starts_at: date


def make_time_split(
    scan_dates: Iterable[date | datetime | str | None],
    train_cutoff: date,
    *,
    min_train: int = 10,
    min_test: int = 5,
) -> TimeSplit:
    """Return indices for samples whose scan_date <= train_cutoff (train) and
    those whose scan_date > train_cutoff (test).
    """
    train: list[int] = []
    test: list[int] = []
    for i, raw in enumerate(scan_dates):
        d = _coerce_date(raw)
        if d is None:
            # Unknown date — push to train (more conservative)
            train.append(i)
            continue
        if d <= train_cutoff:
            train.append(i)
        else:
            test.append(i)
    # If either side is too small, fall back to a stratified split
    if len(train) < min_train or len(test) < min_test:
        idx = list(range(len(list(scan_dates)) if hasattr(scan_dates, "__len__") else sum(1 for _ in scan_dates)))
        cut = int(len(idx) * 0.8)
        return TimeSplit(train_indices=idx[:cut], test_indices=idx[cut:],
                         train_cutoff=train_cutoff, test_starts_at=train_cutoff)
    return TimeSplit(
        train_indices=train, test_indices=test,
        train_cutoff=train_cutoff, test_starts_at=train_cutoff,
    )


def _coerce_date(raw: date | datetime | str | None) -> date | None:
    if raw is None:
        return None
    if isinstance(raw, datetime):
        return raw.date() if raw.tzinfo is None else raw.astimezone(timezone.utc).date()
    if isinstance(raw, date):
        return raw
    try:
        return datetime.fromisoformat(str(raw).replace("Z", "+00:00")).date()
    except Exception:
        return None
