"""Mock data generator for demo. Produces realistic A-share company data."""
from __future__ import annotations
import random
import hashlib
from datetime import datetime, timedelta
from app.config import MOCK_INQUIRY_RATE
from app.models.schemas import (
    CompanyInfo, FinancialFeatures, RiskFactor, RiskCategory,
    ShapFeature, SimilarCase, AgentStep, RiskLevel,
)

random.seed(42)

INDUSTRIES = [
    "计算机应用", "电子元器件", "医药生物", "机械设备", "化工",
    "房地产", "传媒", "食品饮料", "汽车", "电力设备",
    "建筑装饰", "纺织服饰", "农林牧渔", "采掘", "钢铁",
    "非银金融", "通信", "公用事业", "商业贸易", "交通运输",
]

COMPANY_NAMES = [
    "星辰科技", "华盛电子", "瑞康医药", "东方机械", "天成化工",
    "恒信地产", "博雅传媒", "嘉禾食品", "驰远汽车", "光源电力",
    "宏达建筑", "锦绣纺织", "绿野农业", "鑫盛矿业", "钢联实业",
    "汇通金融", "信达通信", "清源环保", "华贸商业", "通远物流",
    "创智信息", "微芯半导", "百灵药业", "精工制造", "万华材料",
    "城建发展", "新锐文化", "三元乳业", "长安动力", "国电能源",
    "中建集成", "华纺股份", "丰收牧业", "紫金资源", "鞍山重工",
    "信泰证券", "烽火科技", "京能热电", "苏宁易购", "中远海运",
    "联创电子", "芯源微电", "太极药业", "徐工科技", "蓝星化学",
    "万科置业", "光线影业", "伊利股份", "比亚迪新", "宁德时代",
]

RISK_TEMPLATES = {
    RiskCategory.FINANCIAL_ANOMALY: [
        {
            "subcategory": "收入确认异常",
            "description": "公司{period}营业收入同比增长{rev_growth:.0%}，但经营性现金流同比下降{ocf_decline:.0%}，收入质量存疑",
            "evidence": "本期营业收入较上年同期增长{rev_growth:.1%}，主要系公司加大市场开拓力度所致。经营活动产生的现金流量净额为{ocf:.2f}亿元，较上年同期减少{ocf_decline:.1%}。",
            "source": "{period}年报 第四节 经营情况讨论与分析 P{page}",
        },
        {
            "subcategory": "大额资产减值",
            "description": "商誉占净资产比例达{gw_ratio:.0%}，远超行业均值{ind_avg:.0%}，存在大额减值风险",
            "evidence": "截至报告期末，公司商誉账面价值为{gw:.2f}亿元，占净资产比例为{gw_ratio:.1%}。本期对并购标的进行减值测试。",
            "source": "{period}年报 财务报表附注 P{page}",
        },
        {
            "subcategory": "毛利率偏离",
            "description": "毛利率{gm:.1%}，偏离行业均值{ind_gm:.1%}达{deviation:.1f}个标准差",
            "evidence": "本期综合毛利率为{gm:.2%}，较上年同期变动{gm_change:.2%}。",
            "source": "{period}年报 第四节 P{page}",
        },
    ],
    RiskCategory.RELATED_TRANSACTION: [
        {
            "subcategory": "关联交易定价公允性",
            "description": "与控股股东关联交易金额{amount:.2f}亿元，同比增长{growth:.0%}，定价依据不充分",
            "evidence": "报告期内，公司与控股股东及其关联方发生日常关联交易合计{amount:.2f}亿元，较上年同期增长{growth:.1%}。",
            "source": "{period}年报 第五节 重要事项 关联交易 P{page}",
        },
        {
            "subcategory": "关联方资金往来",
            "description": "其他应收款中关联方往来款{amount:.2f}亿元，占其他应收款总额{ratio:.0%}",
            "evidence": "其他应收款期末余额中，关联方往来款项为{amount:.2f}亿元。",
            "source": "{period}年报 财务报表附注 P{page}",
        },
    ],
    RiskCategory.FUND_ISSUE: [
        {
            "subcategory": "违规担保",
            "description": "对外担保总额{amount:.2f}亿元，占净资产{ratio:.0%}，其中对关联方担保占比{related_ratio:.0%}",
            "evidence": "截至报告期末，公司对外担保余额合计{amount:.2f}亿元，占公司最近一期经审计净资产的{ratio:.1%}。",
            "source": "{period}年报 第五节 重要事项 P{page}",
        },
    ],
    RiskCategory.GOVERNANCE: [
        {
            "subcategory": "高管异动",
            "description": "近12个月内{count}名董监高辞职，包括财务总监变更",
            "evidence": "报告期内，公司董事{name1}先生因个人原因辞去公司董事及相关职务；副总经理兼财务总监{name2}女士因工作调整辞去财务总监职务。",
            "source": "{period}年报 第九节 董监高变动 P{page}",
        },
    ],
    RiskCategory.DISCLOSURE: [
        {
            "subcategory": "前后矛盾",
            "description": "业绩预告与实际业绩偏差达{deviation:.0%}，超过合理范围",
            "evidence": "公司此前发布的业绩预告预计净利润为{forecast:.2f}亿元至{forecast_high:.2f}亿元，实际净利润为{actual:.2f}亿元，偏差{deviation:.1%}。",
            "source": "业绩预告修正公告 + {period}年报",
        },
    ],
}

