import os

# app.api.auth_middleware builds a Supabase client at import time, so importing app.main
# needs these set. Dummy values are fine: tests never reach Supabase (auth and DB access
# are replaced via dependency_overrides in test_api.py). Real env values win if present.
os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault(
    "SUPABASE_ANON_KEY",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiJ9.dummy-signature",
)
