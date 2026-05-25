"""Tests for the document parser fallback paths."""
from app.docparse import Document, chunk_text, chunk_by_section


def test_chunk_text_basic():
    txt = "公司本期营业收入大幅增长。然而经营性现金流为负。同时商誉减值风险加剧。"
    out = list(chunk_text(txt, doc_id="X", page=1, section="经营情况讨论与分析"))
    assert len(out) >= 1
    assert all(c.section == "经营情况讨论与分析" for c in out)
    assert all(c.page == 1 for c in out)


def test_chunk_text_respects_max_chars():
    txt = "段落" * 600
    chunks = list(chunk_text(txt, doc_id="X", max_chars=200))
    assert all(len(c.text) <= 250 for c in chunks)
    assert len(chunks) >= 2


def test_chunk_by_section_splits_known_headings():
    body = (
        "重要事项 公司发生了重大事件。" * 3
        + "财务报告 总收入 5 亿元。" * 3
        + "审计报告 出具标准无保留意见。"
    )
    out = chunk_by_section(body, doc_id="A")
    sections = {c.section for c in out}
    # Should at least recognise one of the patterns
    assert sections & {"重要事项", "财务报告", "审计报告"}
