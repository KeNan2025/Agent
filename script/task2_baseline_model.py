"""
任务2 - 上市公司被问询概率预测 (基准模型)

数据来源：
  - 标签: Data/标签与评测数据集/dataset_split_labels.csv
  - 财务特征: Data/财务市场特征数据集/wind_features_extracted.csv

方法概述：
  1. 特征工程 — 基于季度财务数据构建公司级静态特征（最新季报快照 + 历史统计量）
  2. 训练 LightGBM / XGBoost 二分类模型
  3. 在 Validation / Test 集上评估 AUC、F1、Top-10% Capture Rate
"""

import os
import json
import warnings
import numpy as np
import pandas as pd
from pathlib import Path
from collections import Counter

from sklearn.metrics import (
    roc_auc_score, f1_score, precision_score, recall_score,
    classification_report, confusion_matrix, precision_recall_curve
)
from sklearn.preprocessing import LabelEncoder
import lightgbm as lgb
import xgboost as xgb

warnings.filterwarnings("ignore")

# ── 路径配置 ──────────────────────────────────────────
BASE = Path(__file__).resolve().parent.parent
LABEL_PATH = BASE / "Data" / "标签与评测数据集" / "dataset_split_labels.csv"
FEATURE_PATH = BASE / "Data" / "财务市场特征数据集" / "wind_features_extracted.csv"
OUTPUT_DIR = BASE / "script" / "outputs"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# ── 1. 加载数据 ──────────────────────────────────────
print("=" * 60)
print("  任务2: 上市公司被问询概率预测 (基准模型)")
print("=" * 60)

labels = pd.read_csv(LABEL_PATH)
features = pd.read_csv(FEATURE_PATH)

print(f"\n标签数据: {len(labels)} 家公司")
print(f"  is_risky=1: {(labels['is_risky']==1).sum()}, is_risky=0: {(labels['is_risky']==0).sum()}")
print(f"  Train: {(labels['split']=='Train').sum()}, Val: {(labels['split']=='Validation').sum()}, Test: {(labels['split']=='Test').sum()}")
print(f"财务特征: {len(features)} 条记录, {features['company_code'].nunique()} 家公司")

# ── 2. 特征工程 ──────────────────────────────────────
print("\n── 特征工程 ──")

NUM_COLS = [
    "market_cap", "pe_ratio", "pb_ratio",
    "total_revenue", "net_profit", "operating_cash_flow",
    "roe", "roa", "debt_to_assets_ratio",
    "revenue_yoy_growth", "net_profit_yoy_growth",
]

def build_company_features(df):
    """将季度财务数据聚合为公司级特征"""
    company_feats = []

    for code, grp in df.groupby("company_code"):
        grp = grp.sort_values("report_period")
        feat = {"company_code": code}

        # 行业 (取众数)
        feat["industry"] = grp["industry"].mode().iloc[0] if grp["industry"].notna().any() else "Unknown"

        # 最新一期快照
        latest = grp.iloc[-1]
        for col in NUM_COLS:
            feat[f"latest_{col}"] = latest[col]

        # 历史统计量 (可回溯的列)
        for col in NUM_COLS:
            series = grp[col].dropna()
            if len(series) >= 2:
                feat[f"mean_{col}"] = series.mean()
                feat[f"std_{col}"] = series.std()
                feat[f"min_{col}"] = series.min()
                feat[f"max_{col}"] = series.max()
                # 趋势: 线性回归斜率
                x = np.arange(len(series))
                slope = np.polyfit(x, series.values, 1)[0]
                feat[f"trend_{col}"] = slope
                # 最近变化率
                feat[f"change_{col}"] = (series.iloc[-1] - series.iloc[-2]) / (abs(series.iloc[-2]) + 1e-8)
            elif len(series) == 1:
                feat[f"mean_{col}"] = series.iloc[0]
                feat[f"std_{col}"] = 0
                feat[f"min_{col}"] = series.iloc[0]
                feat[f"max_{col}"] = series.iloc[0]
                feat[f"trend_{col}"] = 0
                feat[f"change_{col}"] = 0
            else:
                for suffix in ["mean_", "std_", "min_", "max_", "trend_", "change_"]:
                    feat[f"{suffix}{col}"] = np.nan

        # 覆盖季度数
        feat["num_quarters"] = len(grp)

        # 亏损季度占比
        if grp["net_profit"].notna().sum() > 0:
            feat["loss_quarter_ratio"] = (grp["net_profit"].dropna() < 0).mean()
        else:
            feat["loss_quarter_ratio"] = np.nan

        # 负债率是否超过阈值
        if grp["debt_to_assets_ratio"].notna().sum() > 0:
            feat["high_debt_ratio"] = (grp["debt_to_assets_ratio"].dropna() > 70).mean()
        else:
            feat["high_debt_ratio"] = np.nan

        # ROE 连续下降季度数
        roe_series = grp["roe"].dropna()
        if len(roe_series) >= 2:
            diffs = roe_series.diff().dropna()
            feat["roe_decline_streak"] = (diffs < 0).sum()
        else:
            feat["roe_decline_streak"] = 0

        company_feats.append(feat)

    return pd.DataFrame(company_feats)


