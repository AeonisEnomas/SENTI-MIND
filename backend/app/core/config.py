from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_NAME: str = "SentiMind"
    # "production" disables the interactive API docs (/docs, /redoc, /openapi.json).
    ENVIRONMENT: str = "development"

    HF_API_TOKEN: str = ""
    OPENROUTER_API_KEY: str = ""
    OPENROUTER_MODEL: str = "google/gemini-3.1-flash-lite-preview"
    OPENROUTER_MAX_TOKENS: int = 1024
    SUPABASE_URL: str = ""
    SUPABASE_ANON_KEY: str = ""

    # Per-user sliding-window rate limits (requests per RATE_LIMIT_WINDOW_SECONDS). 0 disables.
    RATE_LIMIT_ANALYSIS_PER_MINUTE: int = 20
    RATE_LIMIT_CHAT_PER_MINUTE: int = 30
    RATE_LIMIT_WINDOW_SECONDS: float = 60.0

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT.strip().lower() == "production"

    class Config:
        env_file = (".env", "../.env")
        extra = "ignore"


settings = Settings()
