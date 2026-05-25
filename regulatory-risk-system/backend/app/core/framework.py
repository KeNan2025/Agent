"""
Self-built Agent orchestration framework.

Implements the design from `技术路线与解决方案.md` §3.3.2:
- Pydantic-based shared state (ScanState)
- AgentNode base class with automatic tracing + checkpointing
- AgentGraph state machine with static and conditional edges
- Tracer: full chain-of-thought audit log
- Checkpointer: state snapshot persistence for recovery

Designed to be lightweight (no LangGraph/AutoGen dependency).
"""
from __future__ import annotations

import asyncio
import json
import time
import uuid
from abc import ABC, abstractmethod
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from typing import Any, Callable, Optional

from pydantic import BaseModel, Field

END = "__END__"


# ─────────────────────────── Shared State ───────────────────────────


class TraceEvent(BaseModel):
    """A single recorded event in the agent execution chain."""
    event_id: str = Field(default_factory=lambda: uuid.uuid4().hex[:12])
    scan_id: str
    node_name: str
    action: str
    input_summary: str
    output_summary: str
    skills_called: list[str] = []
    duration_ms: int = 0
    tokens_used: int = 0
    timestamp: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    error: Optional[str] = None


class ScanState(BaseModel):
    """
    Pydantic-typed shared state passed through all agent nodes.
    Includes dynamic planning fields and per-agent outputs.
    """
    # Identifiers
    scan_id: str = Field(default_factory=lambda: f"scan_{uuid.uuid4().hex[:10]}")
    company_code: str
    window_days: int = 60

    # Dynamic planning
    risk_hypothesis: list[str] = []
    analysis_plan: list[str] = []
    completed_steps: list[str] = []
    replan_count: int = 0

    # Per-agent outputs
    financial_features: Optional[dict] = None
    financial_anomalies: Optional[dict] = None
    announcement_analysis: Optional[dict] = None
    graph_risks: Optional[dict] = None
    similar_cases: Optional[list[dict]] = None
    prediction_result: Optional[dict] = None
    attribution: Optional[dict] = None

    # Final output containers
    risk_factors: list[dict] = []
    shap_features: list[dict] = []
    report_markdown: Optional[str] = None

    # Tracing
    trace_events: list[TraceEvent] = []

    def add_event(self, ev: TraceEvent) -> None:
        self.trace_events.append(ev)

    def needs_more_analysis(self) -> bool:
        """Heuristic: trigger replanning when high severity factors uncovered late."""
        # If announcement agent produced new high-risk categories not in hypothesis → replan
        ann = self.announcement_analysis or {}
        cats = set(ann.get("categories", []))
        hyp = set(self.risk_hypothesis)
        return bool(cats - hyp) and self.replan_count < 2


class NodeOutcome(BaseModel):
    """Optional explicit outcome a node may return to drive conditional routing."""
    state: ScanState
    branch: Optional[str] = None  # used by routers if set


# ─────────────────────────── Tracer & Checkpointer ───────────────────────────


class Tracer:
    """
    Records every node/skill execution. By default writes to in-memory + JSONL file.
    Pluggable: replace `_persist` with PostgreSQL/Mongo write for production.
    """

    def __init__(self, log_dir: Path | None = None):
        self.log_dir = log_dir or Path("data/traces")
        self.log_dir.mkdir(parents=True, exist_ok=True)
        self._memory: dict[str, list[TraceEvent]] = defaultdict(list)

    def record(self, event: TraceEvent) -> None:
        self._memory[event.scan_id].append(event)
        self._persist(event)

    def _persist(self, event: TraceEvent) -> None:
        path = self.log_dir / f"{event.scan_id}.jsonl"
        with path.open("a", encoding="utf-8") as f:
            f.write(event.model_dump_json() + "\n")

    def get_trace(self, scan_id: str) -> list[TraceEvent]:
        if scan_id in self._memory:
            return self._memory[scan_id]
        # Fallback: read from disk
        path = self.log_dir / f"{scan_id}.jsonl"
        if not path.exists():
            return []
        events = []
        with path.open("r", encoding="utf-8") as f:
            for line in f:
                if line.strip():
                    events.append(TraceEvent.model_validate_json(line))
        return events

    def export_json(self, scan_id: str) -> str:
        events = self.get_trace(scan_id)
        return json.dumps([e.model_dump() for e in events], ensure_ascii=False, indent=2)


