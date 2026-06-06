"""Financial-analysis skills."""
from __future__ import annotations

from typing import Any

from app.core.skill import skill


_INDUSTRY_BENCHMARK = {
    "default": {"gross_margin": 25.0, "debt_ratio": 50.0, "roe": 8.0, "ocf_to_profit": 0.9},
    "计算机应用": {"gross_margin": 40.0, "debt_ratio": 35.0, "roe": 10.0, "ocf_to_profit": 1.0},
    "医药生物": {"gross_margin": 55.0, "debt_ratio": 30.0, "roe": 11.0, "ocf_to_profit": 1.1},
    "钢铁": {"gross_margin": 10.0, "debt_ratio": 60.0, "roe": 6.0, "ocf_to_profit": 0.85},
    "房地产": {"gross_margin": 20.0, "debt_ratio": 75.0, "roe": 7.0, "ocf_to_profit": 0.6},
}


@skill(
    name="financial_calc",
    description="基于结构化财务数据计算盈利能力、偿债能力、营运能力、现金流等关键指标",
    input_schema={
        "type": "object",
        "properties": {
            "financial_data": {"type": "object", "description": "包含各类财务指标的 dict"},
        },
        "required": ["financial_data"],
    },
    tags=["analysis"],
)
def financial_calc(financial_data: dict[str, Any]) -> dict[str, Any]:
    fd = financial_data
    return {
        "profitability": {
            "roe": fd.get("roe"),
            "roa": fd.get("roa"),
            "gross_margin": fd.get("gross_margin"),
            "net_margin": fd.get("net_margin"),
        },
        "solvency": {
            "debt_ratio": fd.get("debt_ratio"),
            "current_ratio": fd.get("current_ratio"),
        },
        "operating": {
            "receivable_turnover": fd.get("receivable_turnover"),
            "inventory_turnover": fd.get("inventory_turnover"),
        },
        "cash_flow": {
            "ocf_to_profit": fd.get("ocf_to_profit"),
        },
        "growth": {
            "revenue_growth": fd.get("revenue_growth"),
            "profit_growth": fd.get("profit_growth"),
            "receivable_growth": fd.get("receivable_growth"),
        },
    }


@skill(
    name="anomaly_score",
    description="根据 Beneish M-Score / Altman Z-Score / 应收-收入比 等规则给出异常评分",
    input_schema={
        "type": "object",
        "properties": {
            "financial_data": {"type": "object"},
        },
        "required": ["financial_data"],
    },
    tags=["analysis"],
)
def anomaly_score(financial_data: dict[str, Any]) -> dict[str, Any]:
    fd = financial_data
    anomalies: list[dict[str, Any]] = []
    score = 0.0
    if fd.get("beneish_m_score", -3) > -2.22:
        anomalies.append({"name": "Beneish M-Score 超警戒线",
                          "value": fd["beneish_m_score"], "weight": 0.25})
        score += 0.25
    if fd.get("altman_z_score", 3) < 1.81:
        anomalies.append({"name": "Altman Z-Score 落入危险区",
                          "value": fd["altman_z_score"], "weight": 0.20})
        score += 0.20
    if fd.get("ocf_to_profit", 1) < 0.3:
        anomalies.append({"name": "经营现金流/净利润严重背离",
                          "value": fd["ocf_to_profit"], "weight": 0.18})
        score += 0.18
    rev_g = fd.get("revenue_growth", 0)
    rec_g = fd.get("receivable_growth", 0)
    if rev_g > 0 and rec_g > rev_g * 1.5:
        anomalies.append({"name": "应收增速远超收入增速",
                          "value": round(rec_g / max(1.0, rev_g), 2),
                          "weight": 0.15})
        score += 0.15
    if fd.get("pledge_ratio", 0) > 50:
        anomalies.append({"name": "大股东质押比例偏高",
                          "value": fd["pledge_ratio"], "weight": 0.12})
        score += 0.12
    if fd.get("debt_ratio", 0) > 70:
        anomalies.append({"name": "资产负债率偏高",
                          "value": fd["debt_ratio"], "weight": 0.10})
        score += 0.10
    return {
        "anomaly_count": len(anomalies),
        "score": round(min(1.0, score), 3),
        "anomalies": anomalies,
    }


