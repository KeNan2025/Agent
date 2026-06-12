"""
任务2 - 上市公司被问询概率预测 (时间窗口版本)

预测目标:
  给定公司C在报告期T的财务数据，预测未来 30/60/90 天内是否被交易所问询。

标签构造:
  对每个 (公司C, 报告期T) 样本:
    label = 1  if  存在问询事件 publish_date ∈ (T, T+N天]
    label = 0  otherwise

时间切分 (防未来信息泄漏):
  训练集: 报告期 ≤ 20230331  (2020Q1~2023Q1, 13期)
  验证集: 报告期 ∈ {20230630, 20230930}  (2期)
  测试集: 报告期 ∈ {20231231, 20240331, 20240630, 20240930}  (4期)
  最后一期 20241231 无未来数据，排除。

特征:
  只使用 ≤ 当前报告期T 的财务数据构建特征，防止泄漏。
"""

import os
import warnings
import numpy as np
import pandas as pd
from pathlib import Path
from sklearn.metrics import roc_auc_score, precision_recall_curve, average_precision_score
from sklearn.preprocessing import LabelEncoder
import lightgbm as lgb
import xgboost as xgb

warnings.filterwarnings("ignore")
np.random.seed(42)

# ── 路径 ──────────────────────────────────────────────
BASE = Path(__file__).resolve().parent.parent
FEATURE_PATH  = BASE / "Data" / "财务市场特征数据集" / "wind_features_extracted.csv"
GT_PATH       = BASE / "Data" / "标签与评测数据集" / "evaluation_ground_truth.csv"
LABEL_PATH    = BASE / "Data" / "标签与评测数据集" / "dataset_split_labels.csv"
OUTPUT_DIR    = BASE / "script" / "outputs"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

WINDOWS = [30, 60, 90]

# 报告期 → 时间切分
TRAIN_PERIODS = [20200331, 20200630, 20200930, 20201231,
                 20210331, 20210630, 20210930, 20211231,
                 20220331, 20220630, 20220930, 20221231,
                 20230331]
VAL_PERIODS   = [20230630, 20230930]
TEST_PERIODS  = [20231231, 20240331, 20240630, 20240930]

NUM_COLS = [
    "market_cap", "pe_ratio", "pb_ratio",
    "total_revenue", "net_profit", "operating_cash_flow",
    "roe", "roa", "debt_to_assets_ratio",
    "revenue_yoy_growth", "net_profit_yoy_growth",
]


# ── 1. 加载数据 ───────────────────────────────────────
def load_data():
    print("=" * 70)
    print("  任务2: 上市公司被问询概率预测 (时间窗口版本)")
    print("=" * 70)

    feat = pd.read_csv(FEATURE_PATH)
    gt   = pd.read_csv(GT_PATH)
    labs = pd.read_csv(LABEL_PATH)

    feat["report_period"] = feat["report_period"].astype(int)
    gt["publish_date"]    = pd.to_datetime(gt["publish_date"])

    print(f"\n财务特征: {len(feat)} 条, {feat['company_code'].nunique()} 家公司")
    print(f"问询事件: {len(gt)} 条, {gt['secucode'].nunique()} 家公司")
    print(f"公司标签: {len(labs)} 家")

    return feat, gt, labs


# ── 2. 构建时间窗口标签 ───────────────────────────────
def build_window_labels(feat_df, gt_df, window_days):
    """
    为每个 (公司, 报告期) 构建二分类标签:
      label=1 表示该报告期之后 window_days 天内有问询事件。
    """
    # 只使用有效的报告期 (排除最后一期 20241231)
    valid_periods = sorted(feat_df["report_period"].unique())[:-1]

    # 预处理: 按公司分组问询事件
    company_events = {}
    for code, grp in gt_df.groupby("secucode"):
        company_events[code] = grp["publish_date"].values

    rows = []
    for rp in valid_periods:
        rp_dt = pd.to_datetime(str(rp))
        rp_end = rp_dt + pd.Timedelta(days=window_days)

        # 该报告期所有公司
        companies_in_period = feat_df[feat_df["report_period"] == rp]["company_code"].unique()

        for code in companies_in_period:
            events = company_events.get(code, [])
            if len(events) > 0:
                has_inquiry = int(np.any((events > rp_dt) & (events <= rp_end)))
            else:
                has_inquiry = 0
            rows.append({"company_code": code, "report_period": rp, "label": has_inquiry})

    label_df = pd.DataFrame(rows)
    pos_rate = label_df["label"].mean()
    print(f"\n  [{window_days}天窗口] 样本={len(label_df)}, "
          f"正样本={label_df['label'].sum()}, 正样本率={pos_rate:.4f}")
    return label_df