INQUIRY_TYPES = ["年报问询函", "关注函", "重组问询函", "许可类问询函", "半年报问询函"]

NAMES_POOL = ["张明", "李华", "王芳", "陈强", "刘洋", "赵丽", "周伟", "吴静"]


def _seed_from_code(code: str) -> int:
    return int(hashlib.md5(code.encode()).hexdigest()[:8], 16)


def generate_companies(n: int = 200) -> list[CompanyInfo]:
    companies = []
    for i in range(n):
        idx = i % len(COMPANY_NAMES)
        suffix = f"{'ABCDEFGHIJ'[i // len(COMPANY_NAMES)]}" if i >= len(COMPANY_NAMES) else ""
        exchange = "60" if i % 3 == 0 else ("00" if i % 3 == 1 else "30")
        code = f"{exchange}{i:04d}"
        companies.append(CompanyInfo(
            code=code,
            name=f"{COMPANY_NAMES[idx]}{suffix}",
            industry=INDUSTRIES[i % len(INDUSTRIES)],
            market_cap=round(random.uniform(15, 3000), 2),
            listing_date=f"{random.randint(1998, 2022)}-{random.randint(1,12):02d}-{random.randint(1,28):02d}",
        ))
    return companies


def generate_financial_features(company: CompanyInfo, is_risky: bool = False) -> FinancialFeatures:
    rng = random.Random(_seed_from_code(company.code))
    if is_risky:
        return FinancialFeatures(
            roe=round(rng.uniform(-15, 8), 2),
            roa=round(rng.uniform(-8, 4), 2),
            gross_margin=round(rng.uniform(5, 65), 2),
            net_margin=round(rng.uniform(-20, 10), 2),
            debt_ratio=round(rng.uniform(55, 92), 2),
            current_ratio=round(rng.uniform(0.4, 1.2), 2),
            receivable_turnover=round(rng.uniform(1.0, 4.0), 2),
            inventory_turnover=round(rng.uniform(1.0, 5.0), 2),
            ocf_to_profit=round(rng.uniform(-2.0, 0.5), 2),
            revenue_growth=round(rng.uniform(-10, 60), 2),
            profit_growth=round(rng.uniform(-80, 20), 2),
            receivable_growth=round(rng.uniform(30, 120), 2),
            beneish_m_score=round(rng.uniform(-2.5, -1.2), 2),
            altman_z_score=round(rng.uniform(0.5, 2.2), 2),
            pledge_ratio=round(rng.uniform(30, 90), 2),
            exec_turnover_count=rng.randint(2, 6),
        )
    return FinancialFeatures(
        roe=round(rng.uniform(5, 25), 2),
        roa=round(rng.uniform(3, 15), 2),
        gross_margin=round(rng.uniform(20, 55), 2),
        net_margin=round(rng.uniform(5, 25), 2),
        debt_ratio=round(rng.uniform(20, 55), 2),
        current_ratio=round(rng.uniform(1.5, 4.0), 2),
        receivable_turnover=round(rng.uniform(4.0, 12.0), 2),
        inventory_turnover=round(rng.uniform(4.0, 15.0), 2),
        ocf_to_profit=round(rng.uniform(0.6, 1.5), 2),
        revenue_growth=round(rng.uniform(-5, 30), 2),
        profit_growth=round(rng.uniform(-10, 40), 2),
        receivable_growth=round(rng.uniform(-5, 25), 2),
        beneish_m_score=round(rng.uniform(-3.5, -2.2), 2),
        altman_z_score=round(rng.uniform(2.5, 5.0), 2),
        pledge_ratio=round(rng.uniform(0, 25), 2),
        exec_turnover_count=rng.randint(0, 1),
    )


