from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_NAME: str = "SentiMind"

    HF_API_TOKEN: str = ""
    OPENROUTER_API_KEY: str = ""
    OPENROUTER_MODEL: str = "google/gemini-3.1-flash-lite-preview"
    OPENROUTER_MAX_TOKENS: int = 1024
    SUPABASE_URL: str = ""
    SUPABASE_ANON_KEY: str = ""

    class Config:
        env_file = (".env", "../.env")
        extra = "ignore"


settings = Settings()
