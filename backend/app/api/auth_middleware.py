
import logging
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from starlette.concurrency import run_in_threadpool
from supabase import create_client, Client, ClientOptions

from app.core.config import settings

logger = logging.getLogger(__name__)

_bearer = HTTPBearer(auto_error=False)

# Single module-level client for auth verification (no per-user token needed)
_supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY)


class AuthenticatedUser:
    __slots__ = ("user_id", "token")

    def __init__(self, user_id: str, token: str):
        self.user_id = user_id
        self.token = token


async def _verify_token(
    creds: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
) -> Optional[AuthenticatedUser]:
    if not creds:
        return None

    try:
        # supabase-py is synchronous: run the network call off the event loop.
        user_response = await run_in_threadpool(_supabase.auth.get_user, creds.credentials)
        if hasattr(user_response, "user") and user_response.user:
            return AuthenticatedUser(
                user_id=user_response.user.id,
                token=creds.credentials,
            )
        raise Exception("Invalid user response")
    except Exception as e:
        logger.warning("Token verification failed: %s", e)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token.",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_current_user(
    auth: Optional[AuthenticatedUser] = Depends(_verify_token),
) -> str:
    if not auth:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return auth.user_id


async def get_optional_user(
    auth: Optional[AuthenticatedUser] = Depends(_verify_token),
) -> Optional[str]:
    return auth.user_id if auth else None


async def get_authenticated_client(
    auth: Optional[AuthenticatedUser] = Depends(_verify_token),
) -> Client:
    if not auth:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return await run_in_threadpool(
        create_client,
        settings.SUPABASE_URL,
        settings.SUPABASE_ANON_KEY,
        options=ClientOptions(headers={"Authorization": f"Bearer {auth.token}"}),
    )
