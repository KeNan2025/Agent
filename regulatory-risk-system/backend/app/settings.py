"""
Application settings (pydantic-settings) — replaces hardcoded `app/config.py`.

Groups:
- DatabaseConfig: PostgreSQL / SQLite URL
- LLMConfig: mock vs real, API key, base URL, model aliases
- SecurityConfig: JWT secret, ws_ticket TTL, bcrypt rounds
- ObservabilityConfig: log level, JSON vs pretty, access log on/off
- FeatureFlags: ENABLE_RUNTIME_EXTENSIONS, ENABLE_WS, ENABLE_RATE_LIMIT
"""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Literal, Optional

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)


class DatabaseConfig(BaseSettings):
    url: str = Field(
        default=f"sqlite+aiosqlite:///{DATA_DIR / 'regulatory_risk.db'}",
        description="SQLAlchemy URL — postgres+asyncpg recommended in prod",
    )
    pool_size: int = 20
    max_overflow: int = 40
    pool_recycle: int = 3600
    pool_pre_ping: bool = True


class LLMConfig(BaseSettings):
    mode: Literal["mock", "real"] = "mock"
    api_key: str = ""
    base_url: str = ""  # default real mode targets LiteLLM Gateway
    default_model: str = "qwen-plus"
    max_iterations: int = 60
    structured_retry_limit: int = 3
    tool_output_summary_threshold: int = 8000  # tokens

    # LiteLLM Gateway (Phase 5a)
    litellm_base_url: str = "http://litellm:4000/v1"


class SecurityConfig(BaseSettings):
    secret_key: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_access_ttl_min: int = 60 * 24
    ws_ticket_ttl_sec: int = 30
    # argon2 tunables (used by app.auth._hasher if you ever swap to a
    # non-default profile). Defaults match argon2-cffi's interactive preset.
    argon2_time_cost: int = 3
    argon2_memory_cost: int = 65536
    argon2_parallelism: int = 4
    # Deprecated alias kept to avoid breaking older `.env` files; not used.
    bcrypt_rounds: int = 12


class ObservabilityConfig(BaseSettings):
    log_level: str = "INFO"
    json_logs: bool = False  # False in dev = colored console
    enable_access_log: bool = True
    enable_request_id_header: bool = True


class FeatureFlags(BaseSettings):
    enable_runtime_extensions: bool = True  # skill upload, news plugins
    enable_websocket: bool = True
    enable_rate_limit: bool = False
    enable_mock_data_fallback: bool = True  # if DataLoader returns nothing
    enable_memo_flux: bool = True


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        env_nested_delimiter="__",
        extra="ignore",
        case_sensitive=False,
    )

    # Global
    app_name: str = "上市公司扫雷预警系统"
    app_version: str = "2.0.0"
    api_v1_str: str = "/api/v1"
    mcp_v1_str: str = "/mcp/v1"

    # CORS
    cors_allow_origins: list[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]

    # Async task runner
    async_task_max_concurrent: int = 8
    async_task_zombie_timeout_min: int = 120

    # Data
    data_dir: Path = DATA_DIR
    competition_data_dir: Path = DATA_DIR / "competition"
    skill_uploads_dir: Path = DATA_DIR / "skill_uploads"
    data_mode: Literal["mock", "local"] = "local"

    # Sub-configs
    db: DatabaseConfig = Field(default_factory=DatabaseConfig)
    llm: LLMConfig = Field(default_factory=LLMConfig)
    security: SecurityConfig = Field(default_factory=SecurityConfig)
    obs: ObservabilityConfig = Field(default_factory=ObservabilityConfig)
    features: FeatureFlags = Field(default_factory=FeatureFlags)

    # Memory service
    memory_service_base_url: str = "http://memoflux:8020"
    memory_service_timeout_sec: float = 10.0


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


# Convenience: allow `from app.settings import settings`
settings = get_settings()
