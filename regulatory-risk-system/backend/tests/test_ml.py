"""Smoke tests for feature engineering + ML ensemble."""
import numpy as np
import pytest

from app.features.engineer import FEATURE_NAMES, FeatureEngineer, build_feature_matrix
from app.ml.predictor import PredictorEnsemble, SklearnFallbackModel
from app.mock_data.generator import (
    generate_companies, generate_financial_features, generate_risk_factors,
)


def test_feature_vector_dim_is_stable():
    companies = generate_companies(5)
    fins = [generate_financial_features(c) for c in companies]
    rfs = [generate_risk_factors(c, f) for c, f in zip(companies, fins)]
    eng = FeatureEngineer()
    vec = eng.build_vector(companies[0], fins[0], rfs[0])
    assert vec.shape[0] == len(FEATURE_NAMES)
    assert vec.dtype == np.float32


def test_feature_vector_is_deterministic():
    c = generate_companies(1)[0]
    f = generate_financial_features(c)
    rf = generate_risk_factors(c, f)
    eng = FeatureEngineer()
    v1 = eng.build_vector(c, f, rf)
    v2 = eng.build_vector(c, f, rf)
    np.testing.assert_allclose(v1, v2)


def test_build_feature_matrix_shape():
    companies = generate_companies(10)
    fins = [generate_financial_features(c) for c in companies]
    rfs = [generate_risk_factors(c, f) for c, f in zip(companies, fins)]
    X, names = build_feature_matrix(companies, fins, rfs)
    assert X.shape == (10, len(FEATURE_NAMES))
    assert names == FEATURE_NAMES


def test_ensemble_fits_and_predicts():
    pytest.importorskip("sklearn")
    rng = np.random.default_rng(0)
    X = rng.normal(0, 1, size=(60, 10)).astype(np.float32)
    y = (X[:, 0] + rng.normal(0, 0.3, size=60) > 0).astype(int)
    ens = PredictorEnsemble(use_tabpfn=False)
    ens.fit(X, y, [f"f{i}" for i in range(10)])
    out = ens.predict_one(X[0])
    assert "stacking" in out
    assert 0.0 <= out["stacking"] <= 1.0
    assert 0.5 <= ens.metrics.auc_roc <= 1.0


def test_sklearn_fallback_model():
    pytest.importorskip("sklearn")
    rng = np.random.default_rng(1)
    X = rng.normal(0, 1, size=(40, 6))
    y = (X[:, 0] > 0).astype(int)
    m = SklearnFallbackModel().fit(X, y)
    p = m.predict_proba(X)
    assert p.shape == (40,)
    assert (p >= 0).all() and (p <= 1).all()