# ── 3. 特征工程 (带历史约束) ──────────────────────────
def build_features_for_period(feat_df, report_period):
    """
    为指定报告期构建特征:
      - 当期快照: 该报告期的原始指标
      - 历史统计: 从最早期到该报告期的聚合量 (不使用未来数据)
    """
    # 只使用 ≤ 当前报告期的数据
    hist = feat_df[feat_df["report_period"] <= report_period].copy()

    results = []
    for code, grp in hist.groupby("company_code"):
        grp = grp.sort_values("report_period")
        feat = {"company_code": code, "report_period": report_period}

        # 行业
        feat["industry"] = grp["industry"].mode().iloc[0] if grp["industry"].notna().any() else "Unknown"

        # 当期快照 (取最新一期，即 report_period 本身)
        current = grp[grp["report_period"] == report_period]
        if len(current) == 0:
            continue
        current = current.iloc[0]
        for col in NUM_COLS:
            feat[f"cur_{col}"] = current[col]

        # 历史统计 (从最早到当前报告期)
        for col in NUM_COLS:
            series = grp[col].dropna()
            n = len(series)
            if n >= 2:
                feat[f"mean_{col}"]  = series.mean()
                feat[f"std_{col}"]   = series.std()
                feat[f"min_{col}"]   = series.min()
                feat[f"max_{col}"]   = series.max()
                # 趋势
                x = np.arange(n)
                slope = np.polyfit(x, series.values, 1)[0]
                feat[f"trend_{col}"] = slope
                # 最近环比变化
                feat[f"qoq_{col}"]   = (series.iloc[-1] - series.iloc[-2]) / (abs(series.iloc[-2]) + 1e-8)
            elif n == 1:
                feat[f"mean_{col}"]  = series.iloc[0]
                feat[f"std_{col}"]   = 0
                feat[f"min_{col}"]   = series.iloc[0]
                feat[f"max_{col}"]   = series.iloc[0]
                feat[f"trend_{col}"] = 0
                feat[f"qoq_{col}"]   = 0
            else:
                for s in ["mean_", "std_", "min_", "max_", "trend_", "qoq_"]:
                    feat[f"{s}{col}"] = np.nan

        # 衍生特征
        feat["num_quarters"] = n

        net_prof = grp["net_profit"].dropna()
        if len(net_prof) > 0:
            feat["loss_ratio"] = (net_prof < 0).mean()
        else:
            feat["loss_ratio"] = np.nan

        debt = grp["debt_to_assets_ratio"].dropna()
        if len(debt) > 0:
            feat["high_debt_ratio"] = (debt > 70).mean()
        else:
            feat["high_debt_ratio"] = np.nan

        roe_s = grp["roe"].dropna()
        if len(roe_s) >= 2:
            feat["roe_decline_count"] = int((roe_s.diff().dropna() < 0).sum())
        else:
            feat["roe_decline_count"] = 0

        # 连续亏损季度数 (从最近往回数)
        net_prof_sorted = grp["net_profit"].dropna()
        streak = 0
        for v in net_prof_sorted.iloc[::-1]:
            if v < 0:
                streak += 1
            else:
                break
        feat["consec_loss"] = streak

        results.append(feat)

    return pd.DataFrame(results)


def build_all_features(feat_df, all_periods):
    """为所有报告期构建特征"""
    print("\n── 特征工程 ──")
    all_feats = []
    for i, rp in enumerate(all_periods):
        print(f"  处理报告期 {rp} ({i+1}/{len(all_periods)})...")
        fdf = build_features_for_period(feat_df, rp)
        all_feats.append(fdf)
    result = pd.concat(all_feats, ignore_index=True)
    print(f"  完成: {len(result)} 条样本, {result.shape[1]-2} 个特征")
    return result


