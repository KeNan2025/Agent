"""Integration test: full orchestrator pipeline runs end-to-end."""
import asyncio

import pytest

from app.agents.orchestrator import run_scan_async
from app.mock_data.generator import get_full_prediction


def test_run_scan_end_to_end():
    seed = get_full_prediction("600000", 60)
    if seed is None:
        # Allow generator to lazy-init
        from app.mock_data.generator import get_all_predictions
        get_all_predictions()
        seed = get_full_prediction("600000", 60)
    assert seed is not None, "seed prediction must exist"

    state = asyncio.run(run_scan_async(
        company_code="600000", window_days=60,
        financial_data=seed["financial"].model_dump(),
        risk_factors=seed["risk_factors"],
        shap_features=[s.model_dump() for s in seed["shap_features"]],
        prediction_result={
            "stacking": seed["probability"],
            "risk_level": seed["risk_level"].value,
            "catboost": seed["probability"],
            "lightgbm": seed["probability"],
            "tabpfn": seed["probability"],
        },
    ))
    # Must have produced trace events
    assert len(state.trace_events) >= 5
    # Must have at least one of the expected node names
    names = {ev.node_name for ev in state.trace_events}
    assert "planner" in names
    assert "predictor" in names
    assert "attribution_agent" in names
    # Markdown report must be generated
    assert state.report_markdown
    assert "扫雷预警报告" in state.report_markdown