def generate_risk_factors(company: CompanyInfo, fin: FinancialFeatures) -> list[RiskFactor]:
    rng = random.Random(_seed_from_code(company.code) + 1)
    factors = []
    cat_templates = list(RISK_TEMPLATES.items())
    rng.shuffle(cat_templates)
    n_factors = rng.randint(2, 5)
    for cat, templates in cat_templates[:n_factors]:
        tmpl = rng.choice(templates)
        params = {
            "period": "2024", "page": rng.randint(10, 120),
            "rev_growth": abs(fin.revenue_growth) / 100, "ocf_decline": rng.uniform(15, 45) / 100,
            "ocf": round(rng.uniform(-3, -0.5), 2),
            "gw_ratio": rng.uniform(25, 60) / 100, "ind_avg": rng.uniform(8, 15) / 100,
            "gw": round(rng.uniform(2, 20), 2),
            "gm": fin.gross_margin / 100, "ind_gm": rng.uniform(20, 35) / 100,
            "gm_change": rng.uniform(-8, 8) / 100, "deviation": rng.uniform(1.5, 3.5),
            "amount": round(rng.uniform(0.5, 15), 2), "growth": rng.uniform(20, 80),
            "ratio": rng.uniform(30, 75), "related_ratio": rng.uniform(40, 85),
            "count": rng.randint(2, 5),
            "name1": rng.choice(NAMES_POOL), "name2": rng.choice(NAMES_POOL),
            "forecast": round(rng.uniform(1, 5), 2),
            "forecast_high": round(rng.uniform(5, 8), 2),
            "actual": round(rng.uniform(0.2, 1.5), 2),
        }
        try:
            desc = tmpl["description"].format(**params)
            evidence = tmpl["evidence"].format(**params)
            source = tmpl["source"].format(**params)
        except (KeyError, ValueError):
            desc = tmpl["description"].split("{")[0] + "..."
            evidence = tmpl["evidence"].split("{")[0] + "..."
            source = "2024年报"
        factors.append(RiskFactor(
            category=cat,
            subcategory=tmpl["subcategory"],
            description=desc,
            evidence_quote=evidence,
            evidence_source=source,
            severity=rng.choice(["高", "高", "中"]),
            confidence=round(rng.uniform(0.7, 0.95), 2),
        ))
    return factors


