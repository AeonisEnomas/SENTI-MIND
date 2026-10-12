import logging
import os
import re
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from app.api import router
from app.core.config import settings
from app.models import emotions
from app.models.classifier import classifier
from app.services import keepalive, ner, openrouter

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    classifier.load()
    try:
        ner.load()
    except Exception:
        # Not fatal: extract_entities retries the load lazily on first use.
        logger.exception("Failed to preload spaCy model; will retry lazily on first request.")
    yield
    await emotions.aclose_client()
    await openrouter.aclose_client()


_docs_enabled = not settings.is_production

app = FastAPI(
    title="SentiMind API",
    description="Multi-layer sentiment & emotion analysis engine",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if _docs_enabled else None,
    redoc_url="/redoc" if _docs_enabled else None,
    openapi_url="/openapi.json" if _docs_enabled else None,
)

VERCEL_ORIGIN = "https://senti-mind-mocha.vercel.app"

def _parse_origins(raw: str) -> list[str]:
    """Split on commas OR newlines so stray line-breaks in env vars don't corrupt entries."""
    parts = re.split(r"[,\n\r]+", raw)
    return [p.strip().rstrip("/") for p in parts if p.strip()]

allowed_origins = _parse_origins(
    os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
)
if VERCEL_ORIGIN not in allowed_origins:
    allowed_origins.append(VERCEL_ORIGIN)


# Failsafe CORS middleware (runs BEFORE FastAPI error handlers)
# Guarantees Access-Control-Allow-Origin is present even on 500 crashes,
# so the browser reports the real error instead of a misleading CORS block.
class ForceCORSMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        origin = request.headers.get("origin", "")
        try:
            response = await call_next(request)
        except Exception:
            # Log the details server-side; never leak exception text to the client.
            logger.exception("Unhandled error on %s %s", request.method, request.url.path)
            response = JSONResponse({"detail": "Internal server error"}, status_code=500)
        if origin and origin in allowed_origins:
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
            response.headers["Access-Control-Allow-Methods"] = "*"
            response.headers["Access-Control-Allow-Headers"] = "*"
        return response


app.add_middleware(ForceCORSMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api/v1")


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.get("/wake")
def wake():
    """Lightweight keep-alive endpoint — no ML inference, returns instantly.
    Used by the frontend's warm-up probe. For scheduled pings use /keepalive."""
    return {"alive": True}


@app.get("/keepalive")
async def keep_alive(response: Response):
    """Scheduled-pinger endpoint: keeps the Render dyno awake and touches Supabase so the
    free-tier project isn't paused for inactivity. Returns 503 if the database ping fails,
    so the pinger's logs show the failure."""
    database = await keepalive.ping_database()
    if database["status"] == "error":
        response.status_code = 503
    return {"alive": True, "database": database}
