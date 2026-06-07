"""
Agent orchestration — refactored on top of the self-built framework.

Each business agent inherits from `AgentNode` and invokes MCP skills via
`get_registry().call(...)`. The graph wires nodes with conditional routing
based on the Planner's risk hypothesis, with a mid-stream Replan node that
can loop back to re-planning when new evidence is uncovered.

Phase 2 upgrade: PlannerNode now uses `complete_with_schema` (structured
output with retry); AnnouncementAgentNode inherits from `BaseAgent` for
real tool-calling; AttributionAgentNode enforces the 5-section report
shape and auto-attaches evidence rows.
"""
from __future__ import annotations

from typing import Any

from app.core import (
    AgentNode, AgentGraph, ScanState,
    END, get_registry, get_llm_client,
)
from app.core.base_agent import BaseAgent
from app.core.framework import Checkpointer, Tracer
from app.core.llm import complete_with_schema
from app.core.logging import get_logger
from app.models.schemas import RiskCategory, RiskFactor
from app.services.report_quality import auto_attach_evidence, enforce_sections

log = get_logger(__name__)


# ─────────────────────────── Agents ───────────────────────────


class PlannerNode(AgentNode):
    name = "planner"
    action = "初始风险假设"

    async def execute(self, state: ScanState) -> ScanState:
        # Phase 2: use structured output with retry; degrade to heuristic
        # only if the LLM client is in mock mode and a pre-baked template fails.
        llm = get_llm_client()
        fin = state.financial_features or {}

        # Phase 5b: pull historical memory for this company so the planner
        # benefits from past scans / regulator-confirmed patterns.
        memory_recall_text = ""
        try:
            from app.services.memory import MemoryServiceClient, build_session
            from app.settings import settings as _settings
            if _settings.features.enable_memo_flux:
                client = MemoryServiceClient()
                session = build_session(user_id=0, company_code=state.company_code)
                items = await client.recall_memory(session, query="风险假设", top_k=3)
                if items:
                    memory_recall_text = "\n【历史记忆】\n" + "\n".join(
                        f"- {it.get('content', '')[:200]}" for it in items
                    )
        except Exception as exc:  # noqa: BLE001
            log.debug("planner.memory_recall_skipped", error=str(exc))

        prompt = (
            f"作为金融风险审查 Planner，请基于下列指标给出风险假设（risk_hypothesis）。\n"
            f"company_code={state.company_code}\n"
            f"Beneish M-Score={fin.get('beneish_m_score')}\n"
            f"质押比例={fin.get('pledge_ratio')}\n"
            f"OCF/利润={fin.get('ocf_to_profit')}\n"
            f"应收增速={fin.get('receivable_growth')}, 收入增速={fin.get('revenue_growth')}\n"
            f"{memory_recall_text}\n"
            f"\n请返回 JSON: {{\"hypothesis\": [\"<category1>\", \"<category2>\", ...]}}\n"
        )
        schema = {"type": "object", "properties": {"hypothesis": {"type": "array", "items": {"type": "string"}}}}
        try:
            data = await complete_with_schema(
                llm, prompt, schema,
                scan_id=state.scan_id, agent_name=self.name,
            )
            hyp = list(data.get("hypothesis") or [])
        except Exception as exc:  # noqa: BLE001
            log.warning("planner.structured_failed", error=str(exc))
            hyp = self._heuristic_hypothesis(fin)
        if not hyp:
            hyp = ["财务异常"]
        state.risk_hypothesis = hyp

        # Pick a plan template based on the leading hypothesis
        leading = hyp[0]
        state.analysis_plan = self._plan_for(leading)
        return state

    @staticmethod
    def _heuristic_hypothesis(fin: dict) -> list[str]:
        hyp = []
        if fin.get("beneish_m_score", -3) > -2.0 or (fin.get("ocf_to_profit", 1) or 1) < 0.3:
            hyp.append("财务异常")
        if (fin.get("pledge_ratio", 0) or 0) > 40:
            hyp.append("公司治理")
        if not hyp:
            hyp.append("信息披露")
        return hyp

    @staticmethod
    def _plan_for(leading: str) -> list[str]:
        if leading == "公司治理":
            return ["graph_agent", "financial_agent", "announcement_agent",
                    "predictor", "case_agent", "attribution_agent"]
        if leading == "关联交易":
            return ["graph_agent", "announcement_agent", "financial_agent",
                    "predictor", "case_agent", "attribution_agent"]
        return ["financial_agent", "announcement_agent",
                "predictor", "case_agent", "attribution_agent"]


