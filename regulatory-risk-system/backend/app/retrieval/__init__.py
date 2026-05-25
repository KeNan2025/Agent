"""
Vector retrieval + hybrid search.

Implements the retrieval foundation behind:
- Announcement chunk retrieval (RAG)
- Similar case search (§任务四 case Top-5)
Designed to behave like the production Milvus + BGE-M3 setup, but uses
pure-Python TF-IDF + char-hash dense embeddings so it ships zero heavy deps.
"""
from .vector_store import (
    Document,
    HybridRetriever,
    InMemoryVectorStore,
    get_case_index,
    get_announcement_index,
)

__all__ = [
    "Document",
    "HybridRetriever",
    "InMemoryVectorStore",
    "get_case_index",
    "get_announcement_index",
]
