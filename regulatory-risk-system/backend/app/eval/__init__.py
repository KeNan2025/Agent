"""
Evaluation framework.

Covers three pillars from `技术路线与解决方案.md` §3.4.2:
- LLM-as-Judge: rate generated reports
- Ablation experiments: quantify each module's contribution
- Baseline comparison: pure-rule / GBDT-only / LLM-only / fixed-pipeline
"""
from .judge import judge_report, judge_batch
from .ablation import run_ablation
from .baseline import run_baseline_compare

__all__ = ["judge_report", "judge_batch", "run_ablation", "run_baseline_compare"]