class FinancialAgentNode(AgentNode):
    name = "financial_agent"
    action = "财务指标计算与异常评分"

    async def execute(self, state: ScanState) -> ScanState:
        reg = get_registry()
        fin = state.financial_features or {}
        self._record_skill("financial_calc")
        self._record_skill("anomaly_score")
        self._record_skill("industry_compare")
        anomalies = reg.call("anomaly_score", financial_data=fin).get("result", {})
        state.financial_anomalies = anomalies
        return state

    def _summarize_output(self, state: ScanState) -> str:
        a = state.financial_anomalies or {}
        return f"检出 {a.get('anomaly_count', 0)} 项异常, score={a.get('score', 0)}"


class AnnouncementAgentNode(BaseAgent):
    """Phase 2: real tool-calling agent.

    Lets the LLM decide whether to call `announcement_search`,
    `text_extract`, or `table_parse`, then writes the extracted risk
    factors back into state.
    """
    name = "announcement_agent"
    action = "公告检索与风险要素抽取"
    tools = ["announcement_search", "text_extract", "table_parse"]
    system_prompt = (
        "你是专门负责公司公告解读的金融分析师。"
        "可用工具：announcement_search / text_extract / table_parse。"
        "请基于工具结果抽取监管关注点。"
    )

    def _initial_messages(self, state: ScanState) -> list[dict[str, Any]]:
        hyp = " ".join(state.risk_hypothesis) or "财务异常 收入确认 关联交易"
        return [{
            "role": "user",
            "content": (
                f"目标公司：{state.company_code}\n"
                f"风险假设：{hyp}\n"
                f"请用 announcement_search 检索相关公告，再用 text_extract 抽取风险要素。"
            ),
        }]

    def _extract_final(self, state: ScanState, final_text: str) -> ScanState:
        # Tool calls already updated registry-side state through
        # _dispatch_tool's side effects (the underlying skill returns dicts
        # that aren't auto-written to ScanState here). We therefore keep
        # the announcement_analysis summary in sync with risk_factors.
        categories = list({r["category"] for r in state.risk_factors}) if state.risk_factors else []
        high_count = sum(1 for r in state.risk_factors if r.get("severity") == "高")
        state.announcement_analysis = {
            "total_announcements": len([s for s in (state.completed_steps or []) if "announcement" in s]),
            "risk_factor_count": len(state.risk_factors),
            "high_risk_count": high_count,
            "categories": categories,
            "llm_summary": final_text[:400] if final_text else "",
        }
        return state

    def _summarize_output(self, state: ScanState) -> str:
        a = state.announcement_analysis or {}
        return (
            f"风险要素 {a.get('risk_factor_count', 0)}, "
            f"高风险 {a.get('high_risk_count', 0)}"
        )


class GraphAgentNode(AgentNode):
    name = "graph_agent"
    action = "图谱分析与风险传导"

    async def execute(self, state: ScanState) -> ScanState:
        reg = get_registry()
        self._record_skill("graph_query")
        out = reg.call("graph_query", company_code=state.company_code).get("result", {})
        state.graph_risks = out
        return state

    def _summarize_output(self, state: ScanState) -> str:
        g = state.graph_risks or {}
        metrics = g.get("metrics", {})
        return (
            f"邻居 {g.get('n_neighbours', 0)}, "
            f"已被问询邻居 {g.get('inquired_neighbours', 0)}, "
            f"PageRank={metrics.get('pagerank', 0):.4f}"
        )


