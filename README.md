# SENTI-MIND

**SentiMind** is an intelligent AI-powered mental health companion designed to analyze text and detect emotional states, clinical risks (depression, anxiety, stress, bipolar disorder, personality disorders, and suicidal ideation), and provide empathetic, actionable guidance. It features a comprehensive tracking system to monitor your mental wellness journey over time.

## 📋 Features

### Core Analysis Pipeline
1. **Text Preprocessing**: Removes noise, normalizes text, and translates emojis into meaningful words
2. **Emotion Detection**: Uses HuggingFace's j-hartmann/emotion-english-distilroberta-base model to detect 7 emotions (anger, disgust, fear, joy, neutral, sadness, surprise)
3. **Clinical Classification**: Custom-trained LinearSVC machine learning model identifies clinical indicators:
   - Depression
   - Anxiety
   - Suicidal ideation
   - Stress
   - Bipolar disorder
   - Personality disorder
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
- **ML**: scikit-learn 1.8.0 (calibrated LinearSVC over TF-IDF), joblib, numpy. The scikit-learn pin must match the version the model artifacts were trained with.
- **Database & auth**: Supabase Python client (JWTs are verified through Supabase; queries run under Row-Level Security)
- **HTTP client**: httpx
- **Testing**: pytest, pytest-asyncio
- **Training only**: pandas

### AI/ML Components
- **Emotion Detection**: HuggingFace Inference API (j-hartmann/emotion-english-distilroberta-base)
- **Clinical Classifier**: Custom-trained LinearSVC with TF-IDF features
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
- `GET /wake` - Lightweight keep-alive (no inference), used to warm up the Render free-tier instance

Interactive API docs are served at `/docs` (disabled when `ENVIRONMENT=production`).

---

## 🔬 Machine Learning Models

### Clinical Classifier Training
The training data is **synthetic**: 3,841 unique hand-written / template-generated
sentences in `backend/scripts/training_data/` (476–621 per class), across:
- Depression
- Anxiety
- Suicidal ideation
- Stress
- Bipolar disorder
- Personality disorder
- Normal/Healthy

Features engineered with:
- **TF-IDF Vectorization**: 1–2 grams, 15K features (chosen by grid search)
- **Negation Handling**: 3-word scoped negation (e.g., `not very happy` → `NEG_very NEG_happy`)
- **Crisis Indicators**: Weighted crisis keywords and past-tense recovery context handling
- **Class balancing**: `class_weight="balanced"`
- **Calibration**: Sigmoid calibration for probability estimates

### Evaluation (model v5)
Many sentences are near-duplicates of each other (shared templates), so a random
train/test split overstates accuracy: about 26% of random-split test rows have a
≥60%-word-overlap twin in the training set. The evaluation therefore:
- clusters near-duplicates (token Jaccard ≥ 0.6) into groups and holds out ~20% of the
  data with `StratifiedGroupKFold`, so no group is split across train and test
  (0 near-duplicates between them);
- tunes hyper-parameters with group-aware 5-fold CV on the training split only;
- keeps the 51 adversarial cases (`scripts/eval_cases.py`) and the sentences used in
  `tests/test_classifier.py` out of the training data.

| Metric (held-out, group split) | Value |
|---|---|
| Macro F1 | 0.767 |
| Accuracy | 0.773 |
| Grouped 5-fold CV macro F1 (train split) | 0.759 ± 0.027 |
| Adversarial spot-check | 46/51 (37/42 on cases with no near-duplicate in train) |

Per-class F1 ranges from 0.52 (Depression, often confused with Personality disorder
and Bipolar) to 0.91 (Anxiety). Full metrics, the confusion matrix, leakage statistics,
library versions, the git commit and SHA-256 hashes of the data and artifacts are in
`backend/data/model_metadata.json`.

> [!WARNING]
> These numbers measure performance on synthetic sentences that resemble the training
> data. They say nothing about real-world text, and **the model is not clinically
> validated**. Its output is a signal for the app's risk engine, not a diagnosis.

The previous README figures (87.1% macro F1, 96% adversarial) did not match the
shipped v4 artifacts, whose own metadata reported 0.795 macro F1 and 43/51 on a random
split with near-duplicate and verbatim eval-sentence leakage.

To retrain (from `backend/`, with `requirements-train.txt` installed):
```bash
cd scripts && python generate_training_data.py && cd ..
python scripts/train_model.py
pytest tests/test_classifier.py
```

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