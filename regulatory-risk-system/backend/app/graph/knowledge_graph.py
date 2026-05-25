"""
Knowledge graph implementation using NetworkX.

Implements §4.2 (knowledge-graph-enhanced risk propagation):
- Nodes: companies, controllers, audit firms, supply-chain partners
- Edges: related-transaction, same-controller, supplier/customer, same-auditor
- Metrics: degree centrality, PageRank, related-inquiry counts (1°/2°)

Production note: swap `KnowledgeGraph` for Neo4j-backed implementation by
implementing the same `metrics_for()` and `related_inquired_count()` interface.
"""
from __future__ import annotations

import hashlib
import random
from dataclasses import dataclass
from enum import Enum
from typing import Any

import networkx as nx

from app.models.schemas import CompanyInfo


class RelationType(str, Enum):
    SAME_CONTROLLER = "same_controller"
    RELATED_TX = "related_transaction"
    SUPPLIER = "supplier"
    CUSTOMER = "customer"
    SAME_AUDITOR = "same_auditor"
    SUBSIDIARY = "subsidiary"
    SHARED_DIRECTOR = "shared_director"


@dataclass
class GraphMetrics:
    degree_centrality: float = 0.0
    betweenness_centrality: float = 0.0
    pagerank: float = 0.0
    related_inquired_count_1deg: int = 0
    related_inquired_count_2deg: int = 0
    same_controller_inquired_ratio: float = 0.0
    supplier_avg_risk: float = 0.0
    customer_avg_risk: float = 0.0
    same_auditor_inquired_ratio: float = 0.0

    def to_feature_dict(self) -> dict[str, float]:
        return {
            "degree_centrality": self.degree_centrality,
            "betweenness_centrality": self.betweenness_centrality,
            "pagerank": self.pagerank,
            "related_inquired_count_1deg": float(self.related_inquired_count_1deg),
            "related_inquired_count_2deg": float(self.related_inquired_count_2deg),
            "same_controller_inquired_ratio": self.same_controller_inquired_ratio,
            "supplier_avg_risk": self.supplier_avg_risk,
            "customer_avg_risk": self.customer_avg_risk,
            "same_auditor_inquired_ratio": self.same_auditor_inquired_ratio,
        }


