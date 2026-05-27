"""
Knowledge graph for risk propagation analysis (§4.2).
NetworkX-based, in-memory implementation that can be swapped for Neo4j later.
"""
from .knowledge_graph import (
    KnowledgeGraph,
    RelationType,
    build_graph_from_companies,
    get_graph,
)

__all__ = [
    "KnowledgeGraph",
    "RelationType",
    "build_graph_from_companies",
    "get_graph",
]
