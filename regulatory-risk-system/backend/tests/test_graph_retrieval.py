"""Tests for the knowledge graph + retrieval."""
import pytest

from app.graph import build_graph_from_companies, RelationType
from app.mock_data.generator import generate_companies
from app.retrieval import get_case_index, get_announcement_index, Document, HybridRetriever


def test_kg_metrics_are_reasonable():
    companies = generate_companies(20)
    kg = build_graph_from_companies(companies, inquired_codes={companies[0].code})
    target = companies[5].code
    m = kg.metrics_for(target)
    assert m.pagerank >= 0
    assert m.degree_centrality >= 0
    assert 0 <= m.same_controller_inquired_ratio <= 1


def test_kg_egonet_export():
    companies = generate_companies(10)
    kg = build_graph_from_companies(companies)
    out = kg.egonet_json(companies[0].code, k=2, max_nodes=15)
    assert "nodes" in out and "links" in out
    assert any(n["is_target"] for n in out["nodes"])


def test_case_index_search():
    idx = get_case_index()
    hits = idx.search("收入确认 关联交易", top_k=3)
    assert len(hits) > 0
    doc, score, brk = hits[0]
    assert score > 0
    assert "dense" in brk and "sparse" in brk


def test_hybrid_retriever_filtering():
    r = HybridRetriever()
    r.add_many([
        Document(doc_id="a", text="商誉减值", metadata={"categories": ["财务异常"]}),
        Document(doc_id="b", text="高管异动", metadata={"categories": ["公司治理"]}),
    ])
    hits = r.search("商誉", top_k=5, category_filter=["财务异常"])
    assert len(hits) == 1
    assert hits[0][0].doc_id == "a"
