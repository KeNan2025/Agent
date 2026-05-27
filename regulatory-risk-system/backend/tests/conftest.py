"""Pytest shared fixtures."""
import os
import sys
from pathlib import Path

# Make the backend importable from any test invocation directory
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
# Force mock LLM mode so tests never reach the network
os.environ["LLM_MODE"] = "mock"


import pytest


@pytest.fixture(autouse=True)
def isolate_data_dirs(tmp_path, monkeypatch):
    """Redirect persistent paths to a temp directory for each test."""
    traces = tmp_path / "traces"
    ckpts = tmp_path / "checkpoints"
    models = tmp_path / "models"
    traces.mkdir(); ckpts.mkdir(); models.mkdir()
    monkeypatch.setenv("DATABASE_URL", f"sqlite+aiosqlite:///{tmp_path}/test.db")
    # Reset LLM client singleton so every test starts clean
    try:
        from app.core.llm import reset_llm_client
        reset_llm_client()
    except Exception:
        pass
    yield
