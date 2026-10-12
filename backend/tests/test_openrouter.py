"""Tests for the OpenRouter client and the LLM callers built on it (HTTP is mocked)."""

import json

import httpx
import pytest
import pytest_asyncio

from app.core.config import settings
from app.models import llm
from app.services import openrouter
from app.services.agent_service import AgentService

pytestmark = pytest.mark.asyncio


class _Captured(list):
    handler = staticmethod(lambda body: httpx.Response(200, json=_ok("hello")))

    def set_handler(self, handler):
        self.handler = handler


@pytest_asyncio.fixture
async def mock_openrouter(monkeypatch):
    """Route OpenRouter HTTP calls to a handler; returns the captured requests."""
    captured = _Captured()

    def transport_handler(request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content)
        captured.append({"body": body, "headers": dict(request.headers)})
        return captured.handler(body)

    real_client = httpx.AsyncClient

    def fake_client(*args, **kwargs):
        kwargs["transport"] = httpx.MockTransport(transport_handler)
        return real_client(*args, **kwargs)

    monkeypatch.setattr(openrouter.httpx, "AsyncClient", fake_client)
    # Force the shared client to be (re)created through the patched constructor.
    monkeypatch.setattr(openrouter, "_client", None)
    monkeypatch.setattr(openrouter, "_client_loop", None)
    monkeypatch.setattr(settings, "OPENROUTER_API_KEY", "test-key")
    yield captured
    await openrouter.aclose_client()


def _ok(text, model="test/model"):
    return {
        "model": model,
        "choices": [{"message": {"role": "assistant", "content": text}}],
        "usage": {"prompt_tokens": 11, "completion_tokens": 7},
    }


async def test_chat_completion_success(mock_openrouter):
    text, details = await openrouter.chat_completion([{"role": "user", "content": "hi"}])
    assert text == "hello"
    assert details == {"model": "test/model", "usage": {"prompt_tokens": 11, "completion_tokens": 7}}
    req = mock_openrouter[0]
    assert req["headers"]["authorization"] == "Bearer test-key"
    assert req["body"]["model"] == settings.OPENROUTER_MODEL
    assert req["body"]["max_tokens"] == settings.OPENROUTER_MAX_TOKENS


async def test_chat_completion_reuses_shared_client(mock_openrouter):
    await openrouter.chat_completion([{"role": "user", "content": "hi"}])
    first = openrouter._client
    await openrouter.chat_completion([{"role": "user", "content": "again"}])
    assert openrouter._client is first and len(mock_openrouter) == 2
    await openrouter.aclose_client()
    assert openrouter._client is None and first.is_closed


async def test_chat_completion_model_override(mock_openrouter):
    await openrouter.chat_completion([{"role": "user", "content": "hi"}], model="other/model", max_tokens=50)
    assert mock_openrouter[0]["body"]["model"] == "other/model"
    assert mock_openrouter[0]["body"]["max_tokens"] == 50


@pytest.mark.parametrize("response", [
    httpx.Response(401, json={"error": {"message": "bad key"}}),
    httpx.Response(200, json={"error": {"message": "rate limited"}}),
    httpx.Response(200, json={"choices": []}),
    httpx.Response(200, json=_ok("")),
])
async def test_chat_completion_errors(mock_openrouter, response):
    mock_openrouter.set_handler(lambda body: response)
    with pytest.raises(openrouter.OpenRouterError):
        await openrouter.chat_completion([{"role": "user", "content": "hi"}])


async def test_chat_completion_requires_key(monkeypatch):
    monkeypatch.setattr(settings, "OPENROUTER_API_KEY", "")
    with pytest.raises(openrouter.OpenRouterError):
        await openrouter.chat_completion([{"role": "user", "content": "hi"}])


CLINICAL = {"category": "Anxiety", "confidence": 0.8}
RISK = {"level": "medium", "triggers": [], "safety_protocol": False}
EMOTIONS = [{"label": "fear", "score": 0.7}]


async def test_generate_insight_uses_openrouter(mock_openrouter):
    insight, details = await llm.generate_insight("I am worried", EMOTIONS, CLINICAL, RISK)
    assert insight == "hello"
    assert details["model"] == "test/model"
    prompt = mock_openrouter[0]["body"]["messages"][0]["content"]
    assert "Anxiety" in prompt and "I am worried" in prompt


async def test_generate_insight_falls_back_on_error(mock_openrouter):
    mock_openrouter.set_handler(lambda body: httpx.Response(500, text="boom"))
    insight, details = await llm.generate_insight("I am worried", EMOTIONS, CLINICAL, RISK)
    assert details is None
    assert "Anxiety" in insight and "**Exercises & Coping Strategies:**" in insight


async def test_generate_insight_falls_back_without_key(monkeypatch):
    monkeypatch.setattr(settings, "OPENROUTER_API_KEY", "")
    insight, details = await llm.generate_insight("I am worried", EMOTIONS, CLINICAL, RISK)
    assert details is None
    assert "Anxiety" in insight


async def test_agent_chat_converts_history(mock_openrouter):
    history = [
        {"role": "user", "parts": ["first", "message"]},
        {"role": "model", "parts": ["a reply"]},
    ]
    reply = await AgentService().chat("user-1", "follow up", history)
    assert reply == "hello"
    messages = mock_openrouter[0]["body"]["messages"]
    assert messages[0]["role"] == "system" and "Senti-Agent" in messages[0]["content"]
    assert messages[1:] == [
        {"role": "user", "content": "first\nmessage"},
        {"role": "assistant", "content": "a reply"},
        {"role": "user", "content": "follow up"},
    ]


async def test_agent_chat_returns_crisis_safe_fallback(mock_openrouter):
    mock_openrouter.set_handler(lambda body: httpx.Response(503, text="down"))
    reply = await AgentService().chat("user-1", "hello")
    assert "Umang" in reply and "1122" in reply