class ReplanNode(AgentNode):
    name = "replan"
    action = "中间重规划 (Replan)"

    async def execute(self, state: ScanState) -> ScanState:
        state.replan_count += 1
        if state.needs_more_analysis():
            # Pull missing categories into the plan
            ann = state.announcement_analysis or {}
            new_cats = set(ann.get("categories", [])) - set(state.risk_hypothesis)
            extra: list[str] = []
            if "关联交易" in new_cats and "graph_agent" not in state.completed_steps:
                extra.append("graph_agent")
            for s in extra:
                if s not in state.analysis_plan:
                    state.analysis_plan.append(s)
            state.risk_hypothesis = list(set(state.risk_hypothesis) | new_cats)
            self._record_tokens(280)
        else:
            self._record_tokens(180)
        return state

    def _summarize_output(self, state: ScanState) -> str:
        return f"replan #{state.replan_count}; hypothesis={state.risk_hypothesis}"


class PredictorNode(AgentNode):
    name = "predictor"
    action = "多模型融合预测 + 真 SHAP"

    async def execute(self, state: ScanState) -> ScanState:
        # Phase 3: re-run the ensemble inference here (instead of relying
        # on the API layer), then compute real SHAP on the resulting row.
        # If the API layer already supplied a prediction, skip — this
        # prevents double-counting the predictor in the trace.
        pred = state.prediction_result or {}
        if "stacking" in pred and pred.get("stacking") is not None:
            return state
        try:
            from app.features.engineer import FEATURE_NAMES, FeatureEngineer
            from app.ml.training import get_or_train
            from app.ml.shap_explainer import explain_one
            from app.models.schemas import CompanyInfo
            # Synthesize a minimal CompanyInfo for build_vector
            company = CompanyInfo(
                code=state.company_code,
                name=state.company_code,
                industry="",
                market_cap=0.0,
            )
            eng = FeatureEngineer()
            fin = state.financial_features or {}
            graph_metrics: dict = {}
            try:
                from app.graph import get_graph
                graph_metrics = get_graph().metrics_for(state.company_code).to_feature_dict()
            except Exception:
                pass
            vec = eng.build_vector(company, fin, state.risk_factors or [],
                                   history=None, graph_metrics=graph_metrics)
            ens = get_or_train()
            pred_out = ens.predict_one(vec)
            state.prediction_result = pred_out
            sh = explain_one(ens, vec, FEATURE_NAMES, top_k=20)
            if sh:
                state.shap_features = sh
        except Exception as exc:  # noqa: BLE001
            log.warning("predictor.real_run_failed", error=str(exc))
        return state

    def _summarize_output(self, state: ScanState) -> str:
        p = state.prediction_result or {}
        return (
            f"CatBoost={p.get('catboost'):.3f}, LightGBM={p.get('lightgbm'):.3f}, "
            f"TabPFN={p.get('tabpfn'):.3f}, Stacking={p.get('stacking'):.3f}"
            if p else "predictor placeholder"
        )


class CaseAgentNode(AgentNode):
    name = "case_agent"
    action = "相似历史问询案例检索"

    async def execute(self, state: ScanState) -> ScanState:
        self._record_skill("case_match")
        summary = " ".join(state.risk_hypothesis) or "财务异常"
        reg = get_registry()
        out = reg.call("case_match", risk_summary=summary,
                       categories=state.risk_hypothesis or None,
                       top_k=5).get("result", {})
        raw_cases = out.get("cases", [])
        # Phase 2: rerank via CaseRetrievalService (BM25 + dense) when cases
        # already carry snippet text; otherwise fall back to the raw output.
        if raw_cases and all("snippet" in c for c in raw_cases):
            try:
                from app.services.case_retrieval import retrieve_similar_cases
                reranked = retrieve_similar_cases(summary, raw_cases, top_k=5)
                if reranked:
                    raw_cases = reranked
            except Exception:  # noqa: BLE001
                pass
        # Translate cases to the schema used by the API
        translated: list[dict[str, Any]] = []
        for c in raw_cases:
            company_str = c.get("company", "")
            # Two possible shapes: structured `company_name/company_code`
            # fields, or a single "name(600000)" string.
            if c.get("company_name") and c.get("company_code"):
                name = c["company_name"]
                code = c["company_code"]
            elif "(" in company_str and company_str.endswith(")"):
                name, _, rest = company_str.partition("(")
                code = rest.rstrip(")")
            else:
                name = company_str
                code = company_str
            translated.append({
                "company_code": code,
                "company_name": name,
                "inquiry_date": c.get("inquiry_date") or c.get("date", ""),
                "inquiry_type": c.get("inquiry_type") or c.get("type", ""),
                "similarity": c.get("similarity", 0),
                "match_dimensions": (
                    c.get("match_dimensions")
                    or "+".join(c.get("categories", []))[:60]
                ),
                "key_difference": c.get("key_difference") or c.get("focus", ""),
            })
        state.similar_cases = translated
        self._record_tokens(900)
        return state

    def _summarize_output(self, state: ScanState) -> str:
        n = len(state.similar_cases or [])
        top = (state.similar_cases or [{}])[0].get("similarity", 0) if state.similar_cases else 0
        return f"Top-{n} 案例, 最高相似度={top:.2f}"