def generate_shap_features(fin: FinancialFeatures, risk_factors: list[RiskFactor], probability: float) -> list[ShapFeature]:
    feature_pool = [
        ("收入确认异常", f"应收增速/收入增速={fin.receivable_growth/max(fin.revenue_growth,1):.1f}x", "应收账款增速远超收入增速，收入质量存疑"),
        ("Beneish M-Score", f"{fin.beneish_m_score}", "盈余操纵概率指标超过警戒线-1.78"),
        ("经营现金流/利润", f"{fin.ocf_to_profit}", "现金流与利润严重背离"),
        ("大股东质押比例", f"{fin.pledge_ratio}%", "大股东质押比例偏高，存在平仓风险"),
        ("资产负债率", f"{fin.debt_ratio}%", "负债率偏高，偿债压力较大"),
        ("毛利率偏离度", f"{fin.gross_margin}%", "毛利率偏离行业均值"),
        ("董监高变动", f"{fin.exec_turnover_count}人", "近期高管频繁变动"),
        ("Altman Z-Score", f"{fin.altman_z_score}", "财务困境预测指标偏低"),
        ("营收增长率", f"{fin.revenue_growth}%", "营收增速异常"),
        ("关联交易风险", "检出", "存在关联交易相关风险要素"),
    ]
    remaining = probability - 0.03
    features = []
    for i, (name, value, desc) in enumerate(feature_pool[:7]):
        if remaining <= 0:
            break
        sv = round(remaining * random.uniform(0.15, 0.4), 4)
        remaining -= sv
        features.append(ShapFeature(feature_name=name, feature_value=value, shap_value=sv, description=desc))
    features.append(ShapFeature(feature_name="基准概率", feature_value="全市场", shap_value=0.03, description="全市场基准问询概率"))
    features.sort(key=lambda x: -x.shap_value)
    return features


def generate_similar_cases(company: CompanyInfo, risk_factors: list[RiskFactor]) -> list[SimilarCase]:
    rng = random.Random(_seed_from_code(company.code) + 2)
    cases = []
    case_companies = [
        ("600123", "盛通股份"), ("000456", "远兴能源"), ("300789", "康弘药业"),
        ("002345", "潮宏基"), ("600890", "中房股份"), ("000712", "锦瑞新材"),
        ("300155", "安居宝"), ("002678", "珠江钢琴"), ("600501", "航天晨光"),
    ]
    risk_dims = [f.subcategory for f in risk_factors[:2]] if risk_factors else ["财务异常"]
    for i in range(min(5, len(case_companies))):
        cc, cn = case_companies[i]
        cases.append(SimilarCase(
            company_code=cc,
            company_name=cn,
            inquiry_date=f"2023-{rng.randint(1,12):02d}-{rng.randint(1,28):02d}",
            inquiry_type=rng.choice(INQUIRY_TYPES),
            similarity=round(rng.uniform(0.65, 0.93), 2),
            match_dimensions="+".join(risk_dims[:2]),
            key_difference=rng.choice([
                "行业不同，对方为制造业",
                "规模差异较大，对方市值更小",
                "对方关联交易占比更高",
                "审计机构不同",
            ]),
        ))
    cases.sort(key=lambda x: -x.similarity)
    return cases


