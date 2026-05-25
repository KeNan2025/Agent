"""Knowledge graph query endpoints."""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Query

from app.graph import get_graph

router = APIRouter(prefix="/api/v1/graph", tags=["graph"])


@router.get("/{company_code}")
async def get_company_graph(
    company_code: str,
    k: int = Query(1, ge=1, le=3, description="跳数"),
    max_nodes: int = Query(30, ge=5, le=100),
) -> dict[str, Any]:
    kg = get_graph()
    if company_code not in kg.g:
        raise HTTPException(status_code=404, detail=f"company not found in graph: {company_code}")
    metrics = kg.metrics_for(company_code)
    egonet = kg.egonet_json(company_code, k=k, max_nodes=max_nodes)
    return {
        "company_code": company_code,
        "metrics": metrics.to_feature_dict(),
        "egonet": egonet,
    }


@router.get("/{src}/path/{dst}")
async def relation_path(src: str, dst: str, max_hops: int = 3) -> dict[str, Any]:
    from app.skills.graph import relation_search
    return relation_search(source=src, target=dst, max_hops=max_hops)
