"""
Feature engineering pipeline.
Builds the 6 feature families from `技术路线与解决方案.md` §3.2.2.
"""
from .engineer import (
    FeatureEngineer,
    build_feature_matrix,
    FEATURE_NAMES,
    FEATURE_GROUPS,
)

__all__ = ["FeatureEngineer", "build_feature_matrix", "FEATURE_NAMES", "FEATURE_GROUPS"]
