"""
Backwards-compat shim for legacy `app.config` constants.
All real settings live in `app.settings` (pydantic-settings).
"""
from app.settings import settings

BASE_DIR = settings.data_dir.parent
DATA_DIR = settings.data_dir
DB_PATH = DATA_DIR / "regulatory_risk.db"
DATABASE_URL = settings.db.url

MOCK_COMPANY_COUNT = 200
MOCK_INQUIRY_RATE = 0.15
PREDICTION_WINDOWS = [30, 60, 90]

LLM_MODE = settings.llm.mode
LLM_API_KEY = settings.llm.api_key
LLM_BASE_URL = settings.llm.base_url
