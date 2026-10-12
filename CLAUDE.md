# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

SentiMind: a mental-health companion app. A React/Vite frontend (deployed on Vercel) talks to a FastAPI backend (deployed on Render free tier) that runs a text-analysis pipeline (emotions + clinical classification + risk + LLM insight). Supabase provides auth and Postgres storage.

## Workflow rules

- **No Claude attribution.** Commit messages and PR descriptions must not include a `Co-Authored-By: Claude` trailer or any "Generated with Claude Code" line.
- **Update main first.** Before starting any task: `git checkout main && git pull`, and confirm main is up to date with the remote.
- **Branch for every task.** Branch off the updated main (e.g. `git checkout -b feat/<short-name>`) and do all work there, never directly on main.
- **Test extensively before merging.** Run the full backend suite (`pytest` from `backend/`). Run `npm run build` for frontend changes. Exercise the changed behaviour itself, for example by hitting the endpoint or running the app. Merge only when everything passes.
- **Merge via GitHub PR.** Push the branch, open a PR against `main` with `gh pr create`, then merge it on GitHub (`gh pr merge`). Do not run a local `git merge` into main. Afterwards, pull main locally.

## Commands

Python 3.11 or 3.12 is required (core ML deps don't support ≤3.10 or 3.14+).

```bash
./start.sh                      # one-shot: creates backend/.venv, installs deps, starts backend :8000 and frontend :5173

# Backend (run from backend/)
python3.11 -m venv .venv && source .venv/bin/activate   # system python may be too new
pip install -r requirements-dev.txt   # runtime pins (incl. spaCy model wheel) + pytest + ruff
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000   # API docs at /docs

pytest                                              # all tests (run from backend/ so `app` is importable)
pytest tests/test_risk_engine.py                    # one file
pytest tests/test_classifier.py::TestStandardClassification::test_normal   # one test
ruff check .                                        # lint (config: backend/ruff.toml)

# Retrain the clinical classifier (run from backend/; needs requirements-train.txt)
python scripts/generate_training_data.py   # writes data/Combined Data.csv (gitignored)
python scripts/train_model.py              # writes data/sentiment_model.joblib, vectorizer.joblib, model_metadata.json

# Frontend (run from frontend/)
npm install
npm run dev        # http://127.0.0.1:5173
npm run lint       # ESLint (flat config)
npm test           # Vitest + Testing Library
npm run build
```

CI (`.github/workflows/ci.yml`) runs ruff + pytest and npm lint/test/build on every PR; keep it green before merging. Dependencies are pinned exactly; `scikit-learn` must stay at the version recorded in `backend/data/model_metadata.json`, or retrain.

## Configuration

A single `.env` at the **repo root** serves both halves: `vite.config.js` sets `envDir: "../"`, and `app/core/config.py` reads `.env` or `../.env`.

`.env.example` documents every variable. Backend: `HF_API_TOKEN`, `OPENROUTER_API_KEY` (+ `OPENROUTER_MODEL`, `OPENROUTER_MAX_TOKENS`), `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `ALLOWED_ORIGINS`, `ENVIRONMENT` (`production` disables `/docs`), `RATE_LIMIT_*`, `SENTIMIND_MODEL_PATH` / `SENTIMIND_VECTORIZER_PATH`.
- Frontend: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (the app throws on load without them), `VITE_API_URL` (default `http://localhost:8000/api/v1`).

All LLM calls (analysis insight and chat agent) go through `app/services/openrouter.py`, a thin httpx client for OpenRouter's OpenAI-compatible chat API. It always sends `max_tokens`: without it, OpenRouter reserves credit for the model's full output limit, and low-balance accounts get a 402. Don't add provider-specific SDKs.

## Architecture

### Analysis pipeline (`backend/app/api/analysis.py`)
`POST /api/v1/analysis/` runs these stages in order. Each one degrades gracefully instead of failing the request:
1. `services/preprocessor.clean_text`: noise removal and emoji→word translation.
2. `models/emotions.detect_emotions`: calls the HuggingFace Inference API (`j-hartmann/emotion-english-distilroberta-base`). Returns `neutral: 1.0` if there's no token or an error.
3. `models/classifier.classifier.predict`: local calibrated LinearSVC + TF-IDF loaded from `backend/data/*.joblib`. Loading happens at app startup through the FastAPI `lifespan` hook. Returns the category, a confidence tier, an ambiguity flag (top-2 within 0.10), and "Insufficient" for short input (low confidence only lowers `confidence_tier`). At load it verifies the artifacts' SHA-256 against `data/model_metadata.json` and refuses to load on mismatch, so retraining must regenerate the metadata.
4. `services/ner.extract_entities`: spaCy `en_core_web_sm`.
5. `services/risk_engine.assess_risk`: combines crisis keywords, emotions, and classifier output into `low|medium|high|critical` plus a `safety_protocol` flag. Keyword matching lives in `core/crisis_detection.py` (word boundaries, negation/past tense judged per occurrence within the same clause, idiom exclusions). Keyword floors override the weighted score: weight ≥ 0.9 → critical, ≥ 0.7 → at least high, and any active keyword ≥ 0.7 sets `safety_protocol`. A crisis keyword never yields `low`. This is safety-critical: over-alerting is the intended failure mode, and `tests/test_risk_safety_regressions.py` must keep passing.
6. `models/llm.generate_insight`: OpenRouter prompt with a fixed four-section markdown structure. User text is wrapped in `<user_text>` delimiters and treated as data. Falls back to a canned insight on failure.

Classifier, spaCy, and Supabase calls are synchronous, so routes run them in the threadpool (`run_in_threadpool`, or plain `def` routes). Keep new blocking calls off the event loop. `POST /analysis/` and `/chat/` are rate-limited per user in memory (`api/rate_limit.py`).

**There are two preprocessing modules, and they do different jobs.** `services/preprocessor.py` cleans user text for the whole pipeline. `core/preprocessing.py` (`preprocess`: contractions, 3-word negation scoping `NEG_x`, intensity/temporal/crisis markers) is the feature transform the classifier applies internally. `scripts/train_model.py` uses the same function. If you change `core/preprocessing.py`, you must retrain the model, or the saved vectorizer won't match the features it receives.

`core/constants.py` is the single source of truth for categories, risk thresholds, `SAFETY_PROTOCOL_THRESHOLD`, and `CRISIS_KEYWORDS`. Both the risk engine and the preprocessing modules import from it. `preprocess()` turns `CRISIS_KEYWORDS` entries with weight ≥ 0.7 into classifier features, so editing that dict means retraining. Put risk-only phrases in `RISK_ONLY_CRISIS_KEYWORDS` instead.

### Auth and data access
- The frontend authenticates directly with Supabase (`src/lib/supabaseClient.js`, `context/AuthContext.jsx`). The axios clients in `src/services/*Service.js` attach the Supabase session JWT as a Bearer token.
- On the backend, `api/auth_middleware.py` verifies tokens through `supabase.auth.get_user`. `get_current_user` returns the user_id. `get_authenticated_client` returns a Supabase client scoped to the user's JWT, so that **Row-Level Security applies**. The journal, mood, and screener routes use that per-user client for DB writes and reads (tables: `journal_entries`, `mood_logs`, `gratitude_snippets`, `screener_results`). Keep using it rather than a service-role client.
- `auth_middleware` creates a Supabase client at import time, so importing `app.main` or any API module requires the `SUPABASE_*` env vars. `tests/conftest.py` sets dummy values for this.
- Schema changes go in `supabase/migrations/` as SQL files, alongside applying them to the project.

### Chat agent
`POST /api/v1/chat/` → `services/agent_service.AgentService`: an OpenRouter chat with a long "Senti-Agent" clinical-psychologist system prompt. The frontend sends prior turns only, in Gemini shape (`{role: "user"|"model", parts: [...]}`), built by `src/lib/chatHistory.js`. The agent converts them to OpenAI-style messages and keeps the last 40. The prompt includes crisis rules that reference regional (Pakistan) services: Umang and 1122.

### Cold-start handling (Render free tier)
- `GET /wake` is a no-inference keep-alive endpoint, and `GET /health` returns `{"status": "ok"}`.
- `scripts/keep_alive.py` pings `/wake`. Render cron jobs are a paid feature; a free external pinger works too.
- The frontend's `hooks/useServerWarmup.js` probes `/wake` and shows `WarmupBanner` while the server is cold.

### CORS
`main.py` stacks a custom `ForceCORSMiddleware` on top of Starlette's `CORSMiddleware`, so CORS headers are present even on unhandled 500s. The 500 body is generic and never includes exception text. The Vercel origin `https://senti-mind-mocha.vercel.app` is always appended to the allowed origins.

### Frontend
React 18 + React Router 7, TailwindCSS, Recharts, and jsPDF/html2canvas for PDF export (`services/pdfService.js`). Pages are lazy-loaded, live in `src/pages/`, and render inside `DashboardLayout` behind `ProtectedRoute`. Keep heavy libraries behind dynamic `import()`.
- Pure logic lives in `src/lib/` and has unit tests: crisis-banner rules in `risk.js` (banner on `safety_protocol`, critical, or Suicidal; gentler variant for high), chat history, local dates, and error normalisation.
- Crisis contacts come only from `src/constants/crisisResources.js`, and category colours only from `src/constants/categories.js`.
- Dates sent to the backend use the user's local calendar date (`src/lib/dates.js`), never `toISOString()`.
- Quick exit is a double Escape (`useDoubleEscape` in `hooks/useQuickHide.js`). Anything that consumes Escape, like a modal, must call `preventDefault()`. In dev, Vite proxies `/api` to `127.0.0.1:8000`, but the services call `VITE_API_URL` directly.

## Tests

- `backend/tests/test_api.py` drives the real app through `TestClient`, overriding the auth dependencies and using a fake Supabase client. The other test files are unit tests.
- No backend test touches the network: `test_openrouter.py` mocks HTTP with `httpx.MockTransport`, so it needs no key. `test_classifier.py` loads the real joblib artifacts and asserts specific category predictions, so any retrain can break it. Run it after every retrain. `test_emotions.py` uses `pytest-asyncio`.
