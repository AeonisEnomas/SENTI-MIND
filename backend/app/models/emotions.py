
import asyncio
import logging

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

# Emotion model specifically trained for 6 classes: anger, disgust, fear, joy, neutral, sadness, surprise
HF_EMOTION_MODEL = "j-hartmann/emotion-english-distilroberta-base"

HF_API_URL = f"https://router.huggingface.co/hf-inference/models/{HF_EMOTION_MODEL}"
HF_TIMEOUT = 15.0

_FALLBACK = ({"label": "neutral", "score": 1.0},)

# Keep all 7 model outputs (anger, disgust, fear, joy, neutral, sadness, surprise) without synthetic emotions

# Shared client: reuses TLS connections across requests. Created lazily, closed in the app lifespan.
_client: httpx.AsyncClient | None = None
_client_loop: asyncio.AbstractEventLoop | None = None


def _get_client() -> httpx.AsyncClient:
    global _client, _client_loop
    loop = asyncio.get_running_loop()
    # Recreate if closed or bound to a different event loop (e.g. tests that spin up new loops).
    if _client is None or _client.is_closed or _client_loop is not loop:
        _client = httpx.AsyncClient(timeout=HF_TIMEOUT)
        _client_loop = loop
    return _client


async def aclose_client() -> None:
    global _client, _client_loop
    if _client is not None and not _client.is_closed:
        await _client.aclose()
    _client = None
    _client_loop = None


async def detect_emotions(text: str) -> list[dict]:
    if not isinstance(text, str) or not text.strip():
        return list(_FALLBACK)

    if not settings.HF_API_TOKEN:
        logger.warning("HF_API_TOKEN not set — returning fallback emotions.")
        return list(_FALLBACK)

    headers = {"Authorization": f"Bearer {settings.HF_API_TOKEN}"}

    try:
        response = await _get_client().post(HF_API_URL, headers=headers, json={"inputs": text})

        if response.status_code != 200:
            logger.warning("HF API returned %s: %s", response.status_code, response.text[:200])
            return list(_FALLBACK)

        results = response.json()

        # Handle different response formats
        if isinstance(results, list) and results:
            if isinstance(results[0], list):
                results = results[0]
            elif isinstance(results[0], dict) and "label" in results[0]:
                # Single result format from newer models
                results = [{"label": r["label"], "score": r["score"]} for r in results]

        # Return all model predictions without modification
        emotions = []
        for result in results:
            label = result.get("label", "").lower()
            score = result.get("score", 0.0)
            emotions.append({"label": label, "score": round(score, 4)})

        # Sort by score descending
        emotions.sort(key=lambda x: x["score"], reverse=True)
        return emotions  # Return all model outputs

    except httpx.TimeoutException:
        logger.error("HF API timed out after %ss", HF_TIMEOUT)
        return list(_FALLBACK)
    except httpx.HTTPError as exc:
        logger.error("HF API HTTP error: %s", exc)
        return list(_FALLBACK)
    except Exception as exc:
        logger.exception("HF API unexpected error: %s", exc)
        return list(_FALLBACK)