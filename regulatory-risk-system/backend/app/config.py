import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
DB_PATH = DATA_DIR / "regulatory_risk.db"
DATABASE_URL = f"sqlite+aiosqlite:///{DB_PATH}"

DATA_DIR.mkdir(parents=True, exist_ok=True)

MOCK_COMPANY_COUNT = 200
MOCK_INQUIRY_RATE = 0.08
PREDICTION_WINDOWS = [30, 60, 90]

LLM_MODE = os.getenv("LLM_MODE", "mock")
LLM_API_KEY = os.getenv("LLM_API_KEY", "")
LLM_BASE_URL = os.getenv("LLM_BASE_URL", "")
