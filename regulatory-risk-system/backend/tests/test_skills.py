"""Tests for the MCP Skill registry and individual skills."""
import pytest

from app.core.skill import get_registry, skill
import app.skills  # noqa: F401 — register all skills


def test_registry_lists_all_skills():
    reg = get_registry()
    names = {s.name for s in reg.list_skills()}
    required = {
        "announcement_search", "text_extract", "table_parse",
        "financial_calc", "anomaly_score", "industry_compare", "rule_check",
        "case_match", "evidence_retrieve",
        "graph_query", "relation_search",
        "report_gen", "shap_explain",
    }
    missing = required - names
    assert not missing, f"missing skills: {missing}"


def test_mcp_protocol_payload():
    reg = get_registry()
    payload = reg.to_mcp_list()
    assert isinstance(payload, list)
    for tool in payload:
        assert "name" in tool
        assert "description" in tool
        assert "inputSchema" in tool
        assert tool["inputSchema"]["type"] == "object"


def test_skill_call_success():
    reg = get_registry()
    out = reg.call("anomaly_score", financial_data={
        "beneish_m_score": -1.2, "altman_z_score": 1.5,
        "ocf_to_profit": 0.1, "receivable_growth": 80, "revenue_growth": 20,
        "pledge_ratio": 70, "debt_ratio": 80,
    })
    assert out["ok"] is True
    assert out["result"]["anomaly_count"] >= 4


def test_skill_call_unknown():
    reg = get_registry()
    out = reg.call("__not_a_skill__")
    assert out["ok"] is False
    assert "unknown" in out["error"].lower()


def test_decorator_collision_blocked():
    with pytest.raises(ValueError):
        @skill(name="financial_calc", description="duplicate")
        def _dup(x: int) -> int:
            return x
