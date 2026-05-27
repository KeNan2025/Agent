"""
ML prediction pipeline.

Implements heterogeneous ensemble described in `技术路线与解决方案.md` §3.2.3:
- CatBoost (categorical-aware GBDT)
- LightGBM (high-dim sparse GBDT)
- TabPFN-2.5 (tabular foundation model, small-sample SOTA)
- Meta-learner: Logistic Regression stacking

Each base model is wrapped behind a uniform interface. If the optional
dependency is missing, the wrapper falls back to a sklearn alternative
so the system always works.
"""
from .predictor import (
    PredictorEnsemble,
    BaseModel,
    CatBoostModel,
    LightGBMModel,
    TabPFNModel,
    SklearnFallbackModel,
    train_predictor,
    load_predictor,
    predict_for_company,
)

__all__ = [
    "PredictorEnsemble",
    "BaseModel",
    "CatBoostModel",
    "LightGBMModel",
    "TabPFNModel",
    "SklearnFallbackModel",
    "train_predictor",
    "load_predictor",
    "predict_for_company",
]
