import logging
from datetime import date, datetime, timedelta, timezone
from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from supabase import Client
from app.api.auth_middleware import get_current_user, get_authenticated_client
from app.models.schemas import Category, RiskLevel

logger = logging.getLogger(__name__)

router = APIRouter()

# Routes here are plain `def`: supabase-py is synchronous, and FastAPI runs sync
# routes in its threadpool so the blocking `.execute()` calls don't stall the event loop.

# How far a client-supplied local date may be from the server's UTC date. Covers every
# real timezone (UTC-12..UTC+14) without letting clients backfill arbitrary days.
MAX_CLIENT_DATE_SKEW_DAYS = 1


class MoodLogRequest(BaseModel):
    category: Category
    confidence: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    risk_level: Optional[RiskLevel] = None
    risk_score: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    entry_id: Optional[UUID] = None
    # The user's local calendar date (YYYY-MM-DD). The server runs in UTC, so without this
    # an entry made at 2am in Pakistan (UTC+5) would land on the previous day.
    logged_date: Optional[date] = None


def _utc_today() -> date:
    return datetime.now(timezone.utc).date()


def _resolve_logged_date(client_date: Optional[date]) -> date:
    today = _utc_today()
    if client_date is not None and abs((client_date - today).days) <= MAX_CLIENT_DATE_SKEW_DAYS:
        return client_date
    return today


@router.post("/", status_code=201)
def log_mood(
    payload: MoodLogRequest,
    user_id: str = Depends(get_current_user),
    sb: Client = Depends(get_authenticated_client),
):
    try:
        result = (
            sb.table("mood_logs")
            .insert({
                "user_id": user_id,
                "category": payload.category,
                "confidence": payload.confidence,
                "risk_level": payload.risk_level,
                "risk_score": payload.risk_score,
                "entry_id": str(payload.entry_id) if payload.entry_id else None,
                "logged_date": _resolve_logged_date(payload.logged_date).isoformat(),
            })
            .execute()
        )
        return result.data[0]
    except Exception:
        logger.exception("Failed to log mood for user %s", user_id)
        raise HTTPException(status_code=500, detail="Failed to log mood.")


def _collapse_latest_per_day(rows: list[dict]) -> list[dict]:
    """Keep one row per logged_date: the one with the latest created_at. Sorted by date."""
    by_date: dict = {}
    for row in rows:
        key = row["logged_date"]
        current = by_date.get(key)
        if current is None or (row.get("created_at") or "") >= (current.get("created_at") or ""):
            by_date[key] = row
    return [by_date[k] for k in sorted(by_date)]


@router.get("/heatmap")
def get_heatmap(
    user_id: str = Depends(get_current_user),
    sb: Client = Depends(get_authenticated_client),
):
    try:
        since = (_utc_today() - timedelta(days=29)).isoformat()
        result = (
            sb.table("mood_logs")
            .select("logged_date, category, risk_level, confidence, created_at")
            .eq("user_id", user_id)
            .gte("logged_date", since)
            .order("logged_date", desc=False)
            .order("created_at", desc=False)
            .execute()
        )

        days = _collapse_latest_per_day(result.data)
        feedback = _generate_feedback(days)

        return {"days": days, "feedback": feedback}
    except Exception:
        logger.exception("Failed to get mood heatmap for user %s", user_id)
        raise HTTPException(status_code=500, detail="Failed to retrieve mood heatmap.")


@router.get("/trends")
def get_trends(
    days: int = Query(30, ge=1, le=365),
    user_id: str = Depends(get_current_user),
    sb: Client = Depends(get_authenticated_client),
):
    try:
        since = (_utc_today() - timedelta(days=days - 1)).isoformat()
        result = (
            sb.table("mood_logs")
            .select("logged_date, category, confidence, risk_score")
            .eq("user_id", user_id)
            .gte("logged_date", since)
            .order("logged_date", desc=False)
            .execute()
        )
        return result.data
    except Exception:
        logger.exception("Failed to get mood trends for user %s", user_id)
        raise HTTPException(status_code=500, detail="Failed to retrieve mood trends.")


def _generate_feedback(entries: list) -> str:
    if not entries:
        return "No mood data yet. Start journaling to see your trends!"

    POSITIVE = {"Normal"}
    NEGATIVE = {"Depression", "Suicidal", "Anxiety", "Bipolar", "Stress", "Personality Disorder"}

    recent = entries[-7:]  # last 7 days
    positive_count = sum(1 for e in recent if e["category"] in POSITIVE)
    negative_count = sum(1 for e in recent if e["category"] in NEGATIVE)

    if positive_count >= 5:
        return "🌟 Great week! You've had mostly positive days — keep it up."
    elif positive_count >= 3:
        return "💚 Things are looking up. You've had more good days than difficult ones recently."
    elif negative_count >= 5:
        return "💙 It's been a tough week. Remember to use the wellness tools and reach out for support."
    elif negative_count >= 3:
        return "🌤️ Some difficult days recently. Try the Box Breather or Grounding Tool when things feel heavy."
    else:
        return "📊 Your mood has been mixed this week. Keep checking in — consistency helps."
