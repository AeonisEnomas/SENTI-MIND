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
pip install -r requirements.txt && python -m spacy download en_core_web_sm
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000   # API docs at /docs

pytest                                              # all tests (run from backend/ so `app` is importable)
pytest tests/test_risk_engine.py                    # one file
pytest tests/test_classifier.py::TestStandardClassification::test_normal   # one test

# Retrain the clinical classifier (run from backend/)
cd scripts && python generate_training_data.py && cd ..   # writes data/Combined Data.csv (gitignored)
python scripts/train_model.py                             # writes data/sentiment_model.joblib, vectorizer.joblib, model_metadata.json

# Frontend (run from frontend/)
npm install
npm run dev        # http://127.0.0.1:5173
npm run build
```

There is no linter or formatter configured.

## Configuration

A single `.env` at the **repo root** serves both halves: `vite.config.js` sets `envDir: "../"`, and `app/core/config.py` reads `.env` or `../.env`.

- Backend: `HF_API_TOKEN`, `OPENROUTER_API_KEY` (+ optional `OPENROUTER_MODEL`, `OPENROUTER_MAX_TOKENS`), `SUPABASE_URL`, `SUPABASE_ANON_KEY`, optional `ALLOWED_ORIGINS` (comma/newline separated), `SENTIMIND_MODEL_PATH` / `SENTIMIND_VECTORIZER_PATH`.
- Frontend: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (the app throws on load without them), `VITE_API_URL` (default `http://localhost:8000/api/v1`).

All LLM calls (analysis insight and chat agent) go through `app/services/openrouter.py`, a thin httpx client for OpenRouter's OpenAI-compatible chat API. It always sends `max_tokens`: without it, OpenRouter reserves credit for the model's full output limit, and low-balance accounts get a 402. Don't add provider-specific SDKs.

The README lists `/api/v1/analyze`, but the real route is `POST /api/v1/analysis/`.

## Architecture

### Analysis pipeline (`backend/app/api/analysis.py`)
`POST /api/v1/analysis/` runs these stages in order. Each one degrades gracefully instead of failing the request:
1. `services/preprocessor.clean_text`: noise removal and emoji→word translation.
2. `models/emotions.detect_emotions`: calls the HuggingFace Inference API (`j-hartmann/emotion-english-distilroberta-base`). Returns `neutral: 1.0` if there's no token or an error.
3. `models/classifier.classifier.predict`: local calibrated LinearSVC + TF-IDF loaded from `backend/data/*.joblib`. Loading happens at app startup through the FastAPI `lifespan` hook. Returns the category, a confidence tier, an ambiguity flag (top-2 within 0.10), and "Uncertain"/"Insufficient" for low confidence or short input.
4. `services/ner.extract_entities`: spaCy `en_core_web_sm`.
5. `services/risk_engine.assess_risk`: combines crisis keywords, negation detection, past-tense context, emotions, and classifier output into `low|medium|high|critical` plus a `safety_protocol` flag.
6. `models/llm.generate_insight`: OpenRouter prompt with a fixed four-section markdown structure. Falls back to a canned insight on failure.

**There are two preprocessing modules, and they do different jobs.** `services/preprocessor.py` cleans user text for the whole pipeline. `core/preprocessing.py` (`preprocess`: contractions, 3-word negation scoping `NEG_x`, intensity/temporal/crisis markers) is the feature transform the classifier applies internally. `scripts/train_model.py` uses the same function. If you change `core/preprocessing.py`, you must retrain the model, or the saved vectorizer won't match the features it receives.

`core/constants.py` is the single source of truth for categories, risk thresholds, `SAFETY_PROTOCOL_THRESHOLD`, and `CRISIS_KEYWORDS`. Both the risk engine and the preprocessing modules import from it.

### Auth and data access
- The frontend authenticates directly with Supabase (`src/lib/supabaseClient.js`, `context/AuthContext.jsx`). The axios clients in `src/services/*Service.js` attach the Supabase session JWT as a Bearer token.
- On the backend, `api/auth_middleware.py` verifies tokens through `supabase.auth.get_user`. `get_current_user` returns the user_id. `get_authenticated_client` returns a Supabase client scoped to the user's JWT, so that **Row-Level Security applies**. The journal, mood, and screener routes use that per-user client for DB writes and reads (tables: `journal_entries`, `mood_logs`, `gratitude_snippets`, `screener_results`). Keep using it rather than a service-role client.
- `auth_middleware` creates a Supabase client at import time, so importing `app.main` or any API module requires the `SUPABASE_*` env vars. The unit tests avoid this by importing models and services directly.

### Chat agent
`POST /api/v1/chat/` → `services/agent_service.AgentService`: an OpenRouter chat with a long "Senti-Agent" clinical-psychologist system prompt. The frontend still sends history in Gemini shape (`{role: "user"|"model", parts: [...]}`), and the agent converts it to OpenAI-style messages. The prompt includes crisis rules that reference regional (Pakistan) services: Umang and 1122.

### Cold-start handling (Render free tier)
- `GET /wake` is a no-inference keep-alive endpoint, and `GET /health` returns status plus allowed CORS origins.
- `scripts/keep_alive.py` is meant to run as a Render cron job that pings `/wake`.
- The frontend's `hooks/useServerWarmup.js` probes `/wake` and shows `WarmupBanner` while the server is cold.

### CORS
`main.py` stacks a custom `ForceCORSMiddleware` on top of Starlette's `CORSMiddleware`, so CORS headers are present even on unhandled 500s. The Vercel origin `https://senti-mind-mocha.vercel.app` is always appended to the allowed origins.

### Frontend
React 18 + React Router 7, TailwindCSS, Recharts/Chart.js, and jsPDF/html2canvas for PDF export (`services/pdfService.js`). Pages live in `src/pages/` and render inside `DashboardLayout` behind `ProtectedRoute`. In dev, Vite proxies `/api` to `127.0.0.1:8000`, but the services call `VITE_API_URL` directly.

## Tests

The tests in `backend/tests/` are pure unit tests over the classifier, emotions, preprocessor, risk engine, and OpenRouter client. `test_openrouter.py` mocks HTTP with `httpx.MockTransport`, so it needs no key. `test_classifier.py` loads the real joblib artifacts and asserts specific category predictions, so any retrain can break it. Run it after every retrain. `test_emotions.py` uses `pytest-asyncio`.
