"""
Strong Pydantic contracts for the scan output.

`RiskAssessment` is the cross-subsystem anchor: API output, trace agent
output, experience-review input, and (Phase 5) memory writes all consume
this schema. Every field has a clear business meaning aligned with the
competition spec (§技术指标 监管问询概率预测 / 风险语义抽取与归因).
"""
from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel, Field, field_validator


RiskLevelT = Literal["高风险", "中风险", "低风险"]


class Evidence(BaseModel):
    """A single piece of original-text evidence backing a risk factor."""
    source_type: Literal["announcement", "financial", "case", "graph", "regulatory_filing"] = "announcement"
    source_id: str = Field(..., description="Unique id of the source artifact")
    source: Optional[str] = Field(default=None, description="Human-readable source label")
    snippet: str = Field(..., max_length=2000, description="Quoted original text, ≤ 200 chars")
    line_range: Optional[tuple[int, int]] = Field(default=None, description="[start, end] 1-indexed lines")


class RiskFactor(BaseModel):
    """One regulator-style risk factor with evidence."""
    category: str
    subcategory: str
    severity: Literal["高", "中", "低"]
    description: str
    confidence: float = Field(ge=0.0, le=1.0)
    evidence: list[Evidence] = Field(default_factory=list)

    @field_validator("evidence")
    @classmethod
    def _at_least_one(cls, v: list[Evidence]) -> list[Evidence]:
        if not v:
            raise ValueError("Each RiskFactor must carry at least one Evidence")
        return v


class SimilarCase(BaseModel):
    company_code: str
    company_name: str
    inquiry_date: str
    inquiry_type: str
    similarity: float = Field(ge=0.0, le=1.0)
    match_dimensions: str
    key_difference: str


class ShapFeature(BaseModel):
    feature_name: str
    shap_value: float
    feature_value: str
    description: str


class RiskAssessment(BaseModel):
    company_code: str
    window_days: int = Field(ge=1, le=365)
    probability: float = Field(ge=0.0, le=1.0)
    risk_level: RiskLevelT
    top_risk_factors: list[RiskFactor] = Field(default_factory=list)
    similar_cases: list[SimilarCase] = Field(default_factory=list)
    shap_features: list[ShapFeature] = Field(default_factory=list)
    report_markdown: str
    analysis_time_ms: int = 0
    llm_calls: int = 0
    total_tokens: int = 0
    confidence: float = 0.0
    experience_event_id: Optional[str] = None
    extra: dict[str, Any] = Field(default_factory=dict)


def risk_level_from_probability(p: float, *, high: float = 0.6, medium: float = 0.3) -> RiskLevelT:
    if p >= high:
        return "高风险"
    if p >= medium:
        return "中风险"
    return "低风险"