class KnowledgeGraph:
    """In-memory knowledge graph backed by NetworkX."""

    def __init__(self) -> None:
        self.g: nx.DiGraph = nx.DiGraph()
        self._inquired_companies: set[str] = set()
        self._risk_scores: dict[str, float] = {}
        # Cached centrality scores so look-ups are O(1)
        self._pagerank: dict[str, float] | None = None
        self._betweenness: dict[str, float] | None = None
        self._degree_centrality: dict[str, float] | None = None

    # ─── Graph construction ───
    def add_company(self, code: str, **attrs: Any) -> None:
        self.g.add_node(code, type="company", **attrs)

    def add_controller(self, controller_id: str, name: str | None = None) -> None:
        self.g.add_node(controller_id, type="controller", name=name or controller_id)

    def add_auditor(self, firm_id: str, name: str | None = None) -> None:
        self.g.add_node(firm_id, type="auditor", name=name or firm_id)

    def add_edge(
        self, src: str, dst: str, rel: RelationType, weight: float = 1.0,
        **attrs: Any,
    ) -> None:
        self.g.add_edge(src, dst, relation=rel.value, weight=weight, **attrs)

    def mark_inquired(self, code: str, risk_score: float = 1.0) -> None:
        self._inquired_companies.add(code)
        self._risk_scores[code] = risk_score

    def set_risk_score(self, code: str, score: float) -> None:
        self._risk_scores[code] = score

    # ─── Centrality (cached) ───
    def _ensure_centrality(self) -> None:
        if self._pagerank is None:
            try:
                self._pagerank = nx.pagerank(self.g, alpha=0.85)
            except Exception:
                self._pagerank = {n: 0.0 for n in self.g.nodes}
        if self._degree_centrality is None:
            self._degree_centrality = nx.degree_centrality(self.g)
        if self._betweenness is None and self.g.number_of_nodes() < 500:
            try:
                self._betweenness = nx.betweenness_centrality(self.g, k=min(50, self.g.number_of_nodes()))
            except Exception:
                self._betweenness = {n: 0.0 for n in self.g.nodes}
        elif self._betweenness is None:
            self._betweenness = {n: 0.0 for n in self.g.nodes}

    def invalidate_cache(self) -> None:
        self._pagerank = None
        self._betweenness = None
        self._degree_centrality = None

    # ─── Neighbour queries ───
    def neighbours(self, code: str, relation: RelationType | None = None) -> list[str]:
        if code not in self.g:
            return []
        out = []
        # Undirected scan
        for nb in set(list(self.g.successors(code)) + list(self.g.predecessors(code))):
            if relation is None:
                out.append(nb)
            else:
                edges = list(self.g.get_edge_data(code, nb, {}).items()) + list(self.g.get_edge_data(nb, code, {}).items())
                if any(e.get("relation") == relation.value for _, e in edges if isinstance(e, dict)):
                    out.append(nb)
        return out

    def k_hop_neighbours(self, code: str, k: int = 2) -> set[str]:
        if code not in self.g:
            return set()
        seen = {code}
        frontier = {code}
        for _ in range(k):
            new = set()
            for n in frontier:
                new |= set(self.g.successors(n))
                new |= set(self.g.predecessors(n))
            new -= seen
            seen |= new
            frontier = new
        seen.discard(code)
        return seen

    # ─── Aggregated metrics for a single company ───
    def metrics_for(self, code: str) -> GraphMetrics:
        self._ensure_centrality()
        m = GraphMetrics()
        if code not in self.g:
            return m

        m.degree_centrality = float(self._degree_centrality.get(code, 0.0))
        m.pagerank = float(self._pagerank.get(code, 0.0))
        m.betweenness_centrality = float(self._betweenness.get(code, 0.0))

        one_hop = set(self.neighbours(code))
        two_hop = self.k_hop_neighbours(code, k=2)

        # Inquired counts
        one_hop_companies = {n for n in one_hop if self.g.nodes[n].get("type") == "company"}
        two_hop_companies = {n for n in two_hop if self.g.nodes[n].get("type") == "company"}
        m.related_inquired_count_1deg = sum(1 for n in one_hop_companies if n in self._inquired_companies)
        m.related_inquired_count_2deg = sum(1 for n in two_hop_companies if n in self._inquired_companies)

        # Same controller
        controllers = [n for n in one_hop if self.g.nodes[n].get("type") == "controller"]
        if controllers:
            siblings: set[str] = set()
            for c in controllers:
                for nb in self.g.successors(c):
                    if nb != code and self.g.nodes[nb].get("type") == "company":
                        siblings.add(nb)
                for nb in self.g.predecessors(c):
                    if nb != code and self.g.nodes[nb].get("type") == "company":
                        siblings.add(nb)
            if siblings:
                m.same_controller_inquired_ratio = sum(
                    1 for s in siblings if s in self._inquired_companies
                ) / len(siblings)

        # Supplier / customer risk
        sup_risks, cust_risks = [], []
        for u, v, d in self.g.edges(data=True):
            rel = d.get("relation", "")
            if rel == RelationType.SUPPLIER.value:
                if v == code and u in self._risk_scores:
                    sup_risks.append(self._risk_scores[u])
                if u == code and v in self._risk_scores:
                    cust_risks.append(self._risk_scores[v])
            elif rel == RelationType.CUSTOMER.value:
                if u == code and v in self._risk_scores:
                    cust_risks.append(self._risk_scores[v])
                if v == code and u in self._risk_scores:
                    sup_risks.append(self._risk_scores[u])
        m.supplier_avg_risk = float(sum(sup_risks) / len(sup_risks)) if sup_risks else 0.0
        m.customer_avg_risk = float(sum(cust_risks) / len(cust_risks)) if cust_risks else 0.0

        # Same auditor inquired ratio
        auditors = [n for n in one_hop if self.g.nodes[n].get("type") == "auditor"]
        if auditors:
            audited: set[str] = set()
            for a in auditors:
                for nb in self.g.successors(a):
                    if nb != code and self.g.nodes[nb].get("type") == "company":
                        audited.add(nb)
                for nb in self.g.predecessors(a):
                    if nb != code and self.g.nodes[nb].get("type") == "company":
                        audited.add(nb)
            if audited:
                m.same_auditor_inquired_ratio = sum(
                    1 for c in audited if c in self._inquired_companies
                ) / len(audited)
        return m

    # ─── Visualisation export ───
    def egonet_json(self, code: str, k: int = 1, max_nodes: int = 30) -> dict[str, Any]:
        """Export a JSON suitable for ECharts force/relation graph rendering."""
        if code not in self.g:
            return {"nodes": [], "links": []}
        nodes_set = {code} | self.k_hop_neighbours(code, k=k)
        if len(nodes_set) > max_nodes:
            # Trim by degree
            scored = sorted(
                nodes_set,
                key=lambda n: self.g.degree(n) if n in self.g else 0,
                reverse=True,
            )
            nodes_set = set(scored[:max_nodes])
            nodes_set.add(code)
        nodes_out = []
        for n in nodes_set:
            ntype = self.g.nodes[n].get("type", "company")
            inquired = n in self._inquired_companies
            nodes_out.append({
                "id": n,
                "name": self.g.nodes[n].get("name", n),
                "category": ntype,
                "value": 1 if inquired else 0,
                "is_inquired": inquired,
                "is_target": n == code,
                "risk_score": self._risk_scores.get(n, 0.0),
            })
        links_out = []
        for u, v, d in self.g.edges(data=True):
            if u in nodes_set and v in nodes_set:
                links_out.append({
                    "source": u, "target": v,
                    "relation": d.get("relation", ""),
                    "weight": d.get("weight", 1.0),
                })
        return {"nodes": nodes_out, "links": links_out}


