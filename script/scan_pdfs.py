"""
扫描两个 PDF 数据集目录，提取文件路径信息并生成 CSV 表格。

目录结构：
  监管问询函及回复数据集/{stock_code}/{year}/{doc_type}/{filename}.pdf
  上市公司公告与定期报告数据集/{stock_code}/{year}/{doc_type}/{filename}.pdf

输出列：
  数据集, 股票代码, 年份, 文档类型, 文件名, 文件大小(KB), 完整路径
"""

import os
import csv
from pathlib import Path

# ── 配置 ──────────────────────────────────────────────
BASE = r"D:\赛题六数据\06-智能风控与量化建模赛道-东吴证券-基于 Agentic AI 的上市公司监管问询概率预测与扫雷预警算法探索"

DIRS = {
    "监管问询函及回复": os.path.join(BASE, "监管问询函及回复数据集"),
    "上市公司公告与定期报告": os.path.join(BASE, "上市公司公告与定期报告数据集"),
}

OUTPUT_CSV = os.path.join(os.path.dirname(os.path.abspath(__file__)), "Data", "pdf_file_index.csv")

# ── 中文类型映射（可选，方便阅读）──────────────────────
DOC_TYPE_MAP = {
    "inquiry_letter": "问询函",
    "inquiry_reply": "问询回复",
    "annual_report": "年报",
    "semi_report": "半年报",
    "q1_report": "一季报",
    "q3_report": "三季报",
    "equity_distribution": "股权分布",
    "performance_forecast": "业绩预告",
    "risk_warning": "风险提示",
    "other": "其他",
}

# ── 扫描 ─────────────────────────────────────────────
def scan_pdfs():
    rows = []
    for dataset_name, dataset_dir in DIRS.items():
        print(f"正在扫描: {dataset_name} ...")
        count = 0
        for root, _, files in os.walk(dataset_dir):
            for fname in files:
                if not fname.lower().endswith(".pdf"):
                    continue
                full_path = os.path.join(root, fname)

                # 从路径中提取结构信息
                rel_path = os.path.relpath(full_path, dataset_dir)
                parts = Path(rel_path).parts  # ('000004.SZ', '2020', 'inquiry_letter', 'szse_xxx.pdf')

                stock_code = parts[0] if len(parts) >= 1 else ""
                year = parts[1] if len(parts) >= 2 else ""
                doc_type = parts[2] if len(parts) >= 3 else ""
                doc_type_cn = DOC_TYPE_MAP.get(doc_type, doc_type)

                # 文件大小
                try:
                    size_kb = round(os.path.getsize(full_path) / 1024, 1)
                except OSError:
                    size_kb = ""

                rows.append({
                    "数据集": dataset_name,
                    "股票代码": stock_code,
                    "年份": year,
                    "文档类型": doc_type,
                    "文档类型(中文)": doc_type_cn,
                    "文件名": fname,
                    "文件大小(KB)": size_kb,
                    "完整路径": full_path,
                })
                count += 1
                if count % 5000 == 0:
                    print(f"  已扫描 {count} 个文件...")
        print(f"  完成，共 {count} 个文件")
    return rows


def main():
    os.makedirs(os.path.dirname(OUTPUT_CSV), exist_ok=True)
    rows = scan_pdfs()

    # 按 股票代码 + 年份 + 数据集 排序
    rows.sort(key=lambda r: (r["股票代码"], r["年份"], r["数据集"], r["文档类型"]))

    fieldnames = ["数据集", "股票代码", "年份", "文档类型", "文档类型(中文)", "文件名", "文件大小(KB)", "完整路径"]
    with open(OUTPUT_CSV, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    print(f"\n表格已保存到: {OUTPUT_CSV}")
    print(f"共计 {len(rows)} 条记录")

    # 打印简要统计
    from collections import Counter
    ds_counter = Counter(r["数据集"] for r in rows)
    print("\n── 数据集统计 ──")
    for ds, cnt in ds_counter.items():
        print(f"  {ds}: {cnt} 个文件")

    stock_counter = Counter(r["股票代码"] for r in rows)
    print(f"\n涉及股票: {len(stock_counter)} 只")

    year_counter = Counter(r["年份"] for r in rows)
    print("\n── 年份分布 ──")
    for yr in sorted(year_counter):
        print(f"  {yr}: {year_counter[yr]} 个文件")

    type_counter = Counter(r["文档类型(中文)"] for r in rows)
    print("\n── 文档类型分布 ──")
    for tp, cnt in type_counter.most_common():
        print(f"  {tp}: {cnt} 个文件")


if __name__ == "__main__":
    main()
