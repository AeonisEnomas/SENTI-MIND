# SENTI-MIND

**SentiMind** is an intelligent AI-powered mental health companion designed to analyze text and detect emotional states, clinical indicators (depression, anxiety, stress, and suicidal ideation), and provide empathetic, actionable guidance. It features a comprehensive tracking system to monitor your mental wellness journey over time.

## 📋 Features

### Core Analysis Pipeline
1. **Text Preprocessing**: Removes noise, normalizes text, and translates emojis into meaningful words
2. **Emotion Detection**: Local ONNX export of HuggingFace's j-hartmann/emotion-english-distilroberta-base (7 emotions: anger, disgust, fear, joy, neutral, sadness, surprise) — no API token, no per-call cost
3. **Clinical Classification**: Local fine-tuned transformer (distilroberta, INT8 ONNX) — also a calibrated LinearSVC fallback — identifies clinical indicators:
   - Depression
   - Anxiety
   - Suicidal ideation
   - Stress
   - Normal/Healthy
4. **Risk Assessment**: Real-time crisis keyword detection for immediate intervention
5. **AI-Powered Insights**: LLM generates warm, empathetic responses with actionable coping strategies

### User Features
- **Journal Entries**: Save and track detailed mood analyses with full pipeline results
- **Gratitude Snippets**: Extract and collect positive moments from your entries
- **Mood Heatmap**: Visualize emotional trends over the last 30 days
- **Mood Trends**: Track progression and patterns across customizable time periods (7, 14, 30+ days)
- **Clinical Screening**: GAD-2 and PHQ-2 standardized assessment tools
- **Mental Health Tracking**: Complete history of all analyses with timestamps and confidence scores

## 👤 Team

- **Abdullah Mushtaq** (23L-0892)

## 🛠 Tech Stack

### Frontend
- **Framework**: React 18.3
- **Build Tool**: Vite 5.2
- **Styling**: TailwindCSS 3.4 with glassmorphism UI
- **Routing**: React Router DOM 7.14
- **Charting**: Chart.js, Recharts 2.15
- **HTTP**: Axios 1.15
- **PDF Export**: jsPDF 4.2, html2canvas 1.4
- **Icons**: Lucide React 1.8
- **Database**: Supabase (PostgreSQL)

### Backend
Exact versions are pinned in `backend/requirements.txt` (runtime),
`backend/requirements-dev.txt` (tests) and `backend/requirements-train.txt` (retraining).
- **Runtime**: Python 3.11 or 3.12
- **Framework**: FastAPI, served by Uvicorn
- **Validation / settings**: Pydantic 2, pydantic-settings
- **NLP**: spaCy 3.8 with `en_core_web_sm` (installed from `requirements.txt`)
- **ML**: scikit-learn 1.8.0 (calibrated LinearSVC over TF-IDF, v7 fallback), onnxruntime (v9 transformer inference), joblib, numpy
- **Database & auth**: Supabase Python client (JWTs are verified through Supabase; queries run under Row-Level Security)
- **HTTP client**: httpx
- **Testing**: pytest, pytest-asyncio
- **Training only**: pandas

### AI/ML Components
- **Emotion Detection**: HuggingFace Inference API (j-hartmann/emotion-english-distilroberta-base)
- **Clinical Classifier**: v9 — distilroberta fine-tuned at max_length=512 on the balanced SWMH+Dreaddit corpus with temperature-scaled softmax (INT8 ONNX, local); v7 — calibrated LinearSVC with TF-IDF (shipped as fallback; `CLASSIFIER_BACKEND=sklearn|auto|onnx`)
- **LLM Insights & Chat Agent**: OpenRouter API (default `google/gemini-3.1-flash-lite-preview`, configurable via `OPENROUTER_MODEL`)
- **NER (Named Entity Recognition)**: spaCy pipeline

### Database Schema
- **journal_entries**: Store raw text, analysis results, clinical category, risk level
- **mood_logs**: Track daily mood classifications and risk assessments
- **gratitude_snippets**: Collect positive moments from entries
- **screener_results**: Store GAD-2 and PHQ-2 assessment responses and scores
- **user_auth**: Secure user authentication with Supabase

---

## 🚀 How to Run