# ─────────────────────────── Demo graph builder ───────────────────────────


def build_graph_from_companies(
    companies: list[CompanyInfo],
    inquired_codes: set[str] | None = None,
    risk_scores: dict[str, float] | None = None,
    seed: int = 42,
) -> KnowledgeGraph:
    """
    Synthesize a plausible knowledge graph for the demo.
    In production: replace with real data ingestion (CSRC filings, industrial
    databases, audit-firm registries, supply-chain reports).
    """
    rng = random.Random(seed)
    kg = KnowledgeGraph()
    inquired_codes = inquired_codes or set()
    risk_scores = risk_scores or {}

    # Companies
    for c in companies:
        kg.add_company(c.code, name=c.name, industry=c.industry, market_cap=c.market_cap)
        if c.code in inquired_codes:
            kg.mark_inquired(c.code, risk_score=risk_scores.get(c.code, 0.85))
        elif c.code in risk_scores:
            kg.set_risk_score(c.code, risk_scores[c.code])

    # Controllers — every 8 companies share one controller (a demo proxy)
    by_industry: dict[str, list[CompanyInfo]] = {}
    for c in companies:
        by_industry.setdefault(c.industry, []).append(c)

    for ind, group in by_industry.items():
        for i in range(0, len(group), 3):
            cluster = group[i : i + 3]
            if len(cluster) < 2:
                continue
            ctrl_id = f"CTRL_{ind}_{i // 3}"
            kg.add_controller(ctrl_id, name=f"{ind}集团{i // 3 + 1}")
            for c in cluster:
                kg.add_edge(ctrl_id, c.code, RelationType.SAME_CONTROLLER)
                kg.add_edge(c.code, ctrl_id, RelationType.SAME_CONTROLLER)

    # Auditors — pick from a fixed pool, ~3 firms per industry
    audit_firms = ["普华永道", "德勤", "毕马威", "安永", "立信", "天健", "致同", "瑞华"]
    for af in audit_firms:
        kg.add_auditor(f"AUD_{af}", name=af)
    for c in companies:
        h = int(hashlib.md5(c.code.encode()).hexdigest()[:4], 16)
        firm = audit_firms[h % len(audit_firms)]
        kg.add_edge(f"AUD_{firm}", c.code, RelationType.SAME_AUDITOR)
        kg.add_edge(c.code, f"AUD_{firm}", RelationType.SAME_AUDITOR)

    # Supply chain — random links with weight = trade volume proxy
    codes = [c.code for c in companies]
    for c in companies:
        n_links = rng.randint(0, 3)
        for _ in range(n_links):
            partner = rng.choice(codes)
            if partner != c.code:
                rel = rng.choice([RelationType.SUPPLIER, RelationType.CUSTOMER])
                kg.add_edge(c.code, partner, rel, weight=rng.uniform(0.1, 1.0))

    # Related transactions — sample within same controller clusters
    for ind, group in by_industry.items():
        for i in range(0, len(group), 3):
            cluster = group[i : i + 3]
            for a in cluster:
                for b in cluster:
                    if a.code != b.code and rng.random() < 0.5:
                        kg.add_edge(a.code, b.code, RelationType.RELATED_TX, weight=rng.uniform(0.05, 0.8))

    return kg


_KG: KnowledgeGraph | None = None


def get_graph(rebuild: bool = False) -> KnowledgeGraph:
    """Lazy global graph initialization for the running server."""
    global _KG
    if _KG is None or rebuild:
        from app.mock_data.generator import get_all_companies, get_all_predictions
        companies = get_all_companies()
        preds = get_all_predictions()
        inquired = {p["company"].code for p in preds if p["probability"] >= 0.6}
        risk_scores = {p["company"].code: p["probability"] for p in preds}
        _KG = build_graph_from_companies(companies, inquired, risk_scores)
    return _KG