print("正在聚合公司级特征...")
company_df = build_company_features(features)
print(f"生成 {len(company_df)} 家公司的特征, 共 {company_df.shape[1]-2} 个特征")

# ── 3. 合并标签 & 编码 ────────────────────────────────
merged = company_df.merge(labels, left_on="company_code", right_on="secucode", how="inner")
print(f"合并后样本数: {len(merged)}")

# 行业编码
le = LabelEncoder()
merged["industry_enc"] = le.fit_transform(merged["industry"].fillna("Unknown"))

# 特征列
FEAT_COLS = [c for c in merged.columns if c not in
             ["company_code", "secucode", "industry", "is_risky", "company_type", "split"]]

# 划分
train = merged[merged["split"] == "Train"]
val   = merged[merged["split"] == "Validation"]
test  = merged[merged["split"] == "Test"]

X_train, y_train = train[FEAT_COLS].values, train["is_risky"].values
X_val,   y_val   = val[FEAT_COLS].values,   val["is_risky"].values
X_test,  y_test  = test[FEAT_COLS].values,  test["is_risky"].values

print(f"Train: {len(train)}, Val: {len(val)}, Test: {len(test)}")
print(f"正样本比例 - Train: {y_train.mean():.3f}, Val: {y_val.mean():.3f}, Test: {y_test.mean():.3f}")

# ── 4. 辅助函数 ───────────────────────────────────────
def top_k_capture(y_true, y_prob, k_pct=10):
    """Top-K% 高风险公司中覆盖的真实正样本比例"""
    n = len(y_true)
    k = max(1, int(n * k_pct / 100))
    top_idx = np.argsort(y_prob)[-k:]
    return y_true[top_idx].sum() / max(y_true.sum(), 1)


def find_best_f1(y_true, y_prob):
    """遍历阈值找最优 F1"""
    precisions, recalls, thresholds = precision_recall_curve(y_true, y_prob)
    f1s = 2 * precisions * recalls / (precisions + recalls + 1e-10)
    best_idx = np.argmax(f1s)
    return f1s[best_idx], thresholds[best_idx] if best_idx < len(thresholds) else 0.5


def evaluate(y_true, y_prob, label=""):
    """综合评估"""
    auc = roc_auc_score(y_true, y_prob)
    best_f1, best_thr = find_best_f1(y_true, y_prob)
    y_pred = (y_prob >= best_thr).astype(int)
    prec = precision_score(y_true, y_pred, zero_division=0)
    rec  = recall_score(y_true, y_pred, zero_division=0)
    top10 = top_k_capture(y_true, y_prob, 10)

    print(f"\n  [{label}] AUC={auc:.4f} | F1={best_f1:.4f} (thr={best_thr:.3f}) | "
          f"Precision={prec:.4f} | Recall={rec:.4f} | Top10%Capture={top10:.4f}")
    print(f"  混淆矩阵: TN={((y_pred==0)&(y_true==0)).sum()} FP={((y_pred==1)&(y_true==0)).sum()} "
          f"FN={((y_pred==0)&(y_true==1)).sum()} TP={((y_pred==1)&(y_true==1)).sum()}")

    return {
        "auc": round(auc, 4),
        "f1": round(best_f1, 4),
        "best_threshold": round(best_thr, 4),
        "precision": round(prec, 4),
        "recall": round(rec, 4),
        "top10_capture": round(top10, 4),
    }


# ── 5. LightGBM ───────────────────────────────────────
print("\n" + "=" * 60)
print("  模型 1: LightGBM")
print("=" * 60)

lgb_params = {
    "objective": "binary",
    "metric": "auc",
    "learning_rate": 0.05,
    "num_leaves": 31,
    "max_depth": 6,
    "min_child_samples": 20,
    "subsample": 0.8,
    "colsample_bytree": 0.8,
    "reg_alpha": 0.1,
    "reg_lambda": 0.1,
    "scale_pos_weight": (y_train == 0).sum() / max((y_train == 1).sum(), 1),
    "verbose": -1,
    "random_state": 42,
}

lgb_train_ds = lgb.Dataset(X_train, y_train, feature_name=FEAT_COLS)
lgb_val_ds   = lgb.Dataset(X_val, y_val, feature_name=FEAT_COLS, reference=lgb_train_ds)

callbacks = [
    lgb.early_stopping(50),
    lgb.log_evaluation(100),
]

lgb_model = lgb.train(
    lgb_params,
    lgb_train_ds,
    num_boost_round=1000,
    valid_sets=[lgb_train_ds, lgb_val_ds],
    valid_names=["train", "valid"],
    callbacks=callbacks,
)

lgb_val_prob  = lgb_model.predict(X_val)
lgb_test_prob = lgb_model.predict(X_test)

lgb_val_res  = evaluate(y_val,  lgb_val_prob,  "LightGBM-Validation")
lgb_test_res = evaluate(y_test, lgb_test_prob, "LightGBM-Test")