class AttributionAgentNode(AgentNode):
    name = "attribution_agent"
    action = "生成可解释预警报告"

    async def execute(self, state: ScanState) -> ScanState:
        reg = get_registry()
        self._record_skill("shap_explain")
        self._record_skill("report_gen")
        company = {"name": state.company_code, "code": state.company_code}
        probability = (state.prediction_result or {}).get("stacking", 0.5)
        risk_level = (state.prediction_result or {}).get("risk_level", "中风险")
        explain = reg.call(
            "shap_explain",
            company_name=state.company_code,
            probability=probability,
            shap_features=state.shap_features,
            risk_factors=state.risk_factors,
        ).get("result", {})
        report = reg.call(
            "report_gen",
            company=company,
            probability=probability,
            risk_level=risk_level,
            risk_factors=state.risk_factors,
            shap_features=state.shap_features,
            similar_cases=state.similar_cases or [],
            financial=state.financial_features or {},
        ).get("result", {})
        state.attribution = explain
        report_md = report.get("markdown") or ""
        # Phase 2: enforce required H2 sections and auto-attach evidence rows
        report_md = enforce_sections(report_md, risk_level=risk_level, probability=probability)
        report_md = auto_attach_evidence(report_md, state.risk_factors or [])
        state.report_markdown = report_md
        self._record_tokens(explain.get("tokens_used", 1500))

        # Phase 5b: write a memo for future planner recall — best effort.
        try:
            from app.services.memory import MemoryServiceClient, build_session
            from app.settings import settings as _settings
            if _settings.features.enable_memo_flux:
                client = MemoryServiceClient()
                session = build_session(user_id=0, company_code=state.company_code)
                top_factors = [r.get("subcategory", "") for r in state.risk_factors[:3]]
                content = (
                    f"[CASE_PATTERN] 概率={probability:.2f} 等级={risk_level} "
                    f"主要风险={top_factors}"
                )
                await client.write_memory(session, content)
        except Exception as exc:  # noqa: BLE001
            log.debug("attribution.memory_write_skipped", error=str(exc))
        return state


# ─────────────────────────── Graph factory ───────────────────────────


