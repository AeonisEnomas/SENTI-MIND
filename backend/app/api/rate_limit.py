import math
import threading
import time
from collections import defaultdict, deque
from typing import Callable

from fastapi import Depends, HTTPException, status

from app.api.auth_middleware import get_current_user
from app.core.config import settings


class SlidingWindowRateLimiter:
    """In-memory per-key sliding-window limiter.

    State lives in process memory, so limits are per worker and reset on restart.
    That is acceptable for the single-worker Render deployment.
    """

    _PRUNE_THRESHOLD = 10_000

    def __init__(self, name: str):
        self.name = name
        self._hits: dict[str, deque] = defaultdict(deque)
        self._lock = threading.Lock()

    def hit(self, key: str, limit: int, window: float) -> float | None:
        """Record a request. Returns None if allowed, else seconds until a slot frees up."""
        now = time.monotonic()
        cutoff = now - window
        with self._lock:
            hits = self._hits[key]
            while hits and hits[0] <= cutoff:
                hits.popleft()
            if len(hits) >= limit:
                return max(hits[0] + window - now, 0.0)
            hits.append(now)
            if len(self._hits) > self._PRUNE_THRESHOLD:
                self._prune(cutoff)
            return None

    def _prune(self, cutoff: float) -> None:
        # Drop keys whose newest hit is outside the window so memory stays bounded.
        for k in [k for k, v in self._hits.items() if not v or v[-1] <= cutoff]:
            del self._hits[k]

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()


analysis_limiter = SlidingWindowRateLimiter("analysis")
chat_limiter = SlidingWindowRateLimiter("chat")


def rate_limit(limiter: SlidingWindowRateLimiter, limit_setting: str) -> Callable:
    """Build a dependency that rate-limits the authenticated user on `limiter`.

    The limit is read from `settings` on every call so it can be tuned at runtime (and in tests).
    """

    async def _dependency(user_id: str = Depends(get_current_user)) -> None:
        limit = getattr(settings, limit_setting)
        if limit <= 0:
            return
        retry_after = limiter.hit(user_id, limit, settings.RATE_LIMIT_WINDOW_SECONDS)
        if retry_after is not None:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many requests. Please slow down and try again shortly.",
                headers={"Retry-After": str(max(1, math.ceil(retry_after)))},
            )

    return _dependency


analysis_rate_limit = rate_limit(analysis_limiter, "RATE_LIMIT_ANALYSIS_PER_MINUTE")
chat_rate_limit = rate_limit(chat_limiter, "RATE_LIMIT_CHAT_PER_MINUTE")
