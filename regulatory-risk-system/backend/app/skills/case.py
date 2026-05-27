"""Case-matching skill (similar historical inquiries)."""
from __future__ import annotations

from typing import Any

from app.core.skill import skill
from app.retrieval import get_case_index


@skill(
    name="case_match",
    description="基于风险画像，检索最相似的历史监管问询案例（Top-K）",
    input_schema={
        "type": "object",
        "properties": {
            "risk_summary": {"type": "string", "description": "目标公司的风险描述/关键词"},
            "categories": {"type": "array", "items": {"type": "string"}},
            "top_k": {"type": "integer", "default": 5},
        },
        "required": ["risk_summary"],
    },
    tags=["retrieval"],
)
def case_match(risk_summary: str, categories: list[str] | None = None, top_k: int = 5) -> dict[str, Any]:
    idx = get_case_index()
    hits = idx.search(risk_summary, top_k=top_k, category_filter=categories)
    cases = []
    for d, score, brk in hits:
        meta = d.metadata
        cases.append({
            "company": meta.get("company", d.doc_id),
            "date": meta.get("date", ""),
            "type": meta.get("type", ""),
            "categories": meta.get("categories", []),
            "focus": meta.get("focus", ""),
            "similarity": round(score, 3),
            "score_breakdown": brk,
        })
    return {"query": risk_summary, "cases": cases, "n": len(cases)}


@skill(
    name="evidence_retrieve",
    description="根据风险类型从公告库中检索对应证据片段",
    input_schema={
        "type": "object",
        "properties": {
            "company_code": {"type": "string"},
            "category": {"type": "string"},
            "top_k": {"type": "integer", "default": 3},
        },
        "required": ["company_code", "category"],
    },
    tags=["retrieval"],
)
def evidence_retrieve(company_code: str, category: str, top_k: int = 3) -> dict[str, Any]:
    from app.retrieval import get_announcement_index
    idx = get_announcement_index()
    hits = idx.search(f"{company_code} {category}", top_k=top_k, category_filter=[category])
    return {
        "company_code": company_code,
        "category": category,
        "evidence": [
            {"doc_id": d.doc_id, "text": d.text, "score": score, "metadata": d.metadata}
            for d, score, _brk in hits
        ],
    }
