"""
Report quality: shape check + evidence auto-attach.

For the LLM-generated Markdown report, enforce that required H2 sections
are present, and that each risk-factor description has at least one
evidence snippet. The judges in the competition score both completeness
(regulation focus coverage ≥ 80%) and traceability (evidence recall ≥ 85%).
"""
from __future__ import annotations

import re
from typing import Any

# Required H2 sections (in any order). Matches the four pillars of regulation
# inquiry analysis plus a top-level conclusion.
REQUIRED_SECTIONS = [
    "## 风险等级与概率",      # risk level + probability
    "## 主要风险因素",        # main risk factors
    "## 监管关注点",          # regulation focus points
    "## 原文证据",            # original text evidence
    "## 复核建议",            # recommended next-step
]


def check_report_shape(markdown: str | None) -> dict[str, Any]:
    """Return a dict {ok, missing, present} describing the report shape."""
    if not markdown:
        return {"ok": False, "missing": REQUIRED_SECTIONS, "present": []}
    headings = {h for h in re.findall(r"^## .+$", markdown, flags=re.MULTILINE)}
    present = [h for h in REQUIRED_SECTIONS if h in headings]
    missing = [h for h in REQUIRED_SECTIONS if h not in headings]
    return {"ok": not missing, "missing": missing, "present": present}


def enforce_sections(markdown: str, *, risk_level: str, probability: float) -> str:
    """Append any missing required H2 sections with placeholder content.

    Best-effort: if the LLM forgot a section, we don't fail the scan; we
    just ensure the report is reviewable.
    """
    if not markdown:
        markdown = ""
    result = check_report_shape(markdown)
    if result["ok"]:
        return markdown
    for sec in result["missing"]:
        placeholder = _placeholder_for(sec, risk_level=risk_level, probability=probability)
        markdown = markdown.rstrip() + "\n\n" + sec + "\n\n" + placeholder + "\n"
    return markdown


def auto_attach_evidence(
    markdown: str,
    risk_factors: list[dict[str, Any]],
    *,
    default_evidence: list[dict[str, Any]] | None = None,
) -> str:
    """If the report lacks an "原文证据" section, append one from risk_factors.

    Each risk factor should already carry an `evidence_quote` + `evidence_source`
    pair (see app.models.risk_assessment.RiskFactor). This helper extracts them
    and renders a Markdown table under the section.
    """
    if not markdown or "## 原文证据" in markdown:
        return markdown
    lines = ["## 原文证据", ""]
    rows: list[dict[str, str]] = []
    for rf in risk_factors or []:
        for ev in rf.get("evidence") or []:
            rows.append({
                "category": rf.get("subcategory") or rf.get("category") or "—",
                "source": ev.get("source") or ev.get("source_id") or "—",
                "snippet": (ev.get("snippet") or "")[:300],
            })
    for ev in default_evidence or []:
        rows.append({
            "category": "背景",
            "source": ev.get("source", "—"),
            "snippet": (ev.get("snippet") or "")[:300],
        })
    if not rows:
        lines.append("（无附加证据片段）")
        return markdown.rstrip() + "\n\n" + "\n".join(lines)
    lines.append("| 类别 | 来源 | 原文片段 |")
    lines.append("| --- | --- | --- |")
    for r in rows:
        lines.append(f"| {r['category']} | {r['source']} | {r['snippet']} |")
    return markdown.rstrip() + "\n\n" + "\n".join(lines)


def _placeholder_for(section: str, *, risk_level: str, probability: float) -> str:
    if "风险等级" in section:
        return f"根据综合分析，预测风险等级 **{risk_level}**，问询概率 **{probability:.2f}**。"
    if "主要风险因素" in section:
        return "（未能抽取主要风险因素，请检查上游 Agent 输出。）"
    if "监管关注点" in section:
        return "（未生成监管关注点分类。）"
    if "原文证据" in section:
        return "（暂无原文证据片段。）"
    if "复核建议" in section:
        return "建议持续关注公司公告与披露，并结合行业政策进行复核。"
    return ""