# ── 4. 评估函数 ───────────────────────────────────────
def top_k_capture(y_true, y_prob, k_pct=10):
    """Top-K% 高风险公司中覆盖的真实正样本比例"""
    n = len(y_true)
    k = max(1, int(n * k_pct / 100))
    top_idx = np.argsort(y_prob)[-k:]
    return y_true[top_idx].sum() / max(y_true.sum(), 1)


def precision_at_k(y_true, y_prob, k):
    """Top-K 高风险公司的精确率"""
    k = min(k, len(y_true))
    top_idx = np.argsort(y_prob)[-k:]
    return y_true[top_idx].sum() / k


def find_best_f1(y_true, y_prob):
    precisions, recalls, thresholds = precision_recall_curve(y_true, y_prob)
    f1s = 2 * precisions * recalls / (precisions + recalls + 1e-10)
    best_idx = np.argmax(f1s)
    thr = thresholds[best_idx] if best_idx < len(thresholds) else 0.5
    return f1s[best_idx], thr


def evaluate(y_true, y_prob, label=""):
    """综合评估"""
    auc = roc_auc_score(y_true, y_prob)
    ap  = average_precision_score(y_true, y_prob)  # PR-AUC, 更适合不平衡数据
    best_f1, best_thr = find_best_f1(y_true, y_prob)
    top10  = top_k_capture(y_true, y_prob, 10)
    top20  = top_k_capture(y_true, y_prob, 20)
    p_at_50  = precision_at_k(y_true, y_prob, 50)
    p_at_100 = precision_at_k(y_true, y_prob, 100)

    y_pred = (y_prob >= best_thr).astype(int)
    from sklearn.metrics import precision_score, recall_score
    prec = precision_score(y_true, y_pred, zero_division=0)
    rec  = recall_score(y_true, y_pred, zero_division=0)

    print(f"\n  [{label}]")
    print(f"    AUC={auc:.4f} | PR-AUC={ap:.4f} | F1={best_f1:.4f} (thr={best_thr:.4f})")
    print(f"    Precision={prec:.4f} | Recall={rec:.4f}")
    print(f"    Top10%Capture={top10:.4f} | Top20%Capture={top20:.4f}")
    print(f"    P@50={p_at_50:.4f} | P@100={p_at_100:.4f}")
    print(f"    正样本数={int(y_true.sum())} / {len(y_true)}")

    return {
        "auc": round(auc, 4),
        "pr_auc": round(ap, 4),
        "f1": round(best_f1, 4),
        "best_threshold": round(best_thr, 4),
        "precision": round(prec, 4),
        "recall": round(rec, 4),
        "top10_capture": round(top10, 4),
        "top20_capture": round(top20, 4),
        "precision_at_50": round(p_at_50, 4),
        "precision_at_100": round(p_at_100, 4),
    }


