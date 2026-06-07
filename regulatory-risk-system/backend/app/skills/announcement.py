"""Announcement search & extraction skills."""
from __future__ import annotations

from typing import Any

from app.core.llm import complete_sync, get_llm_client
from app.core.skill import skill
from app.retrieval import get_announcement_index


@skill(
    name="announcement_search",
    description="检索目标公司的公告语料，返回与查询最相关的若干段落",
    input_schema={
        "type": "object",
        "properties": {
            "company_code": {"type": "string", "description": "股票代码"},
            "query": {"type": "string", "description": "查询关键词或自然语言问题"},
            "top_k": {"type": "integer", "default": 5},
            "categories": {
                "type": "array", "items": {"type": "string"},
                "description": "可选：限定风险类别",
            },
        },
        "required": ["company_code", "query"],
    },
    tags=["retrieval", "rag"],
)
def announcement_search(
    company_code: str, query: str, top_k: int = 5,
    categories: list[str] | None = None,
) -> dict[str, Any]:
    idx = get_announcement_index()
    full_query = f"{company_code} {query}"
    hits = idx.search(full_query, top_k=top_k, category_filter=categories)
    return {
        "company_code": company_code,
        "query": query,
        "hits": [
            {
                "doc_id": d.doc_id,
                "text": d.text,
                "score": score,
                "metadata": d.metadata,
                "score_breakdown": brk,
            }
            for d, score, brk in hits
        ],
    }


@skill(
    name="text_extract",
    description="对文本片段进行结构化风险要素抽取（LLM tool calling）",
    input_schema={
        "type": "object",
        "properties": {
            "text": {"type": "string", "description": "待抽取文本"},
            "hypothesis": {"type": "string", "description": "Planner 给出的风险假设"},
        },
        "required": ["text"],
    },
    tags=["llm", "extraction"],
)
def text_extract(text: str, hypothesis: str = "") -> dict[str, Any]:
    client = get_llm_client()
    prompt = (
        f"请基于以下文本抽取风险要素（按 JSON Schema 输出）。\n"
        f"风险假设：{hypothesis}\n"
        f"文本：\n{text}\n"
    )
    resp = complete_sync(client, prompt + "\n请用'extract'结构化输出：")
    try:
        parsed = resp.parse_json()
    except Exception:
        parsed = {"risk_factors": []}
    return {
        "raw_text": resp.text,
        "tokens_used": resp.tokens_used,
        "extracted": parsed,
        "hypothesis": hypothesis,
    }


@skill(
    name="table_parse",
    description="将公告中的表格（已转为结构化数据）做语义解读",
    input_schema={
        "type": "object",
        "properties": {
            "table": {"type": "array", "description": "二维数组形式的表格"},
            "description": {"type": "string"},
        },
        "required": ["table"],
    },
    tags=["extraction"],
)
def table_parse(table: list[list[Any]], description: str = "") -> dict[str, Any]:
    n_rows = len(table)
    n_cols = max((len(r) for r in table), default=0)
    flat = [c for row in table for c in row]
    numeric = sum(1 for c in flat if isinstance(c, (int, float)))
    return {
        "rows": n_rows,
        "cols": n_cols,
        "numeric_cell_ratio": (numeric / max(1, len(flat))),
        "summary": description or f"表格 {n_rows}×{n_cols}",
    }
