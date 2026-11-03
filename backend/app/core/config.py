from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_NAME: str = "SentiMind"
    # "production" disables the interactive API docs (/docs, /redoc, /openapi.json).
    ENVIRONMENT: str = "development"

    HF_API_TOKEN: str = ""
    OPENROUTER_API_KEY: str = ""
    # Insight generation model (single-turn, templated): cheap free slug. Free slugs rotate
    # constantly; if this 404s or 429s in production, set OPENROUTER_MODEL in .env — no code change.
    OPENROUTER_MODEL: str = "google/gemma-4-26b-a4b-it:free"
    # Chat agent model (multi-turn): strongest free instruct model available at time of writing.
    OPENROUTER_CHAT_MODEL: str = "nvidia/nemotron-3-ultra-550b-a55b:free"
    # Automatic fallback when the primary model is unavailable (OpenRouter "models" routing).
    OPENROUTER_FALLBACK_MODEL: str = "openrouter/free"
    OPENROUTER_MAX_TOKENS: int = 1024          # insight cap
    OPENROUTER_CHAT_MAX_TOKENS: int = 2048     # chat cap (markdown replies truncate at 1024)
    OPENROUTER_TEMPERATURE: float = 0.7        # chat
    OPENROUTER_INSIGHT_TEMPERATURE: float = 0.5  # insight: templated, low-variance output
    SUPABASE_URL: str = ""
    SUPABASE_ANON_KEY: str = ""

    # Classifier backend: "auto" uses the local v8 ONNX transformer when its artifacts
    # are present (app/models/classifier_onnx/), else the sklearn LinearSVC (v7).
    # Force one with "onnx" or "sklearn" if needed.
    CLASSIFIER_BACKEND: str = "auto"
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