### 🌍 Live Application (Deployed)
Access the fully functional app instantly without installation:
👉 **[SentiMind Live Web App](https://senti-mind-mocha.vercel.app/)**

### ☁️ Deploying for $0 (Vercel + Render + Supabase)

The stack is designed to run entirely on free tiers:

1. **Supabase** (auth + Postgres): free project. The `pg_cron` keep-alive job already prevents the 7-day inactivity pause; keep it enabled. Use the **anon public key**, never the service-role key.
2. **Render** (FastAPI backend): free web service, Docker runtime with `rootDir: backend` (`backend/Dockerfile` bakes the local ONNX emotion model in at build time — no HuggingFace token needed). Set `ENVIRONMENT=production`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `OPENROUTER_API_KEY`, and `ALLOWED_ORIGINS=https://<your-vercel-app>.vercel.app`. `render.yaml` is a ready-made Blueprint. Health check path: `/health`.
   - Native Python runtime works too — in that case set the Render **build command** to `pip install -r requirements.txt && python scripts/download_emotion_model.py`, or emotions will report themselves unavailable (by design, never fabricated).
   - Free instance: 0.1 CPU / 512 MB, spins down after ~15 min idle (~1 min cold start), 750 instance-hours/month, ephemeral disk. `.github/workflows/keep-alive.yml` pings `/keepalive` every 10 min to keep it warm.
3. **Vercel** (frontend): free Hobby tier. `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_API_URL=https://<your-render-service>.onrender.com/api/v1`.
4. After any deploy: confirm `https://<render-service>/health` returns `{"status":"ok"}` and `/keepalive` returns a `database: ok` payload.

**Reality check:** this is a demo-grade deployment — cold starts, no SLA, rate-limited free LLM capacity, and every license in the stack (Vercel Hobby, CC-BY training data, free LLM slugs) is non-commercial. A public/commercial launch needs a paid Render instance (~$7/mo, no spin-down), paid model capacity, and commercially-licensed training data.

### 💻 Running Locally

#### Prerequisites
> [!CAUTION]
> **Python 3.11 or 3.12 required.** Python 3.10 and below, or 3.14+ are currently NOT supported by core ML dependencies.

#### Quick start (Linux/macOS)

```bash
./start.sh
```

This picks Python 3.11/3.12 (via `uv` if installed), creates `backend/.venv`, installs
`backend/requirements.txt`, copies `.env.example` to `.env` if missing, installs frontend
packages and starts both servers. Fill in `.env` before using the app.

#### 1️⃣ Backend Setup

1. Navigate to the backend folder:
   ```bash
   cd backend
   ```

2. Create and activate a virtual environment with Python 3.11 or 3.12 (Windows):
   ```bash
   py -3.11 -m venv .venv
   .venv\Scripts\activate
   ```
   
   Or on macOS/Linux:
   ```bash
   python3.11 -m venv .venv
   source .venv/bin/activate
   ```

3. Install dependencies (this also installs the spaCy `en_core_web_sm` model):
   ```bash
   pip install -r requirements.txt
   # for running the tests:
   pip install -r requirements-dev.txt
   # for regenerating data / retraining the classifier:
   pip install -r requirements-train.txt
   ```

4. Configure environment variables: copy `.env.example` (repo root) to `.env` in the
   repo root and fill it in. A single `.env` serves both the backend and the frontend;
   every variable is documented in [`.env.example`](.env.example). At minimum you need
   `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`;
   `HF_API_TOKEN` and `OPENROUTER_API_KEY` enable emotion detection and LLM insights/chat
   (the pipeline degrades gracefully without them).

5. Run the tests (from `backend/`):
   ```bash
   pytest
   ```

6. Start the FastAPI server:
   ```bash
   .\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
   ```
   Or on macOS/Linux:
   ```bash
   python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
   ```

#### 2️⃣ Frontend Setup

Open a **new** terminal window and run:

1. Navigate to the frontend folder:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open your browser and navigate to: `http://localhost:5173`

🎉 **You're all set!** The app is now running with both frontend and backend.

---

## 📊 API Endpoints

### Analysis
- `POST /api/v1/analysis/` - Analyze text and get full pipeline results

### Chat Agent
- `POST /api/v1/chat/` - Chat with the Senti-Agent (LLM via OpenRouter)

### Journal
- `POST /api/v1/journal/` - Save journal entry
- `GET /api/v1/journal/` - List journal entries
- `GET /api/v1/journal/{entry_id}` - Get specific entry
- `DELETE /api/v1/journal/{entry_id}` - Delete entry
- `POST /api/v1/journal/gratitude/` - Save gratitude snippet
- `GET /api/v1/journal/gratitude/` - List gratitude snippets
- `DELETE /api/v1/journal/gratitude/{snippet_id}` - Delete gratitude snippet

### Mood Tracking
- `POST /api/v1/mood/` - Log mood
- `GET /api/v1/mood/heatmap` - Get 30-day mood heatmap
- `GET /api/v1/mood/trends` - Get mood trends with line chart data

### Clinical Screening
- `POST /api/v1/screener/` - Submit GAD-2/PHQ-2 assessments
- `GET /api/v1/screener/history` - View screening history

### Health Check
- `GET /health` - API health status and CORS configuration
- `GET /wake` - Instant no-I/O probe, used by the frontend warm-up banner
- `GET /keepalive` - Scheduled keep-alive: wakes the Render instance and runs a tiny Supabase query so the free-tier project isn't paused (pinged every 10 min by a Supabase `pg_cron` job, with `.github/workflows/keep-alive.yml` as a backup)

Interactive API docs are served at `/docs` (disabled, along with `/redoc` and `/openapi.json`, when `ENVIRONMENT=production`). `/analysis/` and `/chat/` are rate-limited per user (`RATE_LIMIT_*` in `.env.example`).

---

## 🔬 Machine Learning Models

### Clinical Classifier Training
The training data is **synthetic**: 2,779 unique hand-written / template-generated
sentences in `backend/scripts/training_data/` (516–621 per class), across:
- Depression (516)
- Anxiety (561)
- Suicidal ideation (524)
- Stress (621)
- Normal/Healthy (557)

(Bipolar and Personality Disorder were removed in v6: short journal texts don't carry
enough information to distinguish them — even transformer classifiers systematically
confuse them.)

Features engineered with:
- **TF-IDF Vectorization**: 1–3 grams, 15K features (chosen by grid search)
- **Negation Handling**: 3-word scoped negation (e.g., `not very happy` → `NEG_very NEG_happy`)
- **Crisis Indicators**: Weighted crisis keywords and past-tense recovery context handling
- **Class balancing**: `class_weight="balanced"`
- **Calibration**: Sigmoid calibration for probability estimates

### Evaluation (models v7, v8 & v9)

The synthetic corpus caps the classifier, so v7 trains on **real-world text**:
2,779 synthetic rows + 50,175 real Reddit rows (SWMH for Depression/Anxiety/Suicidal
and offmychest→Normal; Dreaddit for Stress), downsampled per class to ≤6,000 for
balance (25,471 unique rows after de-duplication; 19,059 train / 2,118 val / 5,294 test).
Groups from token-Jaccard ≥ 0.6 near-duplicate clustering are never split across
train/test (union-find over a rarest-token blocking index — all-pairs is infeasible
at this size); hyper-parameter search uses group-aware 5-fold CV on the training
split only. Caveats live in `model_metadata.json`: subreddit-membership labels are
weak supervision, the sources are CC-BY-NC research-use only, and **the model is not
clinically validated**.

**v8** fine-tunes `distilroberta-base` on the *same* group-aware split (see `docs/FINE_TUNING.md` for the full recipe). **v9** extends that recipe to **max_length=512** and ships temperature-scaled softmax (fit on the val fold) for honest `confidence_tier` bands — it is what `CLASSIFIER_BACKEND=auto` selects:

| Metric (held-out fold 0) | v7 (sklearn) | v8 (transformer-256) | **v9 (transformer-512)** |
|---|---|---|---|
| Macro F1 | 0.645 | 0.722 | **0.742** |
| Accuracy | 0.664 | 0.714 | **0.734** |
| Anxiety F1 | 0.78 | 0.82 | **0.84** |
| Depression F1 | 0.56 | 0.57 | **0.60** |
| Normal F1 | 0.64 | 0.69 | 0.71 |
| Stress F1 | 0.53 | 0.80 | **0.81** |
| Suicidal recall | 0.73 | 0.75 | **0.77** |
| Adversarial spot-check | 29/39 | 30/39 | **36/39** |

Per-class F1 wins where it matters most (Stress recall 0.44 → **0.88** with v9); v9 ships by default when present, v7 remains the sklearn fallback.

> [!IMPORTANT]
> v6's flattering numbers (macro F1 0.814, adversarial 35/39) were measured on
> synthetic text the model was trained and tuned on — it scored **0.401 macro F1 on
> real Reddit rows**. v7/v8's lower numbers are the honest cost of real data. Do not
> quote v6-style figures for these artifacts.

Known limitations (also in `DOCUMENTATION.md`):
- v9 (raw text) reads distress priors hard: negation examples like
  "I don't want to die, I just need a break" and "no longer depressed thanks to support"
  are predicted as Suicidal/Depression respectively (over-alerting; the deterministic
  crisis-keyword gate is unaffected by model choice). v7 handled these via
  NEG_-scoped preprocessing.
- v7/v8/v9 Reddit priors would classify classroom discussion of suicide (e.g.
  "we discussed suicide prevention in psych class") as distress — v9 gets that one right, the earlier ones did not;
  one right, v7 does not.
- Stress recall is weak for v7 (0.44); v9 lifts it to 0.88.
- Reddit ≠ journal entries. These numbers are a proxy for, not a measurement of,
  journal-writing performance.

> [!WARNING]
> These numbers are weak-supervision community labels, not clinical ground truth, and
> Reddit ≠ journal entries. The model is **not clinically validated**. Its output is a
> signal for the app's risk engine, not a diagnosis.

The previous README figures (87.1% macro F1, 96% adversarial) did not match the
shipped v4 artifacts, whose own metadata reported 0.795 macro F1 and 43/51 on a random
split with near-duplicate and verbatim eval-sentence leakage.

The committed v7 artifacts were trained on the mixed corpus below — reproduce with:
```bash
cd scripts && python generate_training_data.py && cd ..          # synthetic pool
python scripts/ingest_external.py --swmh external/swmh --dreaddit external/dreaddit \
    --out "data/Combined Data (mixed).csv" --merge               # real data + merge
# downsampled per class to ≤6000 rows (seed 314) → data/Combined Data (balanced).csv
python scripts/train_model.py "data/Combined Data (balanced).csv"
pytest tests/test_classifier.py
```
A plain `python scripts/train_model.py` (no argument) retrains a **synthetic-only**
model from `data/Combined Data.csv` — useful for experiments, but its metrics will
echo v6-era synthetic flattery, not real-world performance.

### Training with real-world data (v7)

The synthetic corpus caps the classifier — more compute won't fix it; only real text will.
Two free, real, research-grade Reddit corpora fit the 5-class label set:

| Dataset | Size | License/terms |
|---|---|---|
| [SWMH](https://huggingface.co/datasets/AIMH/SWMH) — "Reddit SuicideWatch and Mental Health Collection" (Ji et al., 2022) | ~54k posts: depression, anxiety, suicidewatch, offmychest (→ Normal), bipolar (dropped) | CC-BY-NC, **research-use only**, gated by HF terms + institutional email |
| [Dreaddit](http://www.cs.columbia.edu/~eturcan/data/dreaddit.zip) (Turcan & McKeown, 2019, LOUHI) | 3,553 posts, binary stress (1,857 stress / 1,696 non-stress), official Columbia zip | Research use |

At ingest time, `scripts/ingest_external.py` normalizes labels, drops out-of-scope classes
and duplicates, and writes the merged CSV plus a `.manifest.json`; `train_model.py` reads
that manifest and records provenance + license caveats in `model_metadata.json` automatically.

**Caveats you cannot engineer away:** these are community-membership labels (weak supervision),
not clinical ground truth; both corpora are non-commercial and research-only; Reddit ≠ journal
entries. The real numbers are in the v7 evaluation table above — they're lower than v6's
synthetic ones, and they're the honest ones.

---

## 🔒 Security Features

- **Authentication**: Supabase Auth; the backend verifies each request's Supabase JWT
- **CORS Protection**: Configured for frontend and deployment origin
- **Environment Secrets**: API keys stored in `.env` (never committed; see `.env.example`)
- **Model integrity**: classifier artifacts are checked against the SHA-256 hashes in `model_metadata.json` before loading
- **Input Validation**: Pydantic models for all requests
- **Database Security**: Row-level security with Supabase

---

## 📝 License

This project is open source. Check the repository for license details.

---

## 🆘 Crisis Support

If you're experiencing a mental health crisis, please reach out to:
- **Umang Mental Health Helpline (Pakistan)**: 042 3576 5951
- **Rescue 1122 (Pakistan emergency services)**: 1122
- **Outside Pakistan**: find a local crisis line in the International Association for Suicide Prevention directory: https://www.iasp.info/resources/Crisis_Centres/

These are the same resources the app shows in its crisis banner and chat agent.

**SentiMind is a support tool, not a replacement for professional mental health care.**