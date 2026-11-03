# SentiMind backend — self-contained image for Render's free tier.
# Build context must be the `backend/` directory (Render rootDir = backend, or
# `docker build -t sentimind ./backend`).
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /srv

# spaCy's en_core_web_sm installs from a GitHub release wheel (see requirements.txt),
# which needs outbound network — Render builds have it.
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy source and ML artifacts (data/*.joblib, model_metadata.json).
COPY . .

# Bake the local ONNX emotion model into the image so the instance needs no
# HuggingFace token and never calls a paid inference API. Fails the build loudly
# if the download can't be verified (SHA-256 checked) rather than shipping a
# silently degraded service.
RUN python scripts/download_emotion_model.py

ENV ENVIRONMENT=production
EXPOSE 10000

# Render sets $PORT (default 10000). Single worker: free tier has 512 MB / 0.1 vCPU.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-10000}"]
