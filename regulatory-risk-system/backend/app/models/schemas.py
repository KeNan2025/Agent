from __future__ import annotations
from pydantic import BaseModel, Field
from enum import Enum


class RiskLevel(str, Enum):
    HIGH = "高风险"
    MEDIUM = "中风险"
    LOW = "低风险"


class RiskCategory(str, Enum):
    FINANCIAL_ANOMALY = "财务异常"
    RELATED_TRANSACTION = "关联交易"
    FUND_ISSUE = "资金问题"
    BUSINESS_RATIONALITY = "经营合理性"
    DISCLOSURE = "信息披露"
    GOVERNANCE = "公司治理"
    MA = "并购重组"
    ACCOUNTING = "会计争议"


class CompanyInfo(BaseModel):
    code: str = Field(description="股票代码")
    name: str = Field(description="公司名称")
    industry: str = Field(description="所属行业")
    market_cap: float = Field(description="市值(亿元)")
    listing_date: str = Field(description="上市日期")


class FinancialFeatures(BaseModel):
    roe: float = Field(description="净资产收益率")
    roa: float = Field(description="总资产收益率")
    gross_margin: float = Field(description="毛利率")
    net_margin: float = Field(description="净利率")
    debt_ratio: float = Field(description="资产负债率")
    current_ratio: float = Field(description="流动比率")
    receivable_turnover: float = Field(description="应收账款周转率")
    inventory_turnover: float = Field(description="存货周转率")
    ocf_to_profit: float = Field(description="经营现金流/净利润")
    revenue_growth: float = Field(description="营收同比增长率")
    profit_growth: float = Field(description="净利润同比增长率")
    receivable_growth: float = Field(description="应收账款同比增长率")
    beneish_m_score: float = Field(description="Beneish M-Score")
    altman_z_score: float = Field(description="Altman Z-Score")
    pledge_ratio: float = Field(description="大股东质押比例")
    exec_turnover_count: int = Field(description="近一年董监高变动次数")


class RiskFactor(BaseModel):
    category: RiskCategory
    subcategory: str
    description: str
    evidence_quote: str
    evidence_source: str
    severity: str = Field(description="高/中/低")
    confidence: float = Field(ge=0.0, le=1.0)


class ShapFeature(BaseModel):
    feature_name: str
    feature_value: str
    shap_value: float
    description: str


class SimilarCase(BaseModel):
    company_code: str
    company_name: str
    inquiry_date: str
    inquiry_type: str
    similarity: float
    match_dimensions: str
    key_difference: str


class AgentStep(BaseModel):
    step_id: int
    agent_name: str
    action: str
    input_summary: str
    output_summary: str
    skills_called: list[str]
    duration_ms: int
    tokens_used: int


class PredictionResult(BaseModel):
    company: CompanyInfo
    inquiry_probability: float = Field(ge=0.0, le=1.0)
    risk_level: RiskLevel
    confidence: float
    window_days: int
    risk_factors: list[RiskFactor]
    shap_features: list[ShapFeature]
    similar_cases: list[SimilarCase]
    agent_trace: list[AgentStep]
    report_markdown: str
    analysis_time_ms: int
    llm_calls: int
    total_tokens: int


class ScanRequest(BaseModel):
    company_code: str
    window_days: int = 60


class BatchScanRequest(BaseModel):
    company_codes: list[str]
    window_days: int = 60


class RankingItem(BaseModel):
    rank: int
    company: CompanyInfo
    inquiry_probability: float
    risk_level: RiskLevel
    top_risk_factor: str


class RankingResponse(BaseModel):
    total: int
    window_days: int
    items: list[RankingItem]
