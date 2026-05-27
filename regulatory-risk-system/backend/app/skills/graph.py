"""Knowledge-graph skills."""
from __future__ import annotations

from typing import Any

from app.core.skill import skill
from app.graph import get_graph


@skill(
    name="graph_query",
    description="基于知识图谱查询目标公司的关联关系与风险传导特征",
    input_schema={
        "type": "object",
        "properties": {
            "company_code": {"type": "string"},
        },
        "required": ["company_code"],
    },
    tags=["graph"],
)
def graph_query(company_code: str) -> dict[str, Any]:
    kg = get_graph()
    metrics = kg.metrics_for(company_code)
    egonet = kg.egonet_json(company_code, k=1, max_nodes=25)
    return {
        "company_code": company_code,
        "metrics": metrics.to_feature_dict(),
        "egonet": egonet,
        "n_neighbours": len([n for n in egonet["nodes"] if not n["is_target"]]),
        "inquired_neighbours": metrics.related_inquired_count_1deg,
    }


@skill(
    name="relation_search",
    description="搜索两家公司之间的关联路径（最多 k 跳）",
    input_schema={
        "type": "object",
        "properties": {
            "source": {"type": "string"},
            "target": {"type": "string"},
            "max_hops": {"type": "integer", "default": 3},
        },
        "required": ["source", "target"],
    },
    tags=["graph"],
)
def relation_search(source: str, target: str, max_hops: int = 3) -> dict[str, Any]:
    import networkx as nx
    kg = get_graph()
    g = kg.g
    if source not in g or target not in g:
        return {"path": None, "length": -1, "reason": "node not found"}
    undirected = g.to_undirected()
    try:
        path = nx.shortest_path(undirected, source, target)
    except nx.NetworkXNoPath:
        return {"path": None, "length": -1, "reason": "no path"}
    if len(path) - 1 > max_hops:
        return {"path": path, "length": len(path) - 1, "within_limit": False}
    return {"path": path, "length": len(path) - 1, "within_limit": True}