class Checkpointer:
    """
    State snapshot persistence. Saves a JSON snapshot of ScanState after each node.
    Enables crash recovery and time-travel replay.
    """

    def __init__(self, ckpt_dir: Path | None = None):
        self.ckpt_dir = ckpt_dir or Path("data/checkpoints")
        self.ckpt_dir.mkdir(parents=True, exist_ok=True)

    def save(self, state: ScanState, node_name: str) -> None:
        path = self.ckpt_dir / f"{state.scan_id}__{node_name}.json"
        with path.open("w", encoding="utf-8") as f:
            f.write(state.model_dump_json())

    def load_latest(self, scan_id: str) -> ScanState | None:
        # Find the most recently modified checkpoint for this scan_id
        candidates = sorted(
            self.ckpt_dir.glob(f"{scan_id}__*.json"),
            key=lambda p: p.stat().st_mtime,
        )
        if not candidates:
            return None
        with candidates[-1].open("r", encoding="utf-8") as f:
            return ScanState.model_validate_json(f.read())

    def list_checkpoints(self, scan_id: str) -> list[str]:
        files = sorted(self.ckpt_dir.glob(f"{scan_id}__*.json"))
        return [p.stem.split("__", 1)[1] for p in files]


# ─────────────────────────── Agent Node ───────────────────────────


class AgentNode(ABC):
    """
    Base class for all agent nodes.
    Subclasses implement `execute(state) -> state`.
    Automatic tracing, error handling, and checkpointing are wrapped here.
    """

    name: str = ""
    description: str = ""

    def __init__(
        self,
        tracer: Tracer | None = None,
        checkpointer: Checkpointer | None = None,
    ):
        self.tracer = tracer
        self.checkpointer = checkpointer
        if not self.name:
            self.name = self.__class__.__name__

    async def __call__(self, state: ScanState) -> ScanState:
        start = time.time()
        try:
            new_state = await self.execute(state)
        except Exception as exc:
            duration_ms = int((time.time() - start) * 1000)
            err_event = TraceEvent(
                scan_id=state.scan_id, node_name=self.name,
                action="ERROR", input_summary=self._summarize_input(state),
                output_summary="", duration_ms=duration_ms,
                error=f"{type(exc).__name__}: {exc}",
            )
            if self.tracer:
                self.tracer.record(err_event)
            state.add_event(err_event)
            raise
        duration_ms = int((time.time() - start) * 1000)
        if self.name not in new_state.completed_steps:
            new_state.completed_steps.append(self.name)
        # Build trace event
        ev = TraceEvent(
            scan_id=new_state.scan_id, node_name=self.name,
            action=getattr(self, "action", self.description or "execute"),
            input_summary=self._summarize_input(state),
            output_summary=self._summarize_output(new_state),
            skills_called=getattr(self, "_skills_called", []),
            duration_ms=duration_ms,
            tokens_used=getattr(self, "_tokens_used", 0),
        )
        if self.tracer:
            self.tracer.record(ev)
        new_state.add_event(ev)
        if self.checkpointer:
            self.checkpointer.save(new_state, self.name)
        # Reset per-call counters
        self._skills_called = []
        self._tokens_used = 0
        return new_state

    @abstractmethod
    async def execute(self, state: ScanState) -> ScanState:
        ...

    def _summarize_input(self, state: ScanState) -> str:
        return f"company={state.company_code}, window={state.window_days}d, completed={len(state.completed_steps)}"

    def _summarize_output(self, state: ScanState) -> str:
        # Override in subclasses for richer output
        return f"completed_steps={state.completed_steps[-3:]}"

    def _record_skill(self, skill_name: str) -> None:
        if not hasattr(self, "_skills_called"):
            self._skills_called = []
        self._skills_called.append(skill_name)

    def _record_tokens(self, n: int) -> None:
        if not hasattr(self, "_tokens_used"):
            self._tokens_used = 0
        self._tokens_used += n


