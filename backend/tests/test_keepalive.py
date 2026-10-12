"""Tests for the /keepalive endpoint and the Supabase keep-alive ping (HTTP is mocked)."""

import httpx
import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app
from app.services import keepalive


@pytest.fixture(autouse=True)
def _fresh_cache():
    keepalive.reset_cache()
    yield
    keepalive.reset_cache()


@pytest.fixture
def mock_supabase(monkeypatch):
    """Route keep-alive HTTP calls to `state["handler"]`; records each request."""
    state = {"handler": lambda request: httpx.Response(200, json=[]), "requests": []}

    def transport_handler(request):
        state["requests"].append(request)
        return state["handler"](request)

    real_client = httpx.AsyncClient

    def fake_client(*args, **kwargs):
        kwargs["transport"] = httpx.MockTransport(transport_handler)
        return real_client(*args, **kwargs)

    monkeypatch.setattr(keepalive.httpx, "AsyncClient", fake_client)
    monkeypatch.setattr(settings, "SUPABASE_URL", "https://proj.supabase.co/")
    monkeypatch.setattr(settings, "SUPABASE_ANON_KEY", "anon-key")
    return state


@pytest.mark.asyncio
async def test_ping_hits_postgrest_with_anon_key(mock_supabase):
    result = await keepalive.ping_database()
    assert result["status"] == "ok" and result["cached"] is False
    assert isinstance(result["latency_ms"], int)
    req = mock_supabase["requests"][0]
    assert str(req.url) == "https://proj.supabase.co/rest/v1/journal_entries?select=id&limit=1"
    assert req.headers["apikey"] == "anon-key"
    assert req.headers["authorization"] == "Bearer anon-key"


@pytest.mark.asyncio
async def test_ping_is_cached(mock_supabase):
    await keepalive.ping_database()
    second = await keepalive.ping_database()
    assert second["cached"] is True
    assert len(mock_supabase["requests"]) == 1


@pytest.mark.asyncio
async def test_cache_expires(mock_supabase, monkeypatch):
    await keepalive.ping_database()
    monkeypatch.setattr(keepalive, "CACHE_SECONDS", 0.0)
    await keepalive.ping_database()
    assert len(mock_supabase["requests"]) == 2


@pytest.mark.asyncio
async def test_ping_reports_http_error_status(mock_supabase):
    mock_supabase["handler"] = lambda request: httpx.Response(503, text="paused")
    result = await keepalive.ping_database()
    assert result["status"] == "error"


@pytest.mark.asyncio
async def test_ping_reports_network_error(mock_supabase):
    def boom(request):
        raise httpx.ConnectError("unreachable", request=request)

    mock_supabase["handler"] = boom
    result = await keepalive.ping_database()
    assert result == {"status": "error", "cached": False}


@pytest.mark.asyncio
async def test_ping_unconfigured(monkeypatch):
    monkeypatch.setattr(settings, "SUPABASE_URL", "")
    result = await keepalive.ping_database()
    assert result["status"] == "unconfigured"


def _client_with(monkeypatch, db_result):
    async def fake_ping():
        return db_result

    monkeypatch.setattr(keepalive, "ping_database", fake_ping)
    return TestClient(app)


def test_keepalive_endpoint_ok(monkeypatch):
    with _client_with(monkeypatch, {"status": "ok", "latency_ms": 12, "cached": False}) as c:
        r = c.get("/keepalive")
    assert r.status_code == 200
    assert r.json() == {"alive": True, "database": {"status": "ok", "latency_ms": 12, "cached": False}}


def test_keepalive_endpoint_db_failure_is_503(monkeypatch):
    with _client_with(monkeypatch, {"status": "error", "cached": False}) as c:
        r = c.get("/keepalive")
    assert r.status_code == 503
    assert r.json()["alive"] is True


def test_keepalive_endpoint_unconfigured_is_200(monkeypatch):
    with _client_with(monkeypatch, {"status": "unconfigured", "cached": False}) as c:
        r = c.get("/keepalive")
    assert r.status_code == 200
