"""Deterministic crisis pre-screen for the chat agent.

The LLM must never be the only thing standing between a user in crisis and a
helpline number, and the pre-screen must work even if OpenRouter is down.
"""

import pytest

from app.services import agent_service
from app.services.agent_service import (
    CRISIS_RESPONSE,
    AgentService,
    crisis_response_if_triggered,
)

pytestmark = pytest.mark.asyncio


@pytest.mark.parametrize("text", [
    "kill myself",
    "I want to die",
    "I don't want to be alive",
    "no reason to live",
    "I'm tired of living",
])
async def test_crisis_messages_short_circuit_llm(text, monkeypatch):
    called = False

    async def fake_chat_completion(*args, **kwargs):
        nonlocal called
        called = True
        return ("llm reply", {"model": "test/model", "usage": {}})

    monkeypatch.setattr(agent_service.openrouter, "chat_completion", fake_chat_completion)
    service = AgentService()
    out = await service.chat("user-1", text, [])
    assert out == CRISIS_RESPONSE
    assert called is False
    assert "Umang" in out
    assert "1122" in out


@pytest.mark.parametrize("text", [
    "not suicidal, I never wanted to die",
    "I don't want to die",
    "I used to want to die years ago",
    "I was suicidal back in 2020 but now I'm fine",
])
async def test_negated_or_historical_messages_reach_llm(text, monkeypatch):
    called = False

    async def fake_chat_completion(*args, **kwargs):
        nonlocal called
        called = True
        return ("llm reply", {"model": "test/model", "usage": {}})

    monkeypatch.setattr(agent_service.openrouter, "chat_completion", fake_chat_completion)
    service = AgentService()
    out = await service.chat("user-2", text, [])
    assert called is True
    assert out == "llm reply"


async def test_pre_screen_direct():
    assert crisis_response_if_triggered("kill myself") == CRISIS_RESPONSE
    assert crisis_response_if_triggered("I had an ordinary day") is None


async def test_llm_failure_still_returns_helpline_note(monkeypatch):
    async def boom(*args, **kwargs):
        raise RuntimeError("openrouter down")

    monkeypatch.setattr(agent_service.openrouter, "chat_completion", boom)
    service = AgentService()
    out = await service.chat("user-3", "I had a hard day at work", [])
    assert "Umang" in out  # the LLM-failure fallback still points at crisis resources
