"""
Document parsing module — PDF/HTML/DOCX to structured chunks.

Implements §3.1.2 step 1 (structured parsing) + step 2 (semantic chunking).
Heavy parsers (PyMuPDF, Camelot) are optional — when missing we fall back to
plain-text reading so the pipeline never breaks. In production install:

    pip install pymupdf camelot-py[base] beautifulsoup4 python-docx
"""
from .parser import (
    Document, DocumentChunk, parse_file, parse_pdf, parse_html, parse_docx,
    chunk_text, chunk_by_section,
)

__all__ = [
    "Document", "DocumentChunk", "parse_file",
    "parse_pdf", "parse_html", "parse_docx",
    "chunk_text", "chunk_by_section",
]
