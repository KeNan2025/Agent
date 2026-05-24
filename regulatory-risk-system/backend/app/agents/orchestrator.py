"""
Agentic AI orchestration for regulatory risk scanning.
Uses a state-graph pattern mimicking LangGraph's StateGraph.
In mock mode, all LLM calls return pre-configured templates.
When real LLM is connected, swap MockLLM with actual API client.
"""
from __future__ import annotations
import time
from dataclasses import dataclass, field
from typing import Any
from app.models.schemas import AgentStep, RiskFactor, RiskCategory


@dataclass
class ScanState:
    company_code: str
    window_days: int = 60
    risk_hypothesis: list[str] = field(default_factory=list)
    analysis_plan: list[str] = field(default_factory=list)
    completed_steps: list[str] = field(default_factory=list)
    announcement_analysis: dict | None = None
    financial_anomalies: dict | None = None
    graph_risks: dict | None = None
    similar_cases: list[dict] | None = None
    prediction_result: dict | None = None
    trace: list[AgentStep] = field(default_factory=list)
    step_counter: int = 0

    def add_step(self, agent_name: str, action: str, input_summary: str,
                 output_summary: str, skills: list[str], duration_ms: int, tokens: int):
        self.step_counter += 1
        self.trace.append(AgentStep(
            step_id=self.step_counter,
            agent_name=agent_name,
            action=action,
            input_summary=input_summary,
            output_summary=output_summary,
            skills_called=skills,
            duration_ms=duration_ms,
            tokens_used=tokens,
        ))


class MockLLM:
    """Simulates LLM responses for demo. Replace with real API client."""

    def generate_hypothesis(self, financial_data: dict) -> list[str]:
        hypotheses = []
        if financial_data.get("beneish_m_score", -3) > -2.0:
            hypotheses.append("财务异常")
        if financial_data.get("pledge_ratio", 0) > 40:
            hypotheses.append("公司治理")
        if financial_data.get("ocf_to_profit", 1) < 0.3:
            hypotheses.append("经营合理性")
        if not hypotheses:
            hypotheses.append("信息披露")
        return hypotheses

    def extract_risk_factors(self, text_chunks: list[str], hypothesis: str) -> list[dict]:
        return [{"extracted": True, "hypothesis": hypothesis}]

    def generate_attribution(self, all_results: dict) -> str:
        return "基于多维度分析，该公司在财务指标、公告语义、关联关系等方面存在异常信号。"

    def should_replan(self, state: ScanState) -> bool:
        return len(state.completed_steps) == 2 and "关联交易" in str(state.risk_hypothesis)


class MasterPlannerAgent:
    def __init__(self, llm: MockLLM):
        self.llm = llm

    def initial_plan(self, state: ScanState, financial_data: dict) -> ScanState:
        start = time.time()
        state.risk_hypothesis = self.llm.generate_hypothesis(financial_data)
        primary = state.risk_hypothesis[0] if state.risk_hypothesis else "财务异常"
        if primary == "财务异常":
            state.analysis_plan = ["financial_agent", "announcement_agent", "predictor", "case_agent", "attribution_agent"]
        elif primary == "公司治理":
            state.analysis_plan = ["graph_agent", "financial_agent", "announcement_agent", "predictor", "case_agent", "attribution_agent"]
        else:
            state.analysis_plan = ["announcement_agent", "financial_agent", "predictor", "case_agent", "attribution_agent"]

        elapsed = int((time.time() - start) * 1000) + 150
        state.add_step(
            "Master Planner", "初始风险假设",
            f"公司代码={state.company_code}, 窗口={state.window_days}天",
            f"初始假设: {primary}型风险为主 → 分析计划: {' → '.join(state.analysis_plan)}",
            [], elapsed, 450,
        )
        return state

    def replan(self, state: ScanState) -> ScanState:
        if self.llm.should_replan(state):
            state.analysis_plan.insert(0, "graph_agent")
            state.add_step(
                "Master Planner", "中间重规划 (Replan)",
                f"已完成: {state.completed_steps}",
                "发现关联交易线索 → 追加图谱分析Agent",
                [], 200, 350,
            )
        else:
            state.add_step(
                "Master Planner", "中间重规划 (Replan)",
                f"已完成: {state.completed_steps}",
                "风险画像已充分 → 进入预测阶段",
                [], 120, 250,
            )
        return state


class FinancialAgent:
    def run(self, state: ScanState, financial_data: dict) -> ScanState:
        start = time.time()
        anomalies = []
        if financial_data.get("beneish_m_score", -3) > -2.22:
            anomalies.append(f"Beneish M-Score={financial_data['beneish_m_score']} (>-2.22 警戒线)")
        if financial_data.get("altman_z_score", 3) < 1.81:
            anomalies.append(f"Altman Z-Score={financial_data['altman_z_score']} (<1.81 危险区)")
        if financial_data.get("ocf_to_profit", 1) < 0.3:
            anomalies.append(f"经营现金流/净利润={financial_data['ocf_to_profit']} (严重背离)")
        if financial_data.get("receivable_growth", 0) > financial_data.get("revenue_growth", 0) * 1.5:
            anomalies.append("应收增速远超收入增速")
        if financial_data.get("debt_ratio", 0) > 70:
            anomalies.append(f"资产负债率={financial_data['debt_ratio']}% (偏高)")

        state.financial_anomalies = {
            "anomaly_count": len(anomalies),
            "anomalies": anomalies,
            "beneish": financial_data.get("beneish_m_score"),
            "altman": financial_data.get("altman_z_score"),
        }
        state.completed_steps.append("financial_agent")
        elapsed = int((time.time() - start) * 1000) + 350
        state.add_step(
            "财务异常检测Agent", "财务指标计算与异常评分",
            f"公司代码={state.company_code}, 最近4个季度财务数据",
            f"检出{len(anomalies)}项异常: {'; '.join(anomalies[:3])}",
            ["financial_calc", "anomaly_score", "industry_compare"],
            elapsed, 0,
        )
        return state


