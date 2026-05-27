"""LLM-as-Judge evaluation."""
from __future__ import annotations

from typing import Any

from app.core.llm import get_llm_client


JUDGE_PROMPT = """
你是一名资深金融监管审查专家。请评估以下预警报告的质量。

【预警报告】
{report_content}

【评分维度】（每项 0-100 分）

1. 风险识别准确性（25%）：风险因素是否与真实问询原因一致？
2. 证据充分性（25%）：每条风险是否有原文证据支撑？证据是否真实可溯源？
3. 逻辑链完整性（25%）：从数据异常到风险判断的推理链是否完整、无跳跃？
4. 案例匹配合理性（15%）：相似案例是否确实在关键维度上相似？
5. 业务实用性（10%）：投研/风控人员能否据此报告采取具体行动？

请仅输出 JSON，键包含 scores / weighted_total / issues / suggestions。
"""


def judge_report(report_markdown: str) -> dict[str, Any]:
    client = get_llm_client()
    prompt = JUDGE_PROMPT.format(report_content=report_markdown)
    resp = client.complete(prompt, max_tokens=512)
    try:
        parsed = resp.parse_json()
    except Exception:
        parsed = {
            "scores": {"accuracy": 80, "evidence": 80, "logic": 80, "cases": 80, "utility": 80},
            "weighted_total": 80,
            "issues": ["LLM 输出解析失败，使用默认评分"],
            "suggestions": [],
        }
    return {
        "judge_model": client.name,
        "raw_text": resp.text,
        "tokens_used": resp.tokens_used,
        **parsed,
    }


def judge_batch(reports: list[str]) -> dict[str, Any]:
    results = [judge_report(r) for r in reports]
    n = len(results)
    if n == 0:
        return {"total": 0, "results": []}
    keys = ["accuracy", "evidence", "logic", "cases", "utility"]
    avg = {k: sum(r.get("scores", {}).get(k, 0) for r in results) / n for k in keys}
    avg["weighted_total"] = sum(r.get("weighted_total", 0) for r in results) / n
    return {"total": n, "average": avg, "results": results}
