"""FastAPI entrypoint."""
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.logging import configure_logging, get_logger
from app.core.middleware import LoggingMiddleware, RequestIDMiddleware
from app.services.startup import cleanup_zombie_scans, record_startup_event
from app.settings import settings

# Import all skills so they register with the global registry
import app.skills  # noqa: F401

# Routers
from app.api.routes import router as scan_router
from app.api.mcp_routes import router as mcp_router
from app.api.ml_routes import router as ml_router
from app.api.eval_routes import router as eval_router
from app.api.graph_routes import router as graph_router
from app.api.history_routes import router as history_router
from app.api.skill_files_routes import router as skill_files_router
from app.api.twin_routes import router as twin_router
from app.api.task_routes import router as task_router
from app.api.ws_routes import router as ws_router
from app.api.auth_routes import router as auth_router

log = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """App lifecycle: init db, run zombie cleanup, lazy-warm predictor,
    start scheduler (Phase 4)."""
    configure_logging()
    log.info("startup.begin", version=settings.app_version)

    # Init DB
    from app.database import init_db
    await init_db()

    # Cleanup zombie scans (marked running but stale)
    await cleanup_zombie_scans()

    # Lazy-warm the predictor (train if missing)
    try:
        from app.ml.training import get_or_train
        get_or_train()
    except Exception as exc:  # don't crash startup if optional deps missing
        log.warning("startup.predictor_warmup_skipped", error=str(exc))

    # Start scheduler (experience review / zombie cleanup / weekly retrain log)
    if settings.features.enable_websocket:
        try:
            from app.services.scheduler import start_scheduler
            start_scheduler()
        except Exception as exc:
            log.warning("startup.scheduler_skipped", error=str(exc))

    await record_startup_event({
        "version": settings.app_version,
        "llm_mode": settings.llm.mode,
        "data_mode": settings.data_mode,
    })

    log.info("startup.complete")
    yield
    log.info("shutdown.begin")
    try:
        from app.services.scheduler import stop_scheduler
        stop_scheduler()
    except Exception:
        pass


app = FastAPI(
    title=settings.app_name,
    description=(
        "基于 Agentic AI 的上市公司监管问询概率预测与扫雷预警 API。\n\n"
        "包含自研 Agent 编排框架（真 tool-calling）、MCP Skill 协议、"
        "CatBoost+LightGBM+TabPFN 异质集成、知识图谱风险传导、"
        "RAG 检索与 LLM-as-Judge 评估体系。"
    ),
    version=settings.app_version,
    lifespan=lifespan,
)

# ──────────────────────── Middleware ────────────────────────

# Order matters: RequestID FIRST so all subsequent logs/handlers have it
app.add_middleware(LoggingMiddleware)
app.add_middleware(RequestIDMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ──────────────────────── Routers ────────────────────────

app.include_router(scan_router)
app.include_router(mcp_router)
app.include_router(ml_router)
app.include_router(eval_router)
app.include_router(graph_router)
app.include_router(history_router)
app.include_router(skill_files_router)
app.include_router(twin_router)
app.include_router(task_router)
app.include_router(auth_router)
if settings.features.enable_websocket:
    app.include_router(ws_router)


@app.get("/")
async def root():
    return {
        "name": settings.app_name,
        "version": settings.app_version,
        "status": "running",
        "endpoints": {
            "scan_single": f"{settings.api_v1_str}/scan/single",
            "scan_batch": f"{settings.api_v1_str}/scan/batch",
            "ranking": f"{settings.api_v1_str}/ranking",
            "report": f"{settings.api_v1_str}/report/{{code}}",
            "trace": f"{settings.api_v1_str}/trace/{{code}}",
            "ml_metrics": f"{settings.api_v1_str}/ml/metrics",
            "ml_metrics_competition": f"{settings.api_v1_str}/ml/metrics/competition",
            "eval_judge": f"{settings.api_v1_str}/eval/judge",
            "eval_ablation": f"{settings.api_v1_str}/eval/ablation",
            "eval_baseline": f"{settings.api_v1_str}/eval/baseline",
            "mcp_tools": f"{settings.mcp_v1_str}/tools/list",
            "mcp_call": f"{settings.mcp_v1_str}/tools/call",
            "mcp_stats": f"{settings.mcp_v1_str}/tools/stats",
            "history": f"{settings.api_v1_str}/history/scans",
            "graph": f"{settings.api_v1_str}/graph/{{code}}",
            "twin_overview": f"{settings.api_v1_str}/twin/market-overview",
            "ml_metrics_competition": f"{settings.api_v1_str}/ml/metrics/competition",
            "ws_scan": f"/ws/scan/{{scan_id}}",
            "auth_login": f"{settings.api_v1_str}/auth/login",
            "auth_register": f"{settings.api_v1_str}/auth/register",
            "auth_ws_ticket": f"{settings.api_v1_str}/auth/ws-ticket/{{scan_id}}",
        },
    }


@app.get("/healthz")
async def healthz():
    return {
        "ok": True,
        "version": settings.app_version,
        "llm_mode": settings.llm.mode,
        "data_mode": settings.data_mode,
    }