class AnnouncementAgent:
    def __init__(self, llm: MockLLM):
        self.llm = llm

    def run(self, state: ScanState, risk_factors: list[RiskFactor]) -> ScanState:
        start = time.time()
        high_count = sum(1 for r in risk_factors if r.severity == "高")
        state.announcement_analysis = {
            "total_announcements": 15 + hash(state.company_code) % 10,
            "risk_factor_count": len(risk_factors),
            "high_risk_count": high_count,
            "categories": list(set(r.category.value for r in risk_factors)),
        }
        state.completed_steps.append("announcement_agent")
        elapsed = int((time.time() - start) * 1000) + 2500
        state.add_step(
            "公告研读Agent", "公告检索与风险要素抽取",
            f"公司代码={state.company_code}, 近12个月公告",
            f"检索到{state.announcement_analysis['total_announcements']}篇公告, "
            f"抽取{len(risk_factors)}项风险要素, 其中{high_count}项高风险",
            ["announcement_search", "text_extract", "table_parse"],
            elapsed, 5500,
        )
        return state


class CaseAgent:
    def run(self, state: ScanState, similar_cases: list) -> ScanState:
        start = time.time()
        top_sim = similar_cases[0].similarity if similar_cases else 0
        state.similar_cases = [c.model_dump() for c in similar_cases]
        state.completed_steps.append("case_agent")
        elapsed = int((time.time() - start) * 1000) + 800
        state.add_step(
            "案例检索Agent", "相似历史问询案例检索",
            "基于风险画像向量进行混合检索 (Qwen3-Embedding + BGE-M3)",
            f"检索到Top-5相似案例, 最高相似度={top_sim:.2f}",
            ["case_match", "evidence_retrieve"],
            elapsed, 1200,
        )
        return state


class PredictorAgent:
    def run(self, state: ScanState, probability: float, risk_level: str) -> ScanState:
        import random
        rng = random.Random(hash(state.company_code))
        cat_score = round(probability + rng.uniform(-0.05, 0.05), 3)
        lgb_score = round(probability + rng.uniform(-0.05, 0.05), 3)
        pfn_score = round(probability + rng.uniform(-0.03, 0.03), 3)
        state.prediction_result = {
            "catboost": max(0, min(1, cat_score)),
            "lightgbm": max(0, min(1, lgb_score)),
            "tabpfn": max(0, min(1, pfn_score)),
            "stacking": probability,
            "risk_level": risk_level,
        }
        state.completed_steps.append("predictor")
        state.add_step(
            "概率预测模型", "多模型融合预测",
            f"特征维度=235, 模型=CatBoost+LightGBM+TabPFN-2.5 Stacking",
            f"CatBoost={cat_score:.3f}, LightGBM={lgb_score:.3f}, TabPFN={pfn_score:.3f} → Stacking={probability:.3f}",
            ["probability_predictor"],
            180, 0,
        )
        return state


class AttributionAgent:
    def __init__(self, llm: MockLLM):
        self.llm = llm

    def run(self, state: ScanState) -> ScanState:
        start = time.time()
        state.completed_steps.append("attribution_agent")
        elapsed = int((time.time() - start) * 1000) + 2000
        state.add_step(
            "归因解释Agent", "生成可解释预警报告",
            "聚合全部分析结果, SHAP分解, 证据关联, 历史案例对比",
            "生成包含风险因素、证据片段、案例对比、推理链路的完整预警报告",
            ["report_gen", "shap_explain"],
            elapsed, 3500,
        )
        return state


def run_scan_pipeline(company_code: str, window_days: int, financial_data: dict,
                      risk_factors: list[RiskFactor], similar_cases: list,
                      probability: float, risk_level: str) -> list[AgentStep]:
    """Execute the full multi-agent scan pipeline and return the trace."""
    llm = MockLLM()
    state = ScanState(company_code=company_code, window_days=window_days)

    planner = MasterPlannerAgent(llm)
    state = planner.initial_plan(state, financial_data)

    fin_agent = FinancialAgent()
    state = fin_agent.run(state, financial_data)

    ann_agent = AnnouncementAgent(llm)
    state = ann_agent.run(state, risk_factors)

    state = planner.replan(state)

    pred_agent = PredictorAgent()
    state = pred_agent.run(state, probability, risk_level)

    case_ag = CaseAgent()
    state = case_ag.run(state, similar_cases)

    attr_agent = AttributionAgent(llm)
    state = attr_agent.run(state)

    return state.trace
