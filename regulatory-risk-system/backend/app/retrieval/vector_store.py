"""
In-memory hybrid retriever:
- Dense path: deterministic character-hashing embedding (mimics Qwen3-Embedding)
- Sparse path: TF-IDF (mimics BGE-M3 sparse signal)
- Fusion: weighted score combining both

This module is intentionally dependency-light so the demo always works.
Replace `_dense_embed` with a real sentence-transformer / Qwen3-Embedding call
and swap the in-memory storage for Milvus when productionising.
"""
from __future__ import annotations

import hashlib
import math
import re
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from typing import Any

import numpy as np


# ─────────────────────────── Document model ───────────────────────────


@dataclass
class Document:
    doc_id: str
    text: str
    metadata: dict[str, Any] = field(default_factory=dict)


# ─────────────────────────── Embeddings ───────────────────────────


_EMB_DIM = 256


def _tokenize(text: str) -> list[str]:
    # Mixed Chinese/English: take Chinese chars individually and English words
    text = text.lower()
    tokens: list[str] = []
    for m in re.finditer(r"[一-鿿]|[a-z0-9]+", text):
        tokens.append(m.group())
    return tokens


def _dense_embed(text: str, dim: int = _EMB_DIM) -> np.ndarray:
    """
    Deterministic character-hashing embedding.
    Each token contributes a unit vector at hash(token) % dim.
    Normalised to unit length. Not as expressive as a real LM embedding,
    but stable, deterministic, and zero-dependency — perfect for a demo.
    """
    vec = np.zeros(dim, dtype=np.float32)
    for tok in _tokenize(text):
        h = int(hashlib.md5(tok.encode("utf-8")).hexdigest()[:8], 16)
        idx = h % dim
        sign = 1.0 if (h // dim) % 2 == 0 else -1.0
        vec[idx] += sign
    norm = float(np.linalg.norm(vec))
    if norm > 0:
        vec /= norm
    return vec


# ─────────────────────────── TF-IDF ───────────────────────────


class TfIdfIndex:
    def __init__(self) -> None:
        self.documents: list[Document] = []
        self.tf: list[dict[str, int]] = []
        self.df: dict[str, int] = defaultdict(int)
        self.idf: dict[str, float] = {}
        self.n_docs: int = 0

    def add(self, doc: Document) -> None:
        tokens = _tokenize(doc.text)
        counts = Counter(tokens)
        self.documents.append(doc)
        self.tf.append(dict(counts))
        for tok in counts:
            self.df[tok] += 1
        self.n_docs += 1

    def finalize(self) -> None:
        self.idf = {
            tok: math.log((self.n_docs + 1) / (df + 1)) + 1.0
            for tok, df in self.df.items()
        }

    def score(self, query: str) -> list[float]:
        if not self.idf:
            self.finalize()
        q_tokens = _tokenize(query)
        q_counts = Counter(q_tokens)
        q_vec = {t: c * self.idf.get(t, 0.0) for t, c in q_counts.items()}
        q_norm = math.sqrt(sum(v * v for v in q_vec.values())) or 1.0

        scores: list[float] = []
        for doc_tf in self.tf:
            dot = 0.0
            d_norm_sq = 0.0
            for tok, tf in doc_tf.items():
                idf = self.idf.get(tok, 0.0)
                w = tf * idf
                d_norm_sq += w * w
                if tok in q_vec:
                    dot += w * q_vec[tok]
            d_norm = math.sqrt(d_norm_sq) or 1.0
            scores.append(dot / (q_norm * d_norm))
        return scores


# ─────────────────────────── Vector store ───────────────────────────


class InMemoryVectorStore:
    """Holds dense embeddings + TF-IDF index for hybrid retrieval."""

    def __init__(self) -> None:
        self.docs: list[Document] = []
        self.embeddings: list[np.ndarray] = []
        self.tfidf = TfIdfIndex()

    def add(self, doc: Document) -> None:
        self.docs.append(doc)
        self.embeddings.append(_dense_embed(doc.text))
        self.tfidf.add(doc)

    def add_many(self, docs: list[Document]) -> None:
        for d in docs:
            self.add(d)
        self.tfidf.finalize()

    def _dense_scores(self, query: str) -> list[float]:
        q = _dense_embed(query)
        if not self.embeddings:
            return []
        mat = np.stack(self.embeddings)
        sims = mat @ q
        return [float(s) for s in sims]

    def search(
        self, query: str, top_k: int = 5,
        alpha: float = 0.5,  # weight on dense; 1-alpha on sparse
        category_filter: list[str] | None = None,
    ) -> list[tuple[Document, float, dict[str, float]]]:
        if not self.docs:
            return []
        dense = self._dense_scores(query)
        sparse = self.tfidf.score(query)
        if not sparse:
            sparse = [0.0] * len(self.docs)
        # Normalise sparse to roughly comparable scale
        max_sp = max(sparse) or 1.0
        sparse_n = [s / max_sp for s in sparse]
        # Min-max normalise dense to [0,1]
        if dense:
            mx = max(dense)
            mn = min(dense)
            rng = (mx - mn) or 1.0
            dense_n = [(d - mn) / rng for d in dense]
        else:
            dense_n = [0.0] * len(self.docs)
        fused = [alpha * dense_n[i] + (1 - alpha) * sparse_n[i] for i in range(len(self.docs))]
        # Filter
        candidates: list[tuple[int, float]] = []
        for i, score in enumerate(fused):
            if category_filter:
                cats = self.docs[i].metadata.get("categories", [])
                if not any(c in cats for c in category_filter):
                    continue
            candidates.append((i, score))
        candidates.sort(key=lambda x: -x[1])
        out: list[tuple[Document, float, dict[str, float]]] = []
        for i, score in candidates[:top_k]:
            out.append((
                self.docs[i],
                float(score),
                {"dense": float(dense_n[i]), "sparse": float(sparse_n[i])},
            ))
        return out


class HybridRetriever(InMemoryVectorStore):
    """Convenience alias matching the §3.1.2 hybrid_search Skill name."""


# ─────────────────────────── Global indices ───────────────────────────


_CASES: HybridRetriever | None = None
_ANNS: HybridRetriever | None = None


def get_case_index() -> HybridRetriever:
    """Singleton index over a synthetic case library."""
    global _CASES
    if _CASES is None:
        _CASES = _build_case_library()
    return _CASES


def get_announcement_index() -> HybridRetriever:
    """Singleton index over per-company announcement chunks."""
    global _ANNS
    if _ANNS is None:
        _ANNS = _build_announcement_library()
    return _ANNS


def _build_case_library() -> HybridRetriever:
    """Synthetic historical inquiry case library — used for case-match Skill."""
    cases = [
        Document("CASE_600123_2023-05", text="盛通股份 收入确认 关联交易 商誉减值 业绩预告偏差",
                 metadata={"company": "盛通股份(600123)", "date": "2023-05",
                           "type": "年报问询函", "categories": ["财务异常", "关联交易"],
                           "focus": "收入确认方法、关联交易公允性"}),
        Document("CASE_000456_2023-08", text="远兴能源 商誉减值 现金流异常 大额资产减值",
                 metadata={"company": "远兴能源(000456)", "date": "2023-08",
                           "type": "关注函", "categories": ["财务异常"],
                           "focus": "资产减值充分性、现金流真实性"}),
        Document("CASE_300789_2023-11", text="康弘药业 高管异动 内控缺陷 财务总监辞职",
                 metadata={"company": "康弘药业(300789)", "date": "2023-11",
                           "type": "年报问询函", "categories": ["公司治理"],
                           "focus": "高管变动原因、内控有效性"}),
        Document("CASE_002345_2024-03", text="潮宏基 关联交易扩大 大股东占用资金 违规担保",
                 metadata={"company": "潮宏基(002345)", "date": "2024-03",
                           "type": "重组问询函", "categories": ["关联交易", "资金问题"],
                           "focus": "关联资金占用、担保合规性"}),
        Document("CASE_600890_2024-06", text="中房股份 持续经营风险 营运资金为负 审计保留意见",
                 metadata={"company": "中房股份(600890)", "date": "2024-06",
                           "type": "年报问询函", "categories": ["经营合理性", "会计争议"],
                           "focus": "持续经营能力、审计意见原因"}),
        Document("CASE_000712_2024-08", text="锦瑞新材 业绩预告偏差 信息披露不充分 收入确认",
                 metadata={"company": "锦瑞新材(000712)", "date": "2024-08",
                           "type": "半年报问询函", "categories": ["信息披露", "财务异常"],
                           "focus": "业绩预告与实际偏差、披露完整性"}),
        Document("CASE_300155_2024-10", text="安居宝 商誉减值不充分 收购标的业绩承诺未达",
                 metadata={"company": "安居宝(300155)", "date": "2024-10",
                           "type": "并购重组问询函", "categories": ["并购重组", "财务异常"],
                           "focus": "标的业绩承诺、商誉减值测试"}),
        Document("CASE_002678_2024-11", text="珠江钢琴 主营业务突变 跨行业并购 财务核算方法",
                 metadata={"company": "珠江钢琴(002678)", "date": "2024-11",
                           "type": "年报问询函", "categories": ["经营合理性", "会计争议"],
                           "focus": "主营业务变更、跨行业并购合理性"}),
        Document("CASE_600501_2024-12", text="航天晨光 大额预付款 供应商集中 资金往来",
                 metadata={"company": "航天晨光(600501)", "date": "2024-12",
                           "type": "关注函", "categories": ["资金问题", "关联交易"],
                           "focus": "预付款合理性、供应商真实性"}),
        Document("CASE_002999_2024-12", text="嘉禾科技 收入确认时点变更 完工百分比法争议",
                 metadata={"company": "嘉禾科技(002999)", "date": "2024-12",
                           "type": "年报问询函", "categories": ["会计争议", "财务异常"],
                           "focus": "收入确认方法、会计政策变更"}),
    ]
    idx = HybridRetriever()
    idx.add_many(cases)
    return idx


def _build_announcement_library() -> HybridRetriever:
    """
    Synthetic announcement chunks. In production this would index actual annual
    reports parsed by PyMuPDF + section-level splitter.
    """
    chunks = []
    samples = [
        ("ANN_GENERIC_REV", "本期营业收入较上年同期增长 45.2%，主要系公司加大市场开拓力度所致。",
         {"section": "经营情况讨论与分析", "categories": ["财务异常"]}),
        ("ANN_GENERIC_OCF", "经营活动产生的现金流量净额为 -1.2 亿元，较上年同期减少 22.3%。",
         {"section": "经营情况讨论与分析", "categories": ["财务异常"]}),
        ("ANN_GENERIC_GW", "截至报告期末，公司商誉账面价值为 8.5 亿元，占净资产比例为 32.1%。",
         {"section": "财务报表附注", "categories": ["财务异常"]}),
        ("ANN_GENERIC_RT", "报告期内，公司与控股股东及其关联方发生日常关联交易合计 5.6 亿元。",
         {"section": "重要事项 关联交易", "categories": ["关联交易"]}),
        ("ANN_GENERIC_PLEDGE", "公司控股股东累计质押比例已达 78%，需关注平仓风险。",
         {"section": "股东变动", "categories": ["公司治理"]}),
        ("ANN_GENERIC_GUARANTEE", "公司对外担保余额合计 12 亿元，占最近一期经审计净资产 65%。",
         {"section": "重要事项", "categories": ["资金问题"]}),
        ("ANN_GENERIC_EXEC", "公司财务总监因个人原因辞职，由原审计负责人代理。",
         {"section": "董监高变动", "categories": ["公司治理"]}),
        ("ANN_GENERIC_FORECAST", "实际净利润较业绩预告下限低 38%，主要系减值损失大幅增加。",
         {"section": "业绩预告修正", "categories": ["信息披露", "财务异常"]}),
    ]
    for doc_id, text, meta in samples:
        chunks.append(Document(doc_id=doc_id, text=text, metadata=meta))
    idx = HybridRetriever()
    idx.add_many(chunks)
    return idx
