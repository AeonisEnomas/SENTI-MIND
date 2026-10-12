import json
import logging
from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, field_validator
from supabase import Client
from app.api.auth_middleware import get_current_user, get_authenticated_client
from app.models.schemas import Category, RiskLevel

logger = logging.getLogger(__name__)

router = APIRouter()

# Routes here are plain `def`: supabase-py is synchronous, and FastAPI runs sync
# routes in its threadpool so the blocking `.execute()` calls don't stall the event loop.

MAX_JOURNAL_TEXT_CHARS = 10_000
MAX_ANALYSIS_JSON_CHARS = 100_000
MAX_GRATITUDE_TEXT_CHARS = 1000


class JournalSaveRequest(BaseModel):
    raw_text: str = Field(..., min_length=1, max_length=MAX_JOURNAL_TEXT_CHARS)
    analysis: dict
    category: Optional[Category] = None
    risk_level: Optional[RiskLevel] = None

    @field_validator("analysis")
    @classmethod
    def _cap_analysis_size(cls, value: dict) -> dict:
        if len(json.dumps(value, default=str)) > MAX_ANALYSIS_JSON_CHARS:
            raise ValueError(f"analysis payload exceeds {MAX_ANALYSIS_JSON_CHARS} characters")
        return value


class GratitudeSaveRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=MAX_GRATITUDE_TEXT_CHARS)
    source_entry_id: Optional[UUID] = None


@router.post("/", status_code=201)
def save_entry(
    payload: JournalSaveRequest,
    user_id: str = Depends(get_current_user),
    sb: Client = Depends(get_authenticated_client),
):
    try:
        result = (
            sb.table("journal_entries")
            .insert({
                "user_id": user_id,
                "raw_text": payload.raw_text,
                "analysis": payload.analysis,
                "category": payload.category,
                "risk_level": payload.risk_level,
            })
            .execute()
        )
        return result.data[0]
    except Exception:
        logger.exception("Failed to save journal entry for user %s", user_id)
        raise HTTPException(status_code=500, detail="Failed to save journal entry.")


@router.get("/")
def list_entries(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user_id: str = Depends(get_current_user),
    sb: Client = Depends(get_authenticated_client),
):
    try:
        result = (
            sb.table("journal_entries")
            .select("id, raw_text, category, risk_level, created_at")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )
        return result.data
    except Exception:
        logger.exception("Failed to list journal entries for user %s", user_id)
        raise HTTPException(status_code=500, detail="Failed to retrieve journal entries.")


# --- Gratitude Snippets ---
# NOTE: These MUST be declared before /{entry_id} so FastAPI doesn't
# match "gratitude" as an entry_id.

@router.post("/gratitude/", status_code=201)
def save_gratitude(
    payload: GratitudeSaveRequest,
    user_id: str = Depends(get_current_user),
    sb: Client = Depends(get_authenticated_client),
):
    try:
        result = (
            sb.table("gratitude_snippets")
            .insert({
                "user_id": user_id,
                "text": payload.text,
                "source_entry_id": str(payload.source_entry_id) if payload.source_entry_id else None,
            })
            .execute()
        )
        return result.data[0]
    except Exception:
        logger.exception("Failed to save gratitude snippet for user %s", user_id)
        raise HTTPException(status_code=500, detail="Failed to save gratitude snippet.")


@router.get("/gratitude/")
def list_gratitude(
    user_id: str = Depends(get_current_user),
    sb: Client = Depends(get_authenticated_client),
):
    try:
        result = (
            sb.table("gratitude_snippets")
            .select("*")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .execute()
        )
        return result.data
    except Exception:
        logger.exception("Failed to list gratitude snippets for user %s", user_id)
        raise HTTPException(status_code=500, detail="Failed to retrieve gratitude snippets.")


@router.delete("/gratitude/{snippet_id}", status_code=204)
def delete_gratitude(
    snippet_id: UUID,
    user_id: str = Depends(get_current_user),
    sb: Client = Depends(get_authenticated_client),
):
    try:
        result = (
            sb.table("gratitude_snippets")
            .delete()
            .eq("id", str(snippet_id))
            .eq("user_id", user_id)
            .execute()
        )
    except Exception:
        logger.exception("Failed to delete gratitude snippet %s for user %s", snippet_id, user_id)
        raise HTTPException(status_code=500, detail="Failed to delete gratitude snippet.")
    if not result.data:
        raise HTTPException(status_code=404, detail="Gratitude snippet not found.")


# --- Single entry operations (MUST come after static sub-paths) ---

@router.get("/{entry_id}")
def get_entry(
    entry_id: UUID,
    user_id: str = Depends(get_current_user),
    sb: Client = Depends(get_authenticated_client),
):
    try:
        # limit(1) instead of .single(): .single() raises (-> 500) when no row matches.
        result = (
            sb.table("journal_entries")
            .select("*")
            .eq("id", str(entry_id))
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
    except Exception:
        logger.exception("Failed to get journal entry %s for user %s", entry_id, user_id)
        raise HTTPException(status_code=500, detail="Failed to retrieve journal entry.")
    if not result.data:
        raise HTTPException(status_code=404, detail="Entry not found.")
    return result.data[0]


@router.delete("/{entry_id}", status_code=204)
def delete_entry(
    entry_id: UUID,
    user_id: str = Depends(get_current_user),
    sb: Client = Depends(get_authenticated_client),
):
    try:
        result = (
            sb.table("journal_entries")
            .delete()
            .eq("id", str(entry_id))
            .eq("user_id", user_id)
            .execute()
        )
    except Exception:
        logger.exception("Failed to delete journal entry %s for user %s", entry_id, user_id)
        raise HTTPException(status_code=500, detail="Failed to delete journal entry.")
    if not result.data:
        raise HTTPException(status_code=404, detail="Entry not found.")