# ─────────────────────────── Agent Graph ───────────────────────────


RouterFunc = Callable[[ScanState], str]


class AgentGraph:
    """
    State-machine driven orchestration.
    - add_node: register a node
    - add_edge: static next-node mapping
    - add_conditional_edges: branching based on router function
    - entry: starting node
    - run: execute until END
    """

    def __init__(
        self,
        tracer: Tracer | None = None,
        checkpointer: Checkpointer | None = None,
        max_steps: int = 50,
    ):
        self.nodes: dict[str, AgentNode] = {}
        self.edges: dict[str, str] = {}  # src -> dst
        self.cond_edges: dict[str, tuple[RouterFunc, dict[str, str]]] = {}
        self.entry: str = ""
        self.tracer = tracer or Tracer()
        self.checkpointer = checkpointer or Checkpointer()
        self.max_steps = max_steps

    def add_node(self, node: AgentNode, name: str | None = None) -> "AgentGraph":
        # Inject tracer/checkpointer if missing
        if node.tracer is None:
            node.tracer = self.tracer
        if node.checkpointer is None:
            node.checkpointer = self.checkpointer
        key = name or node.name
        node.name = key
        self.nodes[key] = node
        return self

    def add_edge(self, src: str, dst: str) -> "AgentGraph":
        self.edges[src] = dst
        return self

    def add_conditional_edges(
        self, src: str, router: RouterFunc, mapping: dict[str, str]
    ) -> "AgentGraph":
        self.cond_edges[src] = (router, mapping)
        return self

    def set_entry(self, name: str) -> "AgentGraph":
        self.entry = name
        return self

    async def run(self, initial_state: ScanState) -> ScanState:
        if not self.entry:
            raise RuntimeError("Graph entry node not set")
        current = self.entry
        state = initial_state
        steps = 0
        while current != END:
            if steps >= self.max_steps:
                raise RuntimeError(f"Graph exceeded max_steps={self.max_steps}")
            node = self.nodes.get(current)
            if node is None:
                raise RuntimeError(f"Unknown node: {current}")
            state = await node(state)
            steps += 1
            current = self._next_node(current, state)
        return state

    def _next_node(self, current: str, state: ScanState) -> str:
        if current in self.cond_edges:
            router, mapping = self.cond_edges[current]
            key = router(state)
            return mapping.get(key, END)
        return self.edges.get(current, END)

    def export_mermaid(self) -> str:
        """Render the graph as Mermaid flowchart for documentation."""
        lines = ["flowchart TD"]
        for src, dst in self.edges.items():
            lines.append(f"    {src} --> {dst}")
        for src, (_, mapping) in self.cond_edges.items():
            for key, dst in mapping.items():
                lines.append(f"    {src} -->|{key}| {dst}")
        return "\n".join(lines)


# ─────────────────────────── Helper Decorators ───────────────────────────


def parallel_gather(*nodes: AgentNode) -> AgentNode:
    """
    Compose multiple nodes to run concurrently. Useful for "parallel_fork" branch.
    Returns a new AgentNode whose execute awaits all in parallel.
    """

    class ParallelNode(AgentNode):
        name = "parallel_" + "_".join(n.name for n in nodes)

        async def execute(self, state: ScanState) -> ScanState:
            tasks = [n(state.model_copy(deep=True)) for n in nodes]
            results = await asyncio.gather(*tasks)
            # Merge: take fields that are non-None from any branch
            merged = results[0]
            for r in results[1:]:
                for field in r.model_fields:
                    val = getattr(r, field)
                    cur = getattr(merged, field)
                    if val is not None and cur is None:
                        setattr(merged, field, val)
            return merged

    return ParallelNode()
