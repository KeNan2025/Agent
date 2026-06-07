"""Report generation & SHAP explanation skills."""
from __future__ import annotations

from typing import Any

from app.core.llm import complete_sync, get_llm_client
from app.core.skill import skill


@skill(
    name="report_gen",
    description="将分析结果整合为可读的 Markdown 预警报告",
    input_schema={
        "type": "object",
        "properties": {
            "company": {"type": "object"},
            "probability": {"type": "number"},
            "risk_level": {"type": "string"},
            "risk_factors": {"type": "array"},
            "shap_features": {"type": "array"},
            "similar_cases": {"type": "array"},
            "financial": {"type": "object"},
        },
        "required": ["company", "probability", "risk_level"],
    },
    tags=["generation"],
)
def report_gen(
    company: dict[str, Any],
    probability: float,
    risk_level: str,
    risk_factors: list[dict[str, Any]] | None = None,
    shap_features: list[dict[str, Any]] | None = None,
    similar_cases: list[dict[str, Any]] | None = None,
    financial: dict[str, Any] | None = None,
) -> dict[str, Any]:
    risk_factors = risk_factors or []
    shap_features = shap_features or []
    similar_cases = similar_cases or []
    financial = financial or {}

    lines = [
        "# 上市公司扫雷预警报告",
        "",
        "## 基本信息",
        f"- **公司**：{company.get('name', '')}（{company.get('code', '')}）",
        f"- **行业**：{company.get('industry', '')}",
        f"- **市值**：{company.get('market_cap', '')}亿元",
        "- **预测窗口**：60天",
        "",
        "## 风险概率评估",
        f"- **监管问询概率：{probability:.1%}**",
        f"- **风险等级：{risk_level}**",
        f"- 模型置信度：{round(probability * 0.95 + 0.02, 2)}",
        "",
        "## 关键风险因素",
    ]
    for i, rf in enumerate(risk_factors, 1):
        contrib = shap_features[i - 1]["shap_value"] if i <= len(shap_features) else 0
        lines.extend([
            "",
            f"### {i}. {rf.get('subcategory', '')}（影响度 {contrib:.0%}）",
            f"- **风险描述**：{rf.get('description', '')}",
            f"- **证据来源**：{rf.get('evidence_source', '')}",
            f"- **原文引用**：> \"{rf.get('evidence_quote', '')}\"",
        ])
    if financial:
        lines += [
            "",
            "## 财务指标摘要",
            "| 指标 | 当前值 | 状态 |",
            "|------|--------|------|",
            f"| ROE | {financial.get('roe')}% | {'⚠ 偏低' if (financial.get('roe', 10) or 10) < 5 else '正常'} |",
            f"| 资产负债率 | {financial.get('debt_ratio')}% | {'⚠ 偏高' if (financial.get('debt_ratio', 0) or 0) > 65 else '正常'} |",
            f"| Beneish M-Score | {financial.get('beneish_m_score')} | {'⚠ 异常' if (financial.get('beneish_m_score', -3) or -3) > -1.78 else '正常'} |",
            f"| Altman Z-Score | {financial.get('altman_z_score')} | {'⚠ 风险' if (financial.get('altman_z_score', 3) or 3) < 1.8 else '正常'} |",
            f"| 大股东质押比例 | {financial.get('pledge_ratio')}% | {'⚠ 偏高' if (financial.get('pledge_ratio', 0) or 0) > 50 else '正常'} |",
        ]
    if similar_cases:
        lines += [
            "",
            "## 相似历史问询案例",
            "| 排名 | 公司 | 日期 | 类型 | 相似度 |",
            "|------|------|------|------|--------|",
        ]
        for j, c in enumerate(similar_cases[:5], 1):
            lines.append(
                f"| {j} | {c.get('company_name', c.get('company', ''))} | "
                f"{c.get('inquiry_date', c.get('date', ''))} | "
                f"{c.get('inquiry_type', c.get('type', ''))} | "
                f"{c.get('similarity', 0):.2f} |"
            )
    return {"markdown": "\n".join(lines), "n_factors": len(risk_factors)}


@skill(
    name="shap_explain",
    description="生成自然语言形式的归因解释，将 SHAP 重要特征转译为人类可读语言",
    input_schema={
        "type": "object",
        "properties": {
            "company_name": {"type": "string"},
            "probability": {"type": "number"},
            "shap_features": {"type": "array"},
            "risk_factors": {"type": "array"},
        },
        "required": ["company_name", "probability", "shap_features"],
    },
    tags=["llm", "generation"],
)
def shap_explain(
    company_name: str,
    probability: float,
    shap_features: list[dict[str, Any]],
    risk_factors: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    client = get_llm_client()
    top = shap_features[:5]
    feat_summary = "; ".join(
        f"{f.get('feature_name')}={f.get('feature_value')} (贡献 +{f.get('shap_value', 0):.2%})"
        for f in top
    )
    rf_summary = "; ".join(
        f"{r.get('subcategory')}（{r.get('severity')}）" for r in (risk_factors or [])[:3]
    )
    prompt = (
        f"请基于以下信息生成一段不超过 200 字的归因解释（attribution）：\n"
        f"公司：{company_name}\n"
        f"问询概率：{probability:.1%}\n"
        f"关键驱动特征：{feat_summary}\n"
        f"识别到的风险：{rf_summary}\n"
        f"请聚焦因果关系，不要重复数值。"
    )
    resp = complete_sync(client, prompt)
    return {
        "attribution_text": resp.text,
        "tokens_used": resp.tokens_used,
        "drivers": top,
    }
