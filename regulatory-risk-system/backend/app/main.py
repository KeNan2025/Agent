"""FastAPI entrypoint."""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router as scan_router
from app.api.mcp_routes import router as mcp_router
from app.api.ml_routes import router as ml_router
from app.api.eval_routes import router as eval_router
from app.api.graph_routes import router as graph_router
from app.api.history_routes import router as history_router
# Import skills package — registers all skills with the global registry
import app.skills  # noqa: F401


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Init persistent database tables
    from app.database import init_db
    await init_db()
    # Lazy-warm the predictor (train if missing)
    try:
        from app.ml.training import get_or_train
        get_or_train()
    except Exception as exc:  # don't crash startup if optional deps missing
        print(f"[startup] predictor warm-up skipped: {exc}")
    yield


app = FastAPI(
    title="上市公司扫雷预警系统",
    description=(
        "基于 Agentic AI 的上市公司监管问询概率预测与扫雷预警 API。\n\n"
        "包含自研 Agent 编排框架、MCP Skill 协议、CatBoost+LightGBM+TabPFN 异质集成、"
        "知识图谱风险传导、RAG 检索与 LLM-as-Judge 评估体系。"
    ),
    version="2.0.0",
    lifespan=lifespan,
)

_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(scan_router)
app.include_router(mcp_router)
app.include_router(ml_router)
app.include_router(eval_router)
app.include_router(graph_router)
app.include_router(history_router)


@app.get("/")
async def root():
    return {
        "name": "上市公司扫雷预警系统",
        "version": "2.0.0",
        "status": "running",
        "endpoints": {
            "scan_single": "/api/v1/scan/single",
            "scan_batch": "/api/v1/scan/batch",
            "ranking": "/api/v1/ranking",
            "report": "/api/v1/report/{company_code}",
            "trace": "/api/v1/trace/{company_code}",
            "companies": "/api/v1/companies",
            "industries": "/api/v1/industries",
            "graph": "/api/v1/graph/{company_code}",
            "mcp_tools_list": "/mcp/v1/tools/list",
            "mcp_tools_call": "/mcp/v1/tools/call",
            "ml_train": "/api/v1/ml/train",
            "ml_metrics": "/api/v1/ml/metrics",
            "eval_judge": "/api/v1/eval/judge",
            "eval_ablation": "/api/v1/eval/ablation",
            "eval_baseline": "/api/v1/eval/baseline",
            "history": "/api/v1/history/scans",
            "docs": "/docs",
        },
    }


@app.get("/healthz")
async def healthz():
    return {"ok": True}
