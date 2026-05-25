"""ML training & metric inspection endpoints."""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, BackgroundTasks
from pydantic import BaseModel

from app.ml.training import MODEL_PATH, get_or_train, train_and_persist

router = APIRouter(prefix="/api/v1/ml", tags=["ml"])


class TrainRequest(BaseModel):
    n_samples: int = 200
    async_mode: bool = False


@router.post("/train")
async def train(req: TrainRequest, background: BackgroundTasks) -> dict[str, Any]:
    """Train the heterogeneous ensemble and persist it."""
    if req.async_mode:
        background.add_task(train_and_persist, req.n_samples)
        return {"status": "scheduled", "model_path": str(MODEL_PATH)}
    report = train_and_persist(req.n_samples)
    return {"status": "ok", **report}


@router.get("/metrics")
async def metrics() -> dict[str, Any]:
    """Return the persisted ensemble's metrics."""
    ens = get_or_train()
    return {
        "model_path": str(MODEL_PATH),
        "n_features": len(ens.feature_names),
        "metrics": ens.metrics.__dict__,
    }


@router.get("/feature-importance")
async def feature_importance(top_k: int = 20) -> dict[str, Any]:
    ens = get_or_train()
    fi = ens.feature_importance()
    sorted_fi = sorted(fi.items(), key=lambda x: -x[1])[:top_k]
    return {
        "top_k": top_k,
        "features": [{"name": k, "importance": v} for k, v in sorted_fi],
    }
