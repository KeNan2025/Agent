"""Tests for the self-built Agent framework."""
import asyncio

import pytest

from app.core.framework import (
    AgentGraph, AgentNode, Checkpointer, ScanState, Tracer, END,
)


class _Inc(AgentNode):
    name = "inc"
    action = "increment counter"

    async def execute(self, state: ScanState) -> ScanState:
        state.completed_steps.append("counter+1")
        return state


class _Branch(AgentNode):
    name = "branch"
    action = "set hypothesis"

    async def execute(self, state: ScanState) -> ScanState:
        state.risk_hypothesis = ["A"]
        return state


def test_state_dump_roundtrip():
    s = ScanState(company_code="600001", window_days=60, risk_hypothesis=["x"])
    raw = s.model_dump_json()
    s2 = ScanState.model_validate_json(raw)
    assert s2.company_code == "600001"
    assert s2.risk_hypothesis == ["x"]


def test_linear_graph_runs_in_order(tmp_path):
    tracer = Tracer(log_dir=tmp_path / "traces")
    ckpt = Checkpointer(ckpt_dir=tmp_path / "ckpt")
    g = AgentGraph(tracer=tracer, checkpointer=ckpt)
    g.add_node(_Inc(), name="a")
    g.add_node(_Inc(), name="b")
    g.add_node(_Inc(), name="c")
    g.set_entry("a").add_edge("a", "b").add_edge("b", "c").add_edge("c", END)

    state = ScanState(company_code="000001")
    out = asyncio.run(g.run(state))
    assert out.completed_steps == ["a", "b", "c"]
    # Three trace events emitted + three checkpoint files
    assert len(tracer.get_trace(out.scan_id)) == 3
    assert sorted(ckpt.list_checkpoints(out.scan_id)) == ["a", "b", "c"]


def test_conditional_routing_picks_branch():
    g = AgentGraph()
    g.add_node(_Branch(), name="start")
    g.add_node(_Inc(), name="A")
    g.add_node(_Inc(), name="B")
    g.set_entry("start")
    g.add_conditional_edges(
        "start",
        lambda s: "A_path" if s.risk_hypothesis == ["A"] else "B_path",
        {"A_path": "A", "B_path": "B"},
    )
    g.add_edge("A", END)
    g.add_edge("B", END)

    out = asyncio.run(g.run(ScanState(company_code="000002")))
    assert "A" in out.completed_steps
    assert "B" not in out.completed_steps


def test_max_steps_safeguard():
    class _Loop(AgentNode):
        name = "loop"
        async def execute(self, s):
            return s
    g = AgentGraph(max_steps=5)
    g.add_node(_Loop(), name="loop")
    g.set_entry("loop").add_edge("loop", "loop")
    with pytest.raises(RuntimeError):
        asyncio.run(g.run(ScanState(company_code="000003")))


def test_error_node_records_trace(tmp_path):
    class _Boom(AgentNode):
        name = "boom"
        async def execute(self, s):
            raise ValueError("planned failure")

    tracer = Tracer(log_dir=tmp_path / "traces")
    g = AgentGraph(tracer=tracer)
    g.add_node(_Boom(), name="boom")
    g.set_entry("boom").add_edge("boom", END)

    with pytest.raises(ValueError):
        asyncio.run(g.run(ScanState(company_code="000004")))
    # Even on error, one trace event should be recorded
    state_id = next(iter(tracer._memory))
    events = tracer.get_trace(state_id)
    assert any(e.error for e in events)


def test_export_mermaid_has_edges():
    g = AgentGraph()
    g.add_node(_Inc(), name="a")
    g.add_node(_Inc(), name="b")
    g.set_entry("a").add_edge("a", "b").add_edge("b", END)
    mer = g.export_mermaid()
    assert "a --> b" in mer
