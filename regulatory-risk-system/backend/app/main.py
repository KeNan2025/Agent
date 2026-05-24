from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import router

app = FastAPI(
    title="上市公司扫雷预警系统",
    description="基于 Agentic AI 的上市公司监管问询概率预测与扫雷预警 API",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/")
async def root():
    return {
        "name": "上市公司扫雷预警系统",
        "version": "1.0.0",
        "status": "running",
        "endpoints": {
            "ranking": "/api/v1/ranking",
            "scan_single": "/api/v1/scan/single",
            "scan_batch": "/api/v1/scan/batch",
            "report": "/api/v1/report/{company_code}",
            "trace": "/api/v1/trace/{company_code}",
            "companies": "/api/v1/companies",
            "industries": "/api/v1/industries",
            "docs": "/docs",
        },
    }