@skill(
    name="industry_compare",
    description="将目标公司核心指标与行业基准对比，输出 Z-Score 偏离",
    input_schema={
        "type": "object",
        "properties": {
            "financial_data": {"type": "object"},
            "industry": {"type": "string"},
        },
        "required": ["financial_data", "industry"],
    },
    tags=["analysis"],
)
def industry_compare(financial_data: dict[str, Any], industry: str) -> dict[str, Any]:
    bm = _INDUSTRY_BENCHMARK.get(industry, _INDUSTRY_BENCHMARK["default"])
    out = {}
    for k, ind_v in bm.items():
        v = financial_data.get(k)
        if v is None:
            continue
        diff = v - ind_v
        z = diff / max(0.1, abs(ind_v) * 0.3)
        out[k] = {
            "company": v, "industry_avg": ind_v,
            "diff": round(diff, 3), "z_score": round(z, 3),
            "is_outlier": abs(z) > 2.0,
        }
    return {"industry": industry, "metrics": out}


@skill(
    name="rule_check",
    description="对一组规则进行匹配，返回命中的规则列表",
    input_schema={
        "type": "object",
        "properties": {
            "financial_data": {"type": "object"},
            "rules": {"type": "array"},
        },
        "required": ["financial_data"],
    },
    tags=["analysis"],
)
def rule_check(
    financial_data: dict[str, Any],
    rules: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    rules = rules or _DEFAULT_RULES
    hits = []
    for rule in rules:
        expr = rule.get("expr", "")
        try:
            ok = _safe_eval_expr(expr, financial_data)
        except Exception:
            ok = False
        if ok:
            hits.append({"name": rule.get("name", expr), "severity": rule.get("severity", "中")})
    return {"hits": hits, "n_hits": len(hits)}


import ast
import operator as _op

_SAFE_OPS = {
    ast.Add: _op.add, ast.Sub: _op.sub, ast.Mult: _op.mul,
    ast.Div: _op.truediv, ast.Mod: _op.mod, ast.Pow: _op.pow,
    ast.USub: _op.neg, ast.UAdd: _op.pos,
    ast.Gt: _op.gt, ast.Lt: _op.lt, ast.GtE: _op.ge, ast.LtE: _op.le,
    ast.Eq: _op.eq, ast.NotEq: _op.ne,
    ast.And: lambda a, b: a and b,
    ast.Or: lambda a, b: a or b,
    ast.Not: _op.not_,
}


def _safe_eval_expr(expr: str, variables: dict[str, Any]) -> bool:
    """Evaluate a simple comparison expression without using eval()."""
    tree = ast.parse(expr, mode="eval")

    def _eval(node: ast.expr) -> Any:
        if isinstance(node, ast.Expression):
            return _eval(node.body)
        if isinstance(node, ast.Constant):
            if not isinstance(node.value, (int, float, bool)):
                raise ValueError(f"unsupported constant: {node.value!r}")
            return node.value
        if isinstance(node, ast.Name):
            if node.id not in variables:
                raise ValueError(f"unknown variable: {node.id}")
            return variables[node.id]
        if isinstance(node, ast.UnaryOp):
            op_fn = _SAFE_OPS.get(type(node.op))
            if op_fn is None:
                raise ValueError(f"unsupported unary op: {type(node.op).__name__}")
            return op_fn(_eval(node.operand))
        if isinstance(node, ast.BinOp):
            op_fn = _SAFE_OPS.get(type(node.op))
            if op_fn is None:
                raise ValueError(f"unsupported binary op: {type(node.op).__name__}")
            return op_fn(_eval(node.left), _eval(node.right))
        if isinstance(node, ast.Compare):
            left = _eval(node.left)
            for op, comparator in zip(node.ops, node.comparators):
                op_fn = _SAFE_OPS.get(type(op))
                if op_fn is None:
                    raise ValueError(f"unsupported compare op: {type(op).__name__}")
                right = _eval(comparator)
                if not op_fn(left, right):
                    return False
                left = right
            return True
        if isinstance(node, ast.BoolOp):
            op_fn = _SAFE_OPS[type(node.op)]
            result = _eval(node.values[0])
            for v in node.values[1:]:
                result = op_fn(result, _eval(v))
            return result
        raise ValueError(f"unsupported AST node: {type(node).__name__}")

    return bool(_eval(tree))


_DEFAULT_RULES = [
    {"name": "应收增速 > 收入增速 × 2 且 商誉占比高",
     "expr": "receivable_growth > revenue_growth * 2 and pledge_ratio > 30",
     "severity": "高"},
    {"name": "OCF 与净利润严重背离",
     "expr": "ocf_to_profit < 0.3 and revenue_growth > 20",
     "severity": "高"},
    {"name": "M-Score 异常 + 大股东质押高",
     "expr": "beneish_m_score > -2.0 and pledge_ratio > 60",
     "severity": "高"},
    {"name": "持续亏损 + 负债高",
     "expr": "roe < 0 and debt_ratio > 70",
     "severity": "高"},
]
