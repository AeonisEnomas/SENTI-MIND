
import logging
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from supabase import Client
from app.api.auth_middleware import get_current_user, get_authenticated_client

logger = logging.getLogger(__name__)

router = APIRouter()

# Routes here are plain `def`: supabase-py is synchronous, and FastAPI runs sync
# routes in its threadpool so the blocking `.execute()` calls don't stall the event loop.

# GAD-2 / PHQ-2 items are scored 0 ("not at all") .. 3 ("nearly every day"); each has exactly 2 items.
Answer = Annotated[int, Field(strict=True, ge=0, le=3)]


class ScreenerSubmit(BaseModel):
    gad2_answers: list[Answer] = Field(..., min_length=2, max_length=2)
    phq2_answers: list[Answer] = Field(..., min_length=2, max_length=2)


def _interpret_gad2(score: int) -> str:
    if score >= 3:
        return "Possible anxiety disorder — consider speaking with a mental health professional."
    return "Anxiety symptoms appear minimal."


def _interpret_phq2(score: int) -> str:
    if score >= 3:
        return "Possible depressive disorder — consider speaking with a mental health professional."
    return "Depressive symptoms appear minimal."


@router.post("/", status_code=201)
def submit_screener(
    payload: ScreenerSubmit,
    user_id: str = Depends(get_current_user),
    sb: Client = Depends(get_authenticated_client),
):
    gad2 = sum(payload.gad2_answers)
    phq2 = sum(payload.phq2_answers)

    try:
        result = (
            sb.table("screener_results")
            .insert({
                "user_id": user_id,
                "gad2_score": gad2,
                "phq2_score": phq2,
                "gad2_answers": payload.gad2_answers,
                "phq2_answers": payload.phq2_answers,
            })
            .execute()
        )

        return {
            **result.data[0],
            "gad2_interpretation": _interpret_gad2(gad2),
            "phq2_interpretation": _interpret_phq2(phq2),
        }
    except Exception:
        logger.exception("Failed to submit screener for user %s", user_id)
        raise HTTPException(status_code=500, detail="Failed to save screener results.")


@router.get("/history")
def screener_history(
    user_id: str = Depends(get_current_user),
    sb: Client = Depends(get_authenticated_client),
):
    try:
        result = (
            sb.table("screener_results")
            .select("id, gad2_score, phq2_score, created_at")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(20)
            .execute()
        )
        return [
            {
                **row,
                "gad2_interpretation": _interpret_gad2(row["gad2_score"]),
                "phq2_interpretation": _interpret_phq2(row["phq2_score"]),
            }
            for row in result.data
        ]
    except Exception:
        logger.exception("Failed to get screener history for user %s", user_id)
        raise HTTPException(status_code=500, detail="Failed to retrieve screener history.")
