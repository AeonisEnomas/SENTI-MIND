import asyncio
import logging

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
OPENROUTER_TIMEOUT = 60.0


class OpenRouterError(RuntimeError):
    pass


# Shared client: reuses TLS connections across requests. Created lazily, closed in the app lifespan.
_client: httpx.AsyncClient | None = None
_client_loop: asyncio.AbstractEventLoop | None = None


def _get_client() -> httpx.AsyncClient:
    global _client, _client_loop
    loop = asyncio.get_running_loop()
    # Recreate if closed or bound to a different event loop (e.g. tests that spin up new loops).
    if _client is None or _client.is_closed or _client_loop is not loop:
        _client = httpx.AsyncClient(timeout=OPENROUTER_TIMEOUT)
        _client_loop = loop
    return _client


async def aclose_client() -> None:
    global _client, _client_loop
    if _client is not None and not _client.is_closed:
        await _client.aclose()
    _client = None
    _client_loop = None


def is_configured() -> bool:
    return bool(settings.OPENROUTER_API_KEY)


async def chat_completion(
    messages: list[dict], model: str | None = None, max_tokens: int | None = None
) -> tuple[str, dict]:
    """Send OpenAI-style messages to OpenRouter. Returns (text, {"model", "usage"})."""
    if not is_configured():
        raise OpenRouterError("OPENROUTER_API_KEY not set")

    headers = {
        "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "X-Title": settings.APP_NAME,
    }
    # Always cap max_tokens: without it OpenRouter reserves credit for the model's full output limit.
    body = {
        "model": model or settings.OPENROUTER_MODEL,
        "messages": messages,
        "max_tokens": max_tokens or settings.OPENROUTER_MAX_TOKENS,
    }

    response = await _get_client().post(OPENROUTER_URL, headers=headers, json=body)

    if response.status_code != 200:
        raise OpenRouterError(f"OpenRouter returned {response.status_code}: {response.text[:300]}")

    data = response.json()
    if "error" in data:
        raise OpenRouterError(f"OpenRouter error: {data['error']}")

    try:
        text = (data["choices"][0]["message"]["content"] or "").strip()
    except (KeyError, IndexError, TypeError) as exc:
        raise OpenRouterError(f"Unexpected OpenRouter response: {str(data)[:300]}") from exc
    if not text:
        raise OpenRouterError("OpenRouter returned an empty response")

    usage = data.get("usage") or {}
    return text, {
        "model": data.get("model", body["model"]),
        "usage": {
            "prompt_tokens": usage.get("prompt_tokens", 0),
            "completion_tokens": usage.get("completion_tokens", 0),
        },
    }
