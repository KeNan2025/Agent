"""
Heterogeneous stacking predictor (CatBoost + LightGBM + TabPFN-2.5 + LR meta).

Production-grade: each base model is optional. If the heavy library is not
installed, we transparently fall back to sklearn's GradientBoostingClassifier,
so the pipeline never breaks the demo path.

Train via `train_predictor(X, y)` and persist with `model.save(path)`.
"""
from __future__ import annotations

import hashlib
import json
import pickle
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional

import numpy as np

try:
    from sklearn.ensemble import GradientBoostingClassifier
    from sklearn.linear_model import LogisticRegression
    from sklearn.metrics import (
        average_precision_score, f1_score, roc_auc_score, precision_recall_curve,
    )
    from sklearn.model_selection import StratifiedKFold
    SKLEARN_OK = True
except ImportError:  # pragma: no cover
    SKLEARN_OK = False


# ─────────────────────────── Base wrapper ───────────────────────────


class BaseModel(ABC):
    """Uniform base-model interface used by the ensemble."""
    name: str = "base"

    @abstractmethod
    def fit(self, X: np.ndarray, y: np.ndarray) -> "BaseModel": ...

    @abstractmethod
    def predict_proba(self, X: np.ndarray) -> np.ndarray: ...

    def save(self, path: Path) -> None:
        with path.open("wb") as f:
            pickle.dump(self, f)

    @classmethod
    def load(cls, path: Path) -> "BaseModel":
        with path.open("rb") as f:
            return pickle.load(f)


class SklearnFallbackModel(BaseModel):
    """sklearn GradientBoostingClassifier — used as the safe fallback."""
    name = "sklearn_gbdt"

    def __init__(self, **params: Any):
        if not SKLEARN_OK:
            raise RuntimeError("scikit-learn is required as the fallback model")
        params.setdefault("n_estimators", 200)
        params.setdefault("max_depth", 4)
        params.setdefault("learning_rate", 0.05)
        params.setdefault("random_state", 42)
        self.model = GradientBoostingClassifier(**params)
        self.fitted = False

    def fit(self, X: np.ndarray, y: np.ndarray) -> "SklearnFallbackModel":
        self.model.fit(X, y)
        self.fitted = True
        return self

    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        if not self.fitted:
            raise RuntimeError("model not fitted")
        return self.model.predict_proba(X)[:, 1]


class CatBoostModel(BaseModel):
    """CatBoost wrapper — falls back to sklearn GBDT if catboost not installed."""
    name = "catboost"

    def __init__(self, cat_features: Optional[list[int]] = None, **params: Any):
        try:
            from catboost import CatBoostClassifier  # type: ignore
            params.setdefault("iterations", 500)
            params.setdefault("depth", 6)
            params.setdefault("learning_rate", 0.05)
            params.setdefault("loss_function", "Logloss")
            params.setdefault("verbose", False)
            params.setdefault("random_seed", 42)
            self.model: Any = CatBoostClassifier(**params)
            self.cat_features = cat_features
            self._backend = "catboost"
        except ImportError:
            self.model = SklearnFallbackModel()
            self._backend = "sklearn"
        self.fitted = False

    def fit(self, X: np.ndarray, y: np.ndarray) -> "CatBoostModel":
        if self._backend == "catboost":
            self.model.fit(X, y, cat_features=self.cat_features)
        else:
            self.model.fit(X, y)
        self.fitted = True
        return self

    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        if not self.fitted:
            raise RuntimeError("model not fitted")
        if self._backend == "catboost":
            return self.model.predict_proba(X)[:, 1]
        return self.model.predict_proba(X)


class LightGBMModel(BaseModel):
    """LightGBM wrapper — falls back to sklearn GBDT if lightgbm not installed."""
    name = "lightgbm"

    def __init__(self, **params: Any):
        try:
            import lightgbm as lgb  # type: ignore
            params.setdefault("n_estimators", 500)
            params.setdefault("max_depth", -1)
            params.setdefault("num_leaves", 63)
            params.setdefault("learning_rate", 0.05)
            params.setdefault("class_weight", "balanced")
            params.setdefault("random_state", 42)
            self.model: Any = lgb.LGBMClassifier(**params)
            self._backend = "lightgbm"
        except ImportError:
            self.model = SklearnFallbackModel()
            self._backend = "sklearn"
        self.fitted = False

    def fit(self, X: np.ndarray, y: np.ndarray) -> "LightGBMModel":
        self.model.fit(X, y)
        self.fitted = True
        return self

    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        if not self.fitted:
            raise RuntimeError("model not fitted")
        if self._backend == "lightgbm":
            return self.model.predict_proba(X)[:, 1]
        return self.model.predict_proba(X)


