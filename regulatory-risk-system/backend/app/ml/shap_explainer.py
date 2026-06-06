"""
Real SHAP explainer.

Wraps `shap.TreeExplainer` for tree models (CatBoost, LightGBM, XGBoost)
and `shap.KernelExplainer` as a generic fallback. Returns a list of
`ShapFeature` dicts matching the schema consumed by Skill `shap_explain`
and the API.
"""
from __future__ import annotations

from typing import Any, Iterable

import numpy as np

from app.core.logging import get_logger

log = get_logger(__name__)


def _get_shap():
    try:
        import shap  # type: ignore
        return shap
    except Exception as exc:  # noqa: BLE001
        log.warning("shap.import_failed", error=str(exc))
        return None


def explain_one(
    model: Any,
    x_row: np.ndarray,
    feature_names: list[str] | None = None,
    *,
    top_k: int = 20,
) -> list[dict[str, Any]]:
    """Return Top-K SHAP features for a single row.

    `model` should be a fitted model with `.predict_proba` or `.predict`.
    `x_row` is shape (1, n_features) or (n_features,).
    """
    shap = _get_shap()
    if shap is None or model is None or x_row is None:
        return _fallback_explain(x_row, feature_names, top_k=top_k)
    x = np.atleast_2d(x_row)
    if feature_names is None:
        feature_names = [f"f_{i}" for i in range(x.shape[1])]

    try:
        # Prefer TreeExplainer for tree models
        if _looks_like_tree_model(model):
            explainer = shap.TreeExplainer(model)
            sv = explainer.shap_values(x)
            if isinstance(sv, list):  # multiclass
                sv = sv[1] if len(sv) > 1 else sv[0]
            sv = np.asarray(sv).reshape(-1)
            base = float(np.array(explainer.expected_value).flat[0]) \
                if hasattr(explainer, "expected_value") else 0.0
        else:
            explainer = shap.KernelExplainer(_predict_fn(model), shap.kmeans(x, min(10, x.shape[0])))
            sv = explainer.shap_values(x, nsamples=50)
            sv = np.asarray(sv).reshape(-1)
            base = float(explainer.expected_value)
    except Exception as exc:  # noqa: BLE001
        log.warning("shap.explain_failed", error=str(exc))
        return _fallback_explain(x_row, feature_names, top_k=top_k)

    out: list[dict[str, Any]] = []
    for i, v in enumerate(sv):
        out.append({
            "feature_name": feature_names[i] if i < len(feature_names) else f"f_{i}",
            "shap_value": float(v),
            "feature_value": str(float(x[0, i])) if x.shape[0] else "",
            "description": "",
        })
    out.sort(key=lambda r: abs(r["shap_value"]), reverse=True)
    return out[:top_k]


def _looks_like_tree_model(model: Any) -> bool:
    name = type(model).__name__.lower()
    return any(k in name for k in (
        "catboost", "lightgbm", "lgbm", "xgboost", "gbm", "forest",
        "gradientboost",
    ))


def _predict_fn(model: Any):
    if hasattr(model, "predict_proba"):
        return lambda x: model.predict_proba(x)[:, 1]
    return lambda x: model.predict(x)


def _fallback_explain(
    x_row: np.ndarray, feature_names: list[str] | None, *, top_k: int
) -> list[dict[str, Any]]:
    """Crude fallback: take absolute value of the feature row itself."""
    x = np.atleast_2d(x_row)
    if x.size == 0:
        return []
    if feature_names is None:
        feature_names = [f"f_{i}" for i in range(x.shape[1])]
    out = []
    for i in range(x.shape[1]):
        out.append({
            "feature_name": feature_names[i] if i < len(feature_names) else f"f_{i}",
            "shap_value": float(x[0, i]) * 0.01,
            "feature_value": str(float(x[0, i])),
            "description": "shap unavailable; using raw feature as proxy",
        })
    out.sort(key=lambda r: abs(r["shap_value"]), reverse=True)
    return out[:top_k]