def generate_agent_trace(company: CompanyInfo, risk_factors: list[RiskFactor]) -> list[AgentStep]:
    rng = random.Random(_seed_from_code(company.code) + 3)
    rf_count = len(risk_factors)
    high_count = sum(1 for r in risk_factors if r.severity == "高")
    hypothesis = risk_factors[0].category.value if risk_factors else "财务异常"
    steps = [
        AgentStep(
            step_id=1, agent_name="Master Planner",
            action="初始风险假设",
            input_summary=f"公司代码={company.code}, 窗口=60天",
            output_summary=f"初始假设: {hypothesis}型风险为主 → 优先调度财务异常Agent和公告研读Agent",
            skills_called=[], duration_ms=rng.randint(200, 500), tokens_used=rng.randint(300, 600),
        ),
        AgentStep(
            step_id=2, agent_name="财务异常检测Agent",
            action="财务指标计算与异常评分",
            input_summary=f"公司代码={company.code}, 最近4个季度财务数据",
            output_summary=f"Beneish M-Score={risk_factors[0].confidence if risk_factors else 0:.2f}, 检出{rf_count}项异常指标",
            skills_called=["financial_calc", "anomaly_score", "industry_compare"],
            duration_ms=rng.randint(300, 800), tokens_used=0,
        ),
        AgentStep(
            step_id=3, agent_name="公告研读Agent",
            action="公告检索与风险要素抽取",
            input_summary=f"公司代码={company.code}, 近12个月公告",
            output_summary=f"检索到{rng.randint(8,25)}篇公告, 抽取{rf_count}项风险要素, 其中{high_count}项高风险",
            skills_called=["announcement_search", "text_extract", "table_parse"],
            duration_ms=rng.randint(2000, 5000), tokens_used=rng.randint(3000, 8000),
        ),
        AgentStep(
            step_id=4, agent_name="Master Planner",
            action="中间重规划 (Replan)",
            input_summary=f"已完成财务分析和公告研读, 发现{high_count}项高风险",
            output_summary="发现关联交易线索 → 追加图谱分析Agent" if any(r.category == RiskCategory.RELATED_TRANSACTION for r in risk_factors) else "风险画像已充分 → 进入预测阶段",
            skills_called=[], duration_ms=rng.randint(150, 400), tokens_used=rng.randint(200, 500),
        ),
        AgentStep(
            step_id=5, agent_name="概率预测模型",
            action="多模型融合预测",
            input_summary=f"特征维度=235, 模型=CatBoost+LightGBM+TabPFN-2.5",
            output_summary=f"CatBoost={rng.uniform(0.5,0.9):.3f}, LightGBM={rng.uniform(0.5,0.9):.3f}, TabPFN={rng.uniform(0.5,0.9):.3f} → Stacking融合",
            skills_called=["probability_predictor"],
            duration_ms=rng.randint(100, 300), tokens_used=0,
        ),
        AgentStep(
            step_id=6, agent_name="案例检索Agent",
            action="相似历史问询案例检索",
            input_summary="基于风险画像向量进行混合检索",
            output_summary=f"检索到Top-5相似案例, 最高相似度={rng.uniform(0.75,0.93):.2f}",
            skills_called=["case_match", "evidence_retrieve"],
            duration_ms=rng.randint(500, 1500), tokens_used=rng.randint(500, 1500),
        ),
        AgentStep(
            step_id=7, agent_name="归因解释Agent",
            action="生成可解释预警报告",
            input_summary="聚合全部分析结果, SHAP分解, 证据关联",
            output_summary="生成包含风险因素、证据片段、案例对比、推理链路的完整预警报告",
            skills_called=["report_gen", "shap_explain"],
            duration_ms=rng.randint(1500, 3000), tokens_used=rng.randint(2000, 5000),
        ),
    ]
    return steps


def generate_report_markdown(company: CompanyInfo, probability: float, risk_level: RiskLevel,
                             risk_factors: list[RiskFactor], shap_features: list[ShapFeature],
                             similar_cases: list[SimilarCase], fin: FinancialFeatures) -> str:
    lines = [
        f"# 上市公司扫雷预警报告",
        f"",
        f"## 基本信息",
        f"- **公司**：{company.name}（{company.code}）",
        f"- **行业**：{company.industry}",
        f"- **市值**：{company.market_cap}亿元",
        f"- **分析日期**：{__import__('datetime').date.today().isoformat()}",
        f"- **预测窗口**：60天",
        f"",
        f"## 风险概率评估",
        f"- **监管问询概率：{probability:.1%}**",
        f"- **风险等级：{risk_level.value}**",
        f"- 模型置信度：{probability * 0.95 + 0.02:.2f}",
        f"",
        f"## 关键风险因素",
    ]
    for i, rf in enumerate(risk_factors, 1):
        contrib = shap_features[i-1].shap_value if i <= len(shap_features) else 0
        lines.extend([
            f"",
            f"### {i}. {rf.subcategory}（影响度 {contrib:.0%}）",
            f"- **风险描述**：{rf.description}",
            f"- **证据来源**：{rf.evidence_source}",
            f'- **原文引用**：> "{rf.evidence_quote}"',
        ])
    lines.extend([
        f"",
        f"## 财务指标摘要",
        f"| 指标 | 当前值 | 状态 |",
        f"|------|--------|------|",
        f"| ROE | {fin.roe}% | {'⚠ 偏低' if fin.roe < 5 else '正常'} |",
        f"| 资产负债率 | {fin.debt_ratio}% | {'⚠ 偏高' if fin.debt_ratio > 65 else '正常'} |",
        f"| Beneish M-Score | {fin.beneish_m_score} | {'⚠ 异常' if fin.beneish_m_score > -1.78 else '正常'} |",
        f"| Altman Z-Score | {fin.altman_z_score} | {'⚠ 风险' if fin.altman_z_score < 1.8 else '正常'} |",
        f"| 大股东质押比例 | {fin.pledge_ratio}% | {'⚠ 偏高' if fin.pledge_ratio > 50 else '正常'} |",
        f"",
        f"## 相似历史问询案例",
        f"| 排名 | 公司 | 日期 | 类型 | 相似度 | 匹配维度 |",
        f"|------|------|------|------|--------|----------|",
    ])
    for j, c in enumerate(similar_cases[:5], 1):
        lines.append(f"| {j} | {c.company_name}({c.company_code}) | {c.inquiry_date} | {c.inquiry_type} | {c.similarity:.2f} | {c.match_dimensions} |")
    return "\n".join(lines)