class TabPFNModel(BaseModel):
    """TabPFN-2.5 wrapper — falls back to sklearn GBDT if tabpfn not installed.

    TabPFN works best on small/medium tabular data (≤10k–100k rows). For larger
    datasets, we subsample for training to respect the model's design point.
    """
    name = "tabpfn"

    def __init__(self, device: str = "cpu", max_train_samples: int = 10000):
        try:
            from tabpfn import TabPFNClassifier  # type: ignore
            self.model: Any = TabPFNClassifier(device=device)
            self._backend = "tabpfn"
        except ImportError:
            self.model = SklearnFallbackModel()
            self._backend = "sklearn"
        self.max_train_samples = max_train_samples
        self.fitted = False

    def fit(self, X: np.ndarray, y: np.ndarray) -> "TabPFNModel":
        if self._backend == "tabpfn" and len(X) > self.max_train_samples:
            rng = np.random.default_rng(42)
            idx = rng.choice(len(X), self.max_train_samples, replace=False)
            X, y = X[idx], y[idx]
        self.model.fit(X, y)
        self.fitted = True
        return self

    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        if not self.fitted:
            raise RuntimeError("model not fitted")
        if self._backend == "tabpfn":
            return self.model.predict_proba(X)[:, 1]
        return self.model.predict_proba(X)


# ─────────────────────────── Ensemble ───────────────────────────


@dataclass
class EnsembleMetrics:
    auc_roc: float = 0.0
    auc_pr: float = 0.0
    f1: float = 0.0
    threshold: float = 0.5
    per_model_auc: dict[str, float] = field(default_factory=dict)