# ── 5. 模型训练与评估 ────────────────────────────────
def train_and_evaluate(X_train, y_train, X_val, y_val, X_test, y_test, feat_cols, window):
    """训练 LightGBM + XGBoost，返回预测概率和评估结果"""
    print(f"\n{'='*70}")
    print(f"  窗口 = {window} 天 | 正样本率: train={y_train.mean():.4f} val={y_val.mean():.4f} test={y_test.mean():.4f}")
    print(f"{'='*70}")

    # ── LightGBM ──
    print(f"\n  --- LightGBM [{window}天] ---")
    spw = (y_train == 0).sum() / max((y_train == 1).sum(), 1)
    lgb_params = {
        "objective": "binary",
        "metric": "auc",
        "learning_rate": 0.05,
        "num_leaves": 63,
        "max_depth": 7,
        "min_child_samples": 50,
        "subsample": 0.8,
        "colsample_bytree": 0.8,
        "reg_alpha": 0.1,
        "reg_lambda": 1.0,
        "scale_pos_weight": spw,
        "verbose": -1,
        "random_state": 42,
    }

    lgb_train_ds = lgb.Dataset(X_train, y_train, feature_name=feat_cols)
    lgb_val_ds   = lgb.Dataset(X_val, y_val, feature_name=feat_cols, reference=lgb_train_ds)

    lgb_model = lgb.train(
        lgb_params, lgb_train_ds,
        num_boost_round=2000,
        valid_sets=[lgb_train_ds, lgb_val_ds],
        valid_names=["train", "valid"],
        callbacks=[lgb.early_stopping(100), lgb.log_evaluation(200)],
    )

    lgb_val_prob  = lgb_model.predict(X_val)
    lgb_test_prob = lgb_model.predict(X_test)

    lgb_val_res  = evaluate(y_val,  lgb_val_prob,  f"LightGBM Val [{window}天]")
    lgb_test_res = evaluate(y_test, lgb_test_prob, f"LightGBM Test [{window}天]")

    # 特征重要性
    lgb_imp = pd.DataFrame({
        "feature": feat_cols,
        "importance": lgb_model.feature_importance(importance_type="gain"),
    }).sort_values("importance", ascending=False)

    # ── XGBoost ──
    print(f"\n  --- XGBoost [{window}天] ---")
    xgb_params = {
        "objective": "binary:logistic",
        "eval_metric": "auc",
        "learning_rate": 0.05,
        "max_depth": 7,
        "min_child_weight": 50,
        "subsample": 0.8,
        "colsample_bytree": 0.8,
        "reg_alpha": 0.1,
        "reg_lambda": 1.0,
        "scale_pos_weight": spw,
        "verbosity": 0,
        "random_state": 42,
    }

    dtrain = xgb.DMatrix(X_train, y_train, feature_names=feat_cols)
    dval   = xgb.DMatrix(X_val,   y_val,   feature_names=feat_cols)
    dtest  = xgb.DMatrix(X_test,  y_test,  feature_names=feat_cols)

    xgb_model = xgb.train(
        xgb_params, dtrain,
        num_boost_round=2000,
        evals=[(dtrain, "train"), (dval, "valid")],
        early_stopping_rounds=100,
        verbose_eval=200,
    )

    xgb_val_prob  = xgb_model.predict(dval)
    xgb_test_prob = xgb_model.predict(dtest)

    xgb_val_res  = evaluate(y_val,  xgb_val_prob,  f"XGBoost Val [{window}天]")
    xgb_test_res = evaluate(y_test, xgb_test_prob, f"XGBoost Test [{window}天]")

    # ── 集成 ──
    print(f"\n  --- Ensemble [{window}天] ---")
    ens_val_prob  = 0.5 * lgb_val_prob  + 0.5 * xgb_val_prob
    ens_test_prob = 0.5 * lgb_test_prob + 0.5 * xgb_test_prob
    ens_val_res   = evaluate(y_val,  ens_val_prob,  f"Ensemble Val [{window}天]")
    ens_test_res  = evaluate(y_test, ens_test_prob, f"Ensemble Test [{window}天]")

    return {
        "lgb_test_prob": lgb_test_prob,
        "xgb_test_prob": xgb_test_prob,
        "ens_test_prob": ens_test_prob,
        "lgb_val_res": lgb_val_res,
        "lgb_test_res": lgb_test_res,
        "xgb_val_res": xgb_val_res,
        "xgb_test_res": xgb_test_res,
        "ens_val_res": ens_val_res,
        "ens_test_res": ens_test_res,
        "lgb_imp": lgb_imp,
    }


