# Architecture

```
React SPA (Vercel) ──Supabase JS──▶ Supabase Auth
      │
      │ HTTPS + Supabase JWT
      ▼
FastAPI (Render) ──user-scoped client (RLS)──▶ Supabase Postgres
      │
      ├─ local ONNX: emotion model, v9 classifier   (no external calls)
      ├─ spaCy en_core_web_sm                        (NER)
      └─ OpenRouter                                  (insight + chat; optional)
```

The frontend authenticates directly with Supabase and sends the session JWT to the API.
The API never holds a service-role key: every database read and write uses a Supabase client
scoped to the caller's JWT, so Postgres Row-Level Security decides what each user can see.

## Analysis pipeline

`POST /api/v1/analysis/` (`backend/app/api/analysis.py`) runs six stages. Each stage
degrades on failure instead of failing the request.

| # | Stage | Module | On failure |
|---|---|---|---|
| 1 | Clean text, translate emoji to words | `services/preprocessor.py` | n/a |
| 2 | Emotions: 7-class `j-hartmann/emotion-english-distilroberta-base`, INT8 ONNX | `models/emotions.py` | returns `[]`; never a made-up score |
| 3 | Category: v9 transformer or v7 fallback, with confidence tier and ambiguity flag | `models/classifier.py`, `models/classifier_onnx.py` | v7 fallback |
| 4 | Named entities | `services/ner.py` | `[]` |
| 5 | Risk level `low / medium / high / critical` and `safety_protocol` flag | `services/risk_engine.py`, `core/crisis_detection.py` | n/a (pure Python) |
| 6 | Four-section insight from an LLM | `models/llm.py` → `services/openrouter.py` | canned insight |

Inputs under three meaningful words are classified `Insufficient`. Model inference, spaCy
and Supabase calls are synchronous and run in the threadpool, off the event loop.

## Crisis safety

Safety logic is deterministic and sits outside every model, so a model or LLM outage can
never suppress it. Over-alerting is the intended failure mode.

- **Keyword engine** (`core/crisis_detection.py`). Weighted phrases with word boundaries,
  negation and past-tense detection judged per occurrence within the same clause, and idiom
  exclusions ("going to die of embarrassment"). Weights live in `core/constants.py`.
- **Floors override the weighted score.** An active keyword of weight ≥ 0.9 forces
  `critical`, ≥ 0.7 forces at least `high` and sets `safety_protocol`. A crisis keyword
  never yields `low`. `tests/test_risk_safety_regressions.py` pins this behaviour.
- **Chat pre-screen.** `services/agent_service.py` runs the same engine on the user's typed
  message before any LLM call and returns a fixed crisis response with local helplines when
  it fires. Data attached through the chat's quick actions is sent separately and is not
  pre-screened, so an old journal entry cannot hijack a data review.
- **Offline fallback.** If the analysis request fails, the frontend checks the entry against
  the same high-weight phrases (`frontend/src/lib/risk.js`) and still shows the crisis banner.
- **Prompt hygiene.** User text is wrapped in `<user_text>` delimiters and treated as data.

Crisis contacts are defined once, in `frontend/src/constants/crisisResources.js`
(Umang 042 3576 5951, Rescue 1122, and the IASP directory for other countries).

## API

All `/api/v1` routes require `Authorization: Bearer <Supabase JWT>`.

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/v1/analysis/` | Run the pipeline (rate-limited per user) |
| POST | `/api/v1/chat/` | Chat with SentiBot; optional `attachment` for user data (rate-limited) |
| GET, POST | `/api/v1/journal/` | List or save journal entries |
| GET, DELETE | `/api/v1/journal/{entry_id}` | Read or delete one entry |
| GET, POST | `/api/v1/journal/gratitude/` | List or save gratitude items |
| DELETE | `/api/v1/journal/gratitude/{snippet_id}` | Delete a gratitude item |
| POST | `/api/v1/mood/` | Log a mood |
| GET | `/api/v1/mood/heatmap`, `/api/v1/mood/trends` | Mood history |
| POST | `/api/v1/screener/` | Submit a GAD-2 / PHQ-2 check-in |
| GET | `/api/v1/screener/history` | Past check-ins |
| GET | `/health` | Liveness |
| GET | `/wake` | No-I/O probe used by the frontend warm-up banner |
| GET | `/keepalive` | Wakes the API and pings Postgres (503 if the DB is unreachable) |

Interactive docs are served at `/docs` unless `ENVIRONMENT=production`. Rate limits are
in-memory and per user (`RATE_LIMIT_*`, defaults 20 analyses and 30 chat messages a minute).

## Data model

Four user-owned tables, each protected by RLS policies keyed on `auth.uid()`:
`journal_entries`, `mood_logs`, `gratitude_snippets`, `screener_results`. Schema changes are
versioned in `supabase/migrations/`.

## Running on free tiers

| Concern | Approach |
|---|---|
| Render sleeps after ~15 min idle | A Supabase `pg_cron` job (`senti-mind-keepalive`) calls `/keepalive` every 10 minutes through `pg_net`; `.github/workflows/keep-alive.yml` is a backup. The frontend probes `/wake` and shows a banner while the API is cold. |
| Supabase pauses idle projects | `/keepalive` makes a small anonymous read, cached for 60 s. |
| 512 MB RAM, no GPU | INT8 ONNX models, a single worker, and no PyTorch at runtime. |
| Zero-config redeploys | The ONNX models are committed (~160 MB) and verified by SHA-256 at load. |
| LLM credit | OpenRouter free model slugs with a fallback chain; `max_tokens` is always sent so low-balance accounts are not refused. |

CORS headers are added even to unhandled 500 responses (`ForceCORSMiddleware` in
`main.py`), and the 500 body never includes exception text.

## Frontend

React 18, React Router 7, Tailwind CSS, Recharts. Pages are lazy-loaded under
`layouts/DashboardLayout.jsx` behind `ProtectedRoute`; heavy libraries (Recharts, jsPDF)
load on demand.

| Directory | Contents |
|---|---|
| `src/pages/` | Route components |
| `src/layouts/` | Authenticated shell: sidebar, mobile nav, quick exit |
| `src/components/` | Shared UI: crisis banner, emotion chart, SentiBot avatar and loader |
| `src/lib/` | Pure, unit-tested logic: crisis rules, chat history, dates, error messages |
| `src/services/` | Axios API clients that attach the Supabase JWT |
| `src/constants/` | Crisis contacts and category colours (single source for each) |

Pressing Escape twice leaves the app immediately (`hooks/useQuickHide.js`). Dates sent to
the API are the user's local calendar date, never UTC.

## Configuration

One `.env` at the repository root serves both halves (`vite.config.js` sets
`envDir: "../"`; `app/core/config.py` reads `.env` or `../.env`). Every variable is
documented in [`.env.example`](../.env.example).
