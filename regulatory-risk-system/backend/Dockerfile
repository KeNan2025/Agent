# syntax=docker/dockerfile:1.6
# ───────────────────────── Stage 1: builder ─────────────────────────
FROM python:3.11-slim AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /build

# Install build deps
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        gcc \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
# Install CPU-only torch & ML deps if needed (uncomment as appropriate)
# RUN pip install --extra-index-url https://download.pytorch.org/whl/cpu torch==2.1.0
RUN pip install -r requirements.txt

# ───────────────────────── Stage 2: runtime ─────────────────────────
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONFAULTHANDLER=1

# Create non-root user
RUN groupadd -g 1000 app && useradd -m -u 1000 -g 1000 -s /bin/bash app

# Install runtime system deps (curl for healthcheck)
RUN apt-get update && apt-get install -y --no-install-recommends \
        curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy Python deps from builder
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Copy app source
COPY --chown=app:app . .

# Data and skill-upload dirs
RUN mkdir -p /app/data/competition /app/data/skill_uploads \
    && chown -R app:app /app/data

USER app

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -fsS http://127.0.0.1:8000/healthz || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
