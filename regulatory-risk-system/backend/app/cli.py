"""
CLI tool for operators.

Provides quick access to:
- scanning a single company end-to-end
- training the predictor
- running ablation / baseline experiments
- listing registered MCP skills
"""
from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path

# Make `app` importable when this file is invoked as a script
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))


def cmd_scan(args: argparse.Namespace) -> None:
    from app.agents.orchestrator import run_scan_async
    from app.mock_data.generator import get_full_prediction
    seed = get_full_prediction(args.company_code, args.window)
    if seed is None:
        print(f"company not found: {args.company_code}")
        return
    state = asyncio.run(run_scan_async(
        company_code=args.company_code, window_days=args.window,
        financial_data=seed["financial"].model_dump(),
        risk_factors=seed["risk_factors"],
        shap_features=[s.model_dump() for s in seed["shap_features"]],
        prediction_result={
            "stacking": seed["probability"],
            "risk_level": seed["risk_level"].value,
            "catboost": seed["probability"],
            "lightgbm": seed["probability"],
            "tabpfn": seed["probability"],
        },
    ))
    print("scan_id:", state.scan_id)
    print("hypothesis:", state.risk_hypothesis)
    print("completed_steps:", state.completed_steps)
    print("trace events:", len(state.trace_events))
    print()
    print("--- report (first 800 chars) ---")
    print((state.report_markdown or "")[:800])


def cmd_train(args: argparse.Namespace) -> None:
    from app.ml.training import train_and_persist
    report = train_and_persist(args.samples)
    print(json.dumps(report, ensure_ascii=False, indent=2))


def cmd_ablation(_: argparse.Namespace) -> None:
    from app.eval.ablation import run_ablation
    print(json.dumps(run_ablation(), ensure_ascii=False, indent=2))


def cmd_baseline(_: argparse.Namespace) -> None:
    from app.eval.baseline import run_baseline_compare
    print(json.dumps(run_baseline_compare(), ensure_ascii=False, indent=2))


def cmd_judge(args: argparse.Namespace) -> None:
    from app.eval.judge import judge_report
    from app.mock_data.generator import get_full_prediction
    seed = get_full_prediction(args.company_code, args.window)
    if seed is None:
        print(f"company not found: {args.company_code}")
        return
    print(json.dumps(judge_report(seed["report_markdown"]), ensure_ascii=False, indent=2))


def cmd_skills(_: argparse.Namespace) -> None:
    import app.skills  # noqa: F401
    from app.core import get_registry
    reg = get_registry()
    for sk in reg.list_skills():
        print(f"- {sk.name:<24}  {sk.description}")


def main() -> None:
    parser = argparse.ArgumentParser(prog="rrs", description="Regulatory Risk System CLI")
    sub = parser.add_subparsers(dest="cmd", required=True)

    s = sub.add_parser("scan", help="Scan a single company")
    s.add_argument("company_code")
    s.add_argument("--window", type=int, default=60)
    s.set_defaults(func=cmd_scan)

    t = sub.add_parser("train", help="Train the ensemble predictor")
    t.add_argument("--samples", type=int, default=200)
    t.set_defaults(func=cmd_train)

    sub.add_parser("ablation", help="Run ablation experiments").set_defaults(func=cmd_ablation)
    sub.add_parser("baseline", help="Run baseline comparison").set_defaults(func=cmd_baseline)

    j = sub.add_parser("judge", help="LLM-as-Judge a company report")
    j.add_argument("company_code")
    j.add_argument("--window", type=int, default=60)
    j.set_defaults(func=cmd_judge)

    sub.add_parser("skills", help="List registered MCP skills").set_defaults(func=cmd_skills)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