class PredictorEnsemble:
    """
    Heterogeneous stacking ensemble:
      Level-0: CatBoost, LightGBM, TabPFN-2.5
      Level-1: Logistic Regression meta-learner

    Meta-features = concatenation of out-of-fold predictions from each base model.
    """

    def __init__(
        self,
        use_catboost: bool = True,
        use_lightgbm: bool = True,
        use_tabpfn: bool = True,
        cv_folds: int = 5,
    ):
        if not SKLEARN_OK:
            raise RuntimeError("scikit-learn is required")
        self.use_catboost = use_catboost
        self.use_lightgbm = use_lightgbm
        self.use_tabpfn = use_tabpfn
        self.cv_folds = cv_folds
        self.base_models: list[BaseModel] = []
        self.meta: LogisticRegression | None = None
        self.feature_names: list[str] = []
        self.metrics = EnsembleMetrics()

    def _build_base(self) -> list[BaseModel]:
        models: list[BaseModel] = []
        if self.use_catboost:
            models.append(CatBoostModel())
        if self.use_lightgbm:
            models.append(LightGBMModel())
        if self.use_tabpfn:
            models.append(TabPFNModel())
        if not models:
            models = [SklearnFallbackModel()]
        return models

    def fit(
        self, X: np.ndarray, y: np.ndarray, feature_names: list[str] | None = None,
    ) -> "PredictorEnsemble":
        n = len(X)
        if feature_names:
            self.feature_names = feature_names
        else:
            self.feature_names = [f"f{i}" for i in range(X.shape[1])]

        # Generate out-of-fold predictions for the meta-learner
        proto_models = self._build_base()
        n_models = len(proto_models)
        oof = np.zeros((n, n_models))
        skf = StratifiedKFold(
            n_splits=min(self.cv_folds, max(2, int(y.sum())) ),
            shuffle=True, random_state=42,
        ) if y.sum() >= 2 else None

        if skf is None:
            # Too few positives — fall back to single train without CV
            self.base_models = [m.fit(X, y) for m in proto_models]
            for j, m in enumerate(self.base_models):
                oof[:, j] = m.predict_proba(X)
        else:
            for j in range(n_models):
                preds = np.zeros(n)
                for fold_idx, (tr, va) in enumerate(skf.split(X, y)):
                    m = self._build_base()[j]
                    m.fit(X[tr], y[tr])
                    preds[va] = m.predict_proba(X[va])
                oof[:, j] = preds
            # Refit base models on the full training set
            self.base_models = [m.fit(X, y) for m in proto_models]

        # Meta-learner
        self.meta = LogisticRegression(C=1.0, max_iter=500)
        self.meta.fit(oof, y)

        # Score on OOF
        stacked = self.meta.predict_proba(oof)[:, 1]
        self.metrics.auc_roc = float(roc_auc_score(y, stacked)) if len(np.unique(y)) > 1 else 0.5
        self.metrics.auc_pr = float(average_precision_score(y, stacked)) if len(np.unique(y)) > 1 else float(y.mean())
        # Threshold that maximises F1
        prec, rec, thr = precision_recall_curve(y, stacked) if len(np.unique(y)) > 1 else ([1.0],[0.5],[0.5])
        if len(thr) > 0:
            f1s = [2 * p * r / max(1e-9, p + r) for p, r in zip(prec[:-1], rec[:-1])]
            if f1s:
                best = int(np.argmax(f1s))
                self.metrics.f1 = float(f1s[best])
                self.metrics.threshold = float(thr[best])
        for j, m in enumerate(self.base_models):
            try:
                self.metrics.per_model_auc[m.name] = float(roc_auc_score(y, oof[:, j])) if len(np.unique(y)) > 1 else 0.5
            except Exception:
                self.metrics.per_model_auc[m.name] = 0.0
        return self

    def predict_proba(self, X: np.ndarray) -> dict[str, np.ndarray]:
        if self.meta is None:
            raise RuntimeError("Ensemble not fitted")
        cols = [m.predict_proba(X) for m in self.base_models]
        meta_in = np.stack(cols, axis=1)
        stacked = self.meta.predict_proba(meta_in)[:, 1]
        per_model = {m.name: cols[i] for i, m in enumerate(self.base_models)}
        per_model["stacking"] = stacked
        return per_model

    def predict_one(self, x: np.ndarray) -> dict[str, float]:
        out = self.predict_proba(x.reshape(1, -1))
        return {k: float(v[0]) for k, v in out.items()}

    def feature_importance(self) -> dict[str, float]:
        """
        Aggregate feature importance across base models (max-normalised).
        Used as a backup when SHAP is unavailable.
        """
        n_feat = len(self.feature_names)
        agg = np.zeros(n_feat)
        for m in self.base_models:
            inner = getattr(m, "model", None)
            if hasattr(inner, "feature_importances_"):
                agg = agg + np.asarray(inner.feature_importances_, dtype=float)
        if agg.sum() > 0:
            agg = agg / agg.max()
        return {self.feature_names[i]: float(agg[i]) for i in range(n_feat)}

    # ─── Persistence ───
    def save(self, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("wb") as f:
            pickle.dump({
                "base": self.base_models,
                "meta": self.meta,
                "names": self.feature_names,
                "metrics": self.metrics.__dict__,
                "cfg": {
                    "use_catboost": self.use_catboost,
                    "use_lightgbm": self.use_lightgbm,
                    "use_tabpfn": self.use_tabpfn,
                },
            }, f)

    @classmethod
    def load(cls, path: Path) -> "PredictorEnsemble":
        with path.open("rb") as f:
            payload = pickle.load(f)
        inst = cls(**payload["cfg"])
        inst.base_models = payload["base"]
        inst.meta = payload["meta"]
        inst.feature_names = payload["names"]
        m = EnsembleMetrics()
        for k, v in payload["metrics"].items():
            setattr(m, k, v)
        inst.metrics = m
        return inst


# ─────────────────────────── Training helpers ───────────────────────────


def train_predictor(
    X: np.ndarray, y: np.ndarray, feature_names: list[str],
    save_path: Path | None = None,
) -> PredictorEnsemble:
    ens = PredictorEnsemble()
    ens.fit(X, y, feature_names)
    if save_path:
        ens.save(save_path)
    return ens


def load_predictor(path: Path) -> PredictorEnsemble:
    return PredictorEnsemble.load(path)


def predict_for_company(
    model: PredictorEnsemble, feature_vector: np.ndarray
) -> dict[str, float]:
    return model.predict_one(feature_vector)
