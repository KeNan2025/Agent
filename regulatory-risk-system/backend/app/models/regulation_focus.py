"""
Controlled vocabulary of regulation focus points.

The competition expects the model to classify "监管关注点" with
accuracy ≥ 80%. The vocabulary below mirrors the real-world topic
families found in SSE / SZSE inquiry letters. Each entry is a coarse
`category` × fine-grained `subcategory` pair.

Used by:
- `app/skills/announcement.py:text_extract` to constrain LLM output
- `app/eval/evidence_recall.py` to score recall against gold labels
- `app/api/eval_routes.py:/eval/regulation-focus` evaluation endpoint
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class FocusPoint:
    category: str
    subcategory: str
    description: str


REGULATION_FOCUS_VOCAB: list[FocusPoint] = [
    # ── 财务异常 ──
    FocusPoint("财务异常", "收入确认异常", "营收高速增长但应收账款显著增长更快；或异常季节性确认。"),
    FocusPoint("财务异常", "毛利率异常", "毛利率显著偏离行业平均或同比/环比剧烈波动。"),
    FocusPoint("财务异常", "存货异常", "存货周转率显著下降；存货跌价计提是否充分。"),
    FocusPoint("财务异常", "经营性现金流偏离", "净利润为正但 OCF 长期为负或 OCF/净利润 < 0.3。"),
    FocusPoint("财务异常", "商誉减值", "并购形成大额商誉是否需要计提减值。"),

    # ── 信息披露 ──
    FocusPoint("信息披露", "披露矛盾", "公告前后表述矛盾；年报与半年报数据不一致。"),
    FocusPoint("信息披露", "披露不充分", "重大事项披露不及时或缺失关键信息。"),
    FocusPoint("信息披露", "业绩预告偏差", "业绩预告与实际披露差异超过 10%。"),
    FocusPoint("信息披露", "业绩承诺未达成", "重组业绩承诺方未完成对赌目标。"),

    # ── 关联交易 / 资金占用 ──
    FocusPoint("关联交易", "关联方占用资金", "控股股东或关联方非经营性占用上市公司资金。"),
    FocusPoint("关联交易", "关联交易公允性", "向关联方采购/销售价格是否显著偏离市场公允价格。"),
    FocusPoint("关联交易", "关联担保", "对关联方提供担保是否超过净资产 30%。"),

    # ── 公司治理 ──
    FocusPoint("公司治理", "高管频繁变动", "12 个月内董监高变更次数 ≥ 3。"),
    FocusPoint("公司治理", "大股东股权质押", "控股股东股权质押比例 > 50% 或触及平仓线。"),
    FocusPoint("公司治理", "实控人变更", "实际控制人发生变更或拟变更。"),
    FocusPoint("公司治理", "内部控制缺陷", "内部控制审计报告出具非标准意见。"),

    # ── 经营合理性 ──
    FocusPoint("经营合理性", "持续经营能力", "审计报告就持续经营能力出具非标意见或 going concern 提示。"),
    FocusPoint("经营合理性", "大额诉讼仲裁", "未决诉讼或仲裁金额超过净资产 10%。"),
    FocusPoint("经营合理性", "产业政策风险", "主营业务受重大产业政策不利影响。"),

    # ── 并购重组 ──
    FocusPoint("并购重组", "重组对价公允性", "重组标的估值大幅溢价或采用激进估值方法。"),
    FocusPoint("并购重组", "重组方案合规性", "重组方案是否符合证监会规则。"),
    FocusPoint("并购重组", "并购后整合风险", "标的资产业绩波动或与上市公司协同效应不达预期。"),

    # ── 担保事项 ──
    FocusPoint("担保事项", "对外担保超限", "对外担保总额超过净资产 50%。"),
    FocusPoint("担保事项", "或有负债风险", "未披露的或有担保或诉讼。"),

    # ── 再融资 ──
    FocusPoint("再融资", "募集资金用途变更", "募投项目资金用途变更或延期。"),
    FocusPoint("再融资", "募投项目效益", "募投项目实际效益与预期严重偏离。"),

    # ── 会计处理 ──
    FocusPoint("会计处理", "会计政策变更", "会计政策或会计估计变更对业绩影响重大。"),
    FocusPoint("会计处理", "非经常性损益", "非经常性损益对净利润贡献显著（> 30%）。"),
    FocusPoint("会计处理", "审计意见", "审计师出具非标准无保留意见。"),
]


def list_categories() -> list[str]:
    return sorted({fp.category for fp in REGULATION_FOCUS_VOCAB})


def list_subcategories(category: str | None = None) -> list[str]:
    if category:
        return [fp.subcategory for fp in REGULATION_FOCUS_VOCAB if fp.category == category]
    return [fp.subcategory for fp in REGULATION_FOCUS_VOCAB]


def to_prompt() -> str:
    """Render the vocabulary as a Markdown list for system prompts."""
    by_cat: dict[str, list[FocusPoint]] = {}
    for fp in REGULATION_FOCUS_VOCAB:
        by_cat.setdefault(fp.category, []).append(fp)
    lines: list[str] = ["可选监管关注点（受控词表）："]
    for cat, items in by_cat.items():
        lines.append(f"- **{cat}**")
        for fp in items:
            lines.append(f"  - {fp.subcategory}：{fp.description}")
    return "\n".join(lines)


def is_known(category: str, subcategory: str) -> bool:
    return any(
        fp.category == category and fp.subcategory == subcategory
        for fp in REGULATION_FOCUS_VOCAB
    )