def build_graph(
    tracer: Tracer | None = None, checkpointer: Checkpointer | None = None,
) -> AgentGraph:
    """Build the agent graph.

    Topology:
        planner → parallel_vertical (financial ⊕ announcement ⊕ graph)
                → replan → (loop or to_predict)
                → predictor → case → attribution → END

    The single-node FinancialAgentNode / AnnouncementAgentNode /
    GraphAgentNode instances are no longer registered as individual
    graph nodes (the ParallelNode wraps fresh instances). This avoids
    dead nodes that would never be visited under the new routing.
    """
    from app.core.framework import parallel_gather
    g = AgentGraph(tracer=tracer, checkpointer=checkpointer)
    g.add_node(PlannerNode())
    g.add_node(ReplanNode())
    g.add_node(PredictorNode())
    g.add_node(CaseAgentNode())
    g.add_node(AttributionAgentNode())

    # Phase 2: real parallel fork for the three vertical analysis agents.
    parallel_node = parallel_gather(
        FinancialAgentNode(),
        AnnouncementAgentNode(),
        GraphAgentNode(),
    )
    g.add_node(parallel_node, name="parallel_vertical")
    g.set_entry("planner")

    # Planner → parallel vertical (all hypothesis branches converge)
    g.add_edge("planner", "parallel_vertical")
    g.add_edge("parallel_vertical", "replan")

    # Replan branches: loop back to the parallel fork once, or continue
    def replan_route(state: ScanState) -> str:
        if state.replan_count <= 1 and state.needs_more_analysis():
            return "more_vertical"
        return "to_predict"

    g.add_conditional_edges("replan", replan_route, {
        "more_vertical": "parallel_vertical",
        "to_predict": "predictor",
    })

    g.add_edge("predictor", "case_agent")
    g.add_edge("case_agent", "attribution_agent")
    g.add_edge("attribution_agent", END)
    return g


# ─────────────────────────── Public entrypoint ───────────────────────────


async def run_scan_async(
    company_code: str, window_days: int,
    financial_data: dict[str, Any],
    risk_factors: list[RiskFactor] | list[dict],
    shap_features: list[dict] | None = None,
    prediction_result: dict | None = None,
    tracer: Tracer | None = None,
    checkpointer: Checkpointer | None = None,
) -> ScanState:
    """Run the full graph; return the final ScanState."""
    # Normalise risk_factors → list[dict]
    rf_dicts = []
    for r in risk_factors:
        if isinstance(r, RiskFactor):
            rf_dicts.append({
                "category": r.category.value if hasattr(r.category, "value") else r.category,
                "subcategory": r.subcategory,
                "description": r.description,
                "evidence_quote": r.evidence_quote,
                "evidence_source": r.evidence_source,
                "severity": r.severity,
                "confidence": r.confidence,
            })
        elif isinstance(r, dict):
            rf_dicts.append(r)
    state = ScanState(
        company_code=company_code, window_days=window_days,
        financial_features=financial_data,
        risk_factors=rf_dicts,
        shap_features=shap_features or [],
        prediction_result=prediction_result or {},
    )
    graph = build_graph(tracer=tracer, checkpointer=checkpointer)
    final = await graph.run(state)
    return final


def run_scan(
    company_code: str, window_days: int,
    financial_data: dict[str, Any],
    risk_factors: list[RiskFactor] | list[dict],
    shap_features: list[dict] | None = None,
    prediction_result: dict | None = None,
) -> ScanState:
    """Sync wrapper for places that don't want to manage the event loop."""
    import asyncio
    return asyncio.run(run_scan_async(
        company_code=company_code, window_days=window_days,
        financial_data=financial_data, risk_factors=risk_factors,
        shap_features=shap_features, prediction_result=prediction_result,
    ))


# Backwards-compatible legacy entrypoint used by older routes / tests
def run_scan_pipeline(
    company_code: str, window_days: int,
    financial_data: dict[str, Any],
    risk_factors: list[RiskFactor],
    similar_cases: list,
    probability: float,
    risk_level: str,
) -> list:
    """Legacy: return the trace as a list of AgentStep-shaped dicts."""
    from app.models.schemas import AgentStep
    state = run_scan(
        company_code=company_code, window_days=window_days,
        financial_data=financial_data, risk_factors=risk_factors,
        shap_features=[],
        prediction_result={
            "catboost": probability, "lightgbm": probability,
            "tabpfn": probability, "stacking": probability,
            "risk_level": risk_level,
        },
    )
    steps = []
    for i, ev in enumerate(state.trace_events, 1):
        steps.append(AgentStep(
            step_id=i,
            agent_name=ev.node_name,
            action=ev.action,
            input_summary=ev.input_summary,
            output_summary=ev.output_summary,
            skills_called=ev.skills_called,
            duration_ms=ev.duration_ms,
            tokens_used=ev.tokens_used,
        ))
    return steps