# ── 6. 主流程 ─────────────────────────────────────────
def main():
    # 加载数据
    feat_df, gt_df, labs_df = load_data()

    # 所有有效报告期 (排除最后一期)
    all_periods = sorted(feat_df["report_period"].unique())[:-1]

    # 构建特征 (所有报告期一次性构建)
    feat_all = build_all_features(feat_df, all_periods)

    # 特征列
    feat_cols = [c for c in feat_all.columns if c not in ["company_code", "report_period", "industry"]]
    # 行业编码
    le = LabelEncoder()
    feat_all["industry_enc"] = le.fit_transform(feat_all["industry"].fillna("Unknown"))
    feat_cols_with_enc = feat_cols + ["industry_enc"]

    # 时间切分
    def get_split_mask(rp_series, periods):
        return rp_series.isin(periods)

    train_mask = get_split_mask(feat_all["report_period"], TRAIN_PERIODS)
    val_mask   = get_split_mask(feat_all["report_period"], VAL_PERIODS)
    test_mask  = get_split_mask(feat_all["report_period"], TEST_PERIODS)

    print(f"\n── 时间切分 ──")
    print(f"  Train: {train_mask.sum()} 样本 (报告期 ≤ 2023Q1)")
    print(f"  Val:   {val_mask.sum()} 样本 (报告期 ∈ 2023Q2~Q3)")
    print(f"  Test:  {test_mask.sum()} 样本 (报告期 ∈ 2023Q4~2024Q3)")

    # 对每个窗口训练和评估
    all_results = {}
    summary_rows = []

    for window in WINDOWS:
        # 构建时间窗口标签
        label_df = build_window_labels(feat_df, gt_df, window)

        # 合并特征和标签
        merged = feat_all.merge(label_df, on=["company_code", "report_period"], how="inner")

        train = merged[train_mask]
        val   = merged[val_mask]
        test  = merged[test_mask]

        X_train = train[feat_cols_with_enc].values
        y_train = train["label"].values
        X_val   = val[feat_cols_with_enc].values
        y_val   = val["label"].values
        X_test  = test[feat_cols_with_enc].values
        y_test  = test["label"].values

        # 处理缺失值 (LightGBM/XGBoost 支持 NaN)
        res = train_and_evaluate(X_train, y_train, X_val, y_val, X_test, y_test,
                                 feat_cols_with_enc, window)
        all_results[window] = res

        # 汇总
        for model_name, val_res, test_res in [
            ("LightGBM", res["lgb_val_res"], res["lgb_test_res"]),
            ("XGBoost",  res["xgb_val_res"], res["xgb_test_res"]),
            ("Ensemble", res["ens_val_res"], res["ens_test_res"]),
        ]:
            summary_rows.append({
                "Window": f"{window}d",
                "Model": model_name,
                "Val_AUC":      val_res["auc"],
                "Val_PR_AUC":   val_res["pr_auc"],
                "Val_F1":       val_res["f1"],
                "Test_AUC":     test_res["auc"],
                "Test_PR_AUC":  test_res["pr_auc"],
                "Test_F1":      test_res["f1"],
                "Test_Top10%":  test_res["top10_capture"],
                "Test_Top20%":  test_res["top20_capture"],
                "Test_P@50":    test_res["precision_at_50"],
                "Test_P@100":   test_res["precision_at_100"],
            })

    # ── 汇总输出 ──────────────────────────────────────
    print("\n" + "=" * 70)
    print("  结果汇总")
    print("=" * 70)

    summary = pd.DataFrame(summary_rows)
    print(summary.to_string(index=False))

    summary.to_csv(OUTPUT_DIR / "timewindow_results.csv", index=False, encoding="utf-8-sig")

    # 保存测试集预测
    test_base = merged[test_mask][["company_code", "report_period"]].copy()
    for window in WINDOWS:
        label_df = build_window_labels(feat_df, gt_df, window)
        merged_w = feat_all.merge(label_df, on=["company_code", "report_period"], how="inner")
        test_w = merged_w[test_mask]
        test_base = test_base.merge(
            test_w[["company_code", "report_period", "label"]],
            on=["company_code", "report_period"], how="left",
            suffixes=("", f"_{window}d")
        )
        test_base[f"label_{window}d"] = test_w["label"].values
        test_base[f"lgb_prob_{window}d"]  = all_results[window]["lgb_test_prob"]
        test_base[f"xgb_prob_{window}d"]  = all_results[window]["xgb_test_prob"]
        test_base[f"ens_prob_{window}d"]  = all_results[window]["ens_test_prob"]

    test_base.sort_values(["report_period", "ens_prob_90d"], ascending=[True, False], inplace=True)
    test_base.to_csv(OUTPUT_DIR / "timewindow_test_predictions.csv", index=False, encoding="utf-8-sig")

    # 保存特征重要性 (取 90 天窗口的)
    all_results[90]["lgb_imp"].to_csv(
        OUTPUT_DIR / "timewindow_lgb_feature_importance.csv", index=False, encoding="utf-8-sig"
    )

    print(f"\n结果已保存到: {OUTPUT_DIR}")
    print("  timewindow_results.csv              - 各窗口各模型评估汇总")
    print("  timewindow_test_predictions.csv      - 测试集预测概率")
    print("  timewindow_lgb_feature_importance.csv - LightGBM 特征重要性 (90天)")

    # 打印 Top 特征
    print("\n── LightGBM 特征重要性 Top-15 (90天窗口) ──")
    imp = all_results[90]["lgb_imp"]
    for _, row in imp.head(15).iterrows():
        print(f"  {row['feature']:40s} {row['importance']:>12.1f}")

    print("\n完成!")


if __name__ == "__main__":
    main()