# 特征重要性
lgb_imp = pd.DataFrame({
    "feature": FEAT_COLS,
    "importance": lgb_model.feature_importance(importance_type="gain"),
}).sort_values("importance", ascending=False)
print("\nLightGBM Top-15 特征:")
for _, row in lgb_imp.head(15).iterrows():
    print(f"  {row['feature']:40s} {row['importance']:>12.1f}")


# ── 6. XGBoost ────────────────────────────────────────
print("\n" + "=" * 60)
print("  模型 2: XGBoost")
print("=" * 60)

xgb_params = {
    "objective": "binary:logistic",
    "eval_metric": "auc",
    "learning_rate": 0.05,
    "max_depth": 6,
    "min_child_weight": 20,
    "subsample": 0.8,
    "colsample_bytree": 0.8,
    "reg_alpha": 0.1,
    "reg_lambda": 0.1,
    "scale_pos_weight": (y_train == 0).sum() / max((y_train == 1).sum(), 1),
    "verbosity": 0,
    "random_state": 42,
}

dtrain = xgb.DMatrix(X_train, y_train, feature_names=FEAT_COLS)
dval   = xgb.DMatrix(X_val,   y_val,   feature_names=FEAT_COLS)
dtest  = xgb.DMatrix(X_test,  y_test,  feature_names=FEAT_COLS)

xgb_model = xgb.train(
    xgb_params,
    dtrain,
    num_boost_round=1000,
    evals=[(dtrain, "train"), (dval, "valid")],
    early_stopping_rounds=50,
    verbose_eval=100,
)

xgb_val_prob  = xgb_model.predict(dval)
xgb_test_prob = xgb_model.predict(dtest)

xgb_val_res  = evaluate(y_val,  xgb_val_prob,  "XGBoost-Validation")
xgb_test_res = evaluate(y_test, xgb_test_prob, "XGBoost-Test")

xgb_imp = pd.DataFrame({
    "feature": FEAT_COLS,
    "importance": [xgb_model.get_score(importance_type="gain").get(f, 0) for f in FEAT_COLS],
}).sort_values("importance", ascending=False)
print("\nXGBoost Top-15 特征:")
for _, row in xgb_imp.head(15).iterrows():
    print(f"  {row['feature']:40s} {row['importance']:>12.1f}")


# ── 7. 集成模型 (简单平均) ─────────────────────────────
print("\n" + "=" * 60)
print("  模型 3: LightGBM + XGBoost 集成 (等权平均)")
print("=" * 60)

ens_val_prob  = 0.5 * lgb_val_prob  + 0.5 * xgb_val_prob
ens_test_prob = 0.5 * lgb_test_prob + 0.5 * xgb_test_prob

ens_val_res  = evaluate(y_val,  ens_val_prob,  "Ensemble-Validation")
ens_test_res = evaluate(y_test, ens_test_prob, "Ensemble-Test")


# ── 8. 汇总 ──────────────────────────────────────────
print("\n" + "=" * 60)
print("  结果汇总")
print("=" * 60)

summary = pd.DataFrame({
    "Model": ["LightGBM", "XGBoost", "Ensemble"],
    "Val_AUC":  [lgb_val_res["auc"],  xgb_val_res["auc"],  ens_val_res["auc"]],
    "Val_F1":   [lgb_val_res["f1"],   xgb_val_res["f1"],   ens_val_res["f1"]],
    "Val_Top10%": [lgb_val_res["top10_capture"], xgb_val_res["top10_capture"], ens_val_res["top10_capture"]],
    "Test_AUC": [lgb_test_res["auc"], xgb_test_res["auc"], ens_test_res["auc"]],
    "Test_F1":  [lgb_test_res["f1"],  xgb_test_res["f1"],  ens_test_res["f1"]],
    "Test_Top10%": [lgb_test_res["top10_capture"], xgb_test_res["top10_capture"], ens_test_res["top10_capture"]],
})
print(summary.to_string(index=False))

# 保存结果
summary.to_csv(OUTPUT_DIR / "baseline_results.csv", index=False, encoding="utf-8-sig")

# 保存预测结果
pred_df = test[["company_code", "is_risky"]].copy()
pred_df["lgb_prob"]  = lgb_test_prob
pred_df["xgb_prob"]  = xgb_test_prob
pred_df["ens_prob"]  = ens_test_prob
pred_df["lgb_rank"]  = pred_df["lgb_prob"].rank(ascending=False).astype(int)
pred_df["xgb_rank"]  = pred_df["xgb_prob"].rank(ascending=False).astype(int)
pred_df["ens_rank"]  = pred_df["ens_prob"].rank(ascending=False).astype(int)
pred_df.sort_values("ens_prob", ascending=False, inplace=True)
pred_df.to_csv(OUTPUT_DIR / "test_predictions.csv", index=False, encoding="utf-8-sig")

# 保存特征重要性
lgb_imp.to_csv(OUTPUT_DIR / "lgb_feature_importance.csv", index=False, encoding="utf-8-sig")

print(f"\n结果已保存到: {OUTPUT_DIR}")
print("  baseline_results.csv    - 模型评估汇总")
print("  test_predictions.csv    - 测试集预测结果")
print("  lgb_feature_importance.csv - LightGBM 特征重要性")
print("\n完成!")