_COMPANIES: list[CompanyInfo] | None = None
_PREDICTIONS: dict | None = None


def get_all_companies() -> list[CompanyInfo]:
    global _COMPANIES
    if _COMPANIES is None:
        _COMPANIES = generate_companies(200)
    return _COMPANIES


def get_company(code: str) -> CompanyInfo | None:
    for c in get_all_companies():
        if c.code == code:
            return c
    return None


def get_all_predictions(window_days: int = 60) -> list[dict]:
    global _PREDICTIONS
    cache_key = f"w{window_days}"
    if _PREDICTIONS is None:
        _PREDICTIONS = {}
    if cache_key not in _PREDICTIONS:
        results = []
        companies = get_all_companies()
        for c in companies:
            rng = random.Random(_seed_from_code(c.code) + window_days)
            is_risky = rng.random() < MOCK_INQUIRY_RATE
            prob = round(rng.uniform(0.55, 0.95), 3) if is_risky else round(rng.uniform(0.02, 0.35), 3)
            risk_level = RiskLevel.HIGH if prob >= 0.6 else (RiskLevel.MEDIUM if prob >= 0.3 else RiskLevel.LOW)
            fin = generate_financial_features(c, is_risky)
            risk_factors = generate_risk_factors(c, fin) if is_risky else generate_risk_factors(c, fin)[:1]
            results.append({
                "company": c,
                "probability": prob,
                "risk_level": risk_level,
                "financial": fin,
                "risk_factors": risk_factors,
                "top_risk": risk_factors[0].subcategory if risk_factors else "无明显风险",
            })
        results.sort(key=lambda x: -x["probability"])
        _PREDICTIONS[cache_key] = results
    return _PREDICTIONS[cache_key]


def get_full_prediction(code: str, window_days: int = 60) -> dict | None:
    all_preds = get_all_predictions(window_days)
    for p in all_preds:
        if p["company"].code == code:
            company = p["company"]
            fin = p["financial"]
            risk_factors = p["risk_factors"]
            probability = p["probability"]
            risk_level = p["risk_level"]
            shap_features = generate_shap_features(fin, risk_factors, probability)
            similar_cases = generate_similar_cases(company, risk_factors)
            agent_trace = generate_agent_trace(company, risk_factors)
            report_md = generate_report_markdown(company, probability, risk_level, risk_factors, shap_features, similar_cases, fin)
            total_tokens = sum(s.tokens_used for s in agent_trace)
            total_time = sum(s.duration_ms for s in agent_trace)
            return {
                "company": company,
                "probability": probability,
                "risk_level": risk_level,
                "financial": fin,
                "risk_factors": risk_factors,
                "shap_features": shap_features,
                "similar_cases": similar_cases,
                "agent_trace": agent_trace,
                "report_markdown": report_md,
                "analysis_time_ms": total_time,
                "llm_calls": sum(1 for s in agent_trace if s.tokens_used > 0),
                "total_tokens": total_tokens,
            }
    return None
