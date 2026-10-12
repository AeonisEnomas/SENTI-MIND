import logging
from typing import List, Literal, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing_extensions import Annotated
from app.api.auth_middleware import get_current_user
from app.api.rate_limit import chat_rate_limit
from app.services.agent_service import AgentService

logger = logging.getLogger(__name__)

router = APIRouter()
agent_service = AgentService()

MAX_MESSAGE_CHARS = 4000
MAX_PARTS_PER_TURN = 3
MAX_HISTORY_TURNS_ACCEPTED = 50
# Only the most recent turns are forwarded to the LLM; older ones are dropped server-side.
MAX_HISTORY_TURNS_USED = 40

Part = Annotated[str, Field(max_length=MAX_MESSAGE_CHARS)]


class ChatMessage(BaseModel):
    role: Literal["user", "model"]
    parts: List[Part] = Field(..., max_length=MAX_PARTS_PER_TURN)


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=MAX_MESSAGE_CHARS)
    # NOTE: history is fully client-controlled, including "model" turns, so a client can
    # put words in the assistant's mouth. That only affects the caller's own conversation
    # (no server-side state or other users are involved), so we accept it, but cap its size.
    history: Optional[List[ChatMessage]] = Field(default=None, max_length=MAX_HISTORY_TURNS_ACCEPTED)


@router.post("/", dependencies=[Depends(chat_rate_limit)])
async def chat_with_agent(
    payload: ChatRequest,
    user_id: str = Depends(get_current_user),
):
    try:
        history = (payload.history or [])[-MAX_HISTORY_TURNS_USED:]
        formatted_history = [{"role": msg.role, "parts": msg.parts} for msg in history]

        response_text = await agent_service.chat(
            user_id=user_id,
            message=payload.message,
            history=formatted_history
        )
        return {"response": response_text}
    except Exception as e:
        logger.exception("Chat failed for user %s: %s", user_id, e)
        raise HTTPException(status_code=500, detail="Chat service temporarily unavailable. Please try again.")
