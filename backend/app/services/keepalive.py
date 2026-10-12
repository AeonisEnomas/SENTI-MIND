import asyncio
import logging
import time

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

# Supabase pauses free-tier projects after a stretch without database activity.
# A minimal PostgREST read with the anon key reaches Postgres (RLS returns no rows),
# which counts as activity without touching any user data.
_PING_PATH = "/rest/v1/journal_entries?select=id&limit=1"
_PING_TIMEOUT = 10.0
# Repeated hits within this window reuse the last result, so hammering /keepalive
# can't be amplified into Supabase traffic.
CACHE_SECONDS = 60.0

_cache: dict | None = None
_cache_at = 0.0
_lock = asyncio.Lock()


async def _query_supabase() -> dict:
    if not settings.SUPABASE_URL or not settings.SUPABASE_ANON_KEY:
        return {"status": "unconfigured"}

    headers = {
        "apikey": settings.SUPABASE_ANON_KEY,
        "Authorization": f"Bearer {settings.SUPABASE_ANON_KEY}",
    }
    url = settings.SUPABASE_URL.rstrip("/") + _PING_PATH
    start = time.monotonic()
    try:
        async with httpx.AsyncClient(timeout=_PING_TIMEOUT) as client:
            response = await client.get(url, headers=headers)
    except httpx.HTTPError as exc:
        logger.warning("Supabase keep-alive ping failed: %s", exc)
        return {"status": "error"}

    latency_ms = round((time.monotonic() - start) * 1000)
    if response.status_code != 200:
        logger.warning("Supabase keep-alive ping returned %s: %s", response.status_code, response.text[:200])
        return {"status": "error", "latency_ms": latency_ms}
    return {"status": "ok", "latency_ms": latency_ms}


async def ping_database() -> dict:
    """Touch Supabase at most once per CACHE_SECONDS. Returns {"status": ok|error|unconfigured, ...}."""
    global _cache, _cache_at
    async with _lock:
        if _cache is not None and time.monotonic() - _cache_at < CACHE_SECONDS:
            return {**_cache, "cached": True}
        _cache = await _query_supabase()
        _cache_at = time.monotonic()
        return {**_cache, "cached": False}


def reset_cache() -> None:
    global _cache, _cache_at
    _cache = None
    _cache_at = 0.0
