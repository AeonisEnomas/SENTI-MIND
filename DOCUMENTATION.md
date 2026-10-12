# SENTI-MIND Project Documentation

## Project Overview

SENTI-MIND is an AI-powered mental health text analysis application that detects emotional states and clinical risks (depression, anxiety, suicidal thoughts, etc.) and provides compassionate AI-generated coping strategies.

**Repository:** https://github.com/AeonisEnomas/SENTI-MIND

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                               FRONTEND (React + Vite)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────────┐ │
│  │ EmotionChart │  │  RiskBadge   │  │ InsightModal │  │  AnalysisForm  │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       │ HTTP POST /api/v1/analysis/
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              BACKEND (FastAPI)                             │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                           API Layer (app/api/analysis.py)               │ │
│  │  POST /api/v1/analysis/ → analyze_text()                              │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                    │                                        │
│  ┌─────────────────────────────────┼─────────────────────────────────────┐ │
│  │                    Service Pipeline (Parallel/Sync)                  │ │
│  │                                                                     │ │
│  │   ┌──────────────┐ ┌──────────────┐ ┌──────────────┐              │ │
│  │   │ Preprocessor │ │    NER       │ │   Clinical   │              │ │
│  │   │ (clean_text) │ │ (extract)    │ │  Classifier  │              │ │
│  │   └──────────────┘ └──────────────┘ │ (predict)    │              │ │
│  │                                     └──────────────┘              │ │
│  │   ┌──────────────┐ ┌──────────────┐ ┌──────────────┐              │ │
│  │   │    Emotion   │ │  Risk Engine │ │     LLM      │              │ │
│  │   │  (detect)    │ │  (assess)    │ │  (insight)   │              │ │
│  │   └──────────────┘ └──────────────┘ └──────────────┘              │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────────┐│
│  │                         Model Layer                                   ││
│  │  ┌─────────────────┐  ┌──────────────────┐  ┌──────────────────┐   ││
│  │  │ LinearSVC +     │  │ HuggingFace      │  │ OpenRouter       │   ││
│  │  │ TF-IDF (v5)     │  │ distilroberta    │  │ gemini-flash-lite│   ││
│  │  └─────────────────┘  └──────────────────┘  └──────────────────┘   ││
│  └────────────────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

### Frontend
| Technology | Version | Purpose |
|------------|---------|---------|
| React | 18.x | UI framework |
| Vite | 4.x | Build tool & dev server |
| TailwindCSS | 3.x | Styling |
| Recharts | 2.x | Radar chart for emotions |
| Lucide React | Latest | Icons |

### Backend
| Technology | Version | Purpose |
|------------|---------|---------|
| Python | 3.11 or 3.12 | Runtime (≤3.10 and 3.14+ are not supported by the ML deps) |
| FastAPI | 0.143 | Web framework |
| Uvicorn | 0.54 | ASGI server |
| scikit-learn | 1.8.0 (exact) | LinearSVC, TF-IDF, CalibratedClassifierCV; must match the artifacts |
| spaCy | 3.8 + `en_core_web_sm` 3.8.0 | Named Entity Recognition |
| httpx | 0.28 | Async HTTP client |
| joblib | 1.6 | Model serialization |
| numpy | 2.4 | Numerical operations |
| supabase | 2.32 | Auth verification + RLS-scoped DB access |
| pandas | 3.0 | Training only (`requirements-train.txt`) |

Exact pins live in `backend/requirements.txt` (runtime), `requirements-dev.txt`
(adds pytest, pytest-asyncio) and `requirements-train.txt` (adds pandas).

### External APIs
| Service | Model/Endpoint | Purpose |
|---------|---------------|---------|
| HuggingFace | `j-hartmann/emotion-english-distilroberta-base` | 7-class emotion detection |
| OpenRouter | `google/gemini-3.1-flash-lite-preview` (default, `OPENROUTER_MODEL`) | LLM insight generation + chat agent |

---

## File Structure

```
SENTI-MIND/
├── backend/                              # FastAPI Python backend
│   ├── app/
│   │   ├── main.py                       # FastAPI app entry point
│   │   ├── api/
│   │   │   ├── analysis.py               # POST /api/v1/analysis/ (full pipeline)
│   │   │   ├── chat.py                   # POST /api/v1/chat/ (Senti-Agent)
│   │   │   └── journal.py, mood.py, screener.py, auth_middleware.py
│   │   ├── core/
│   │   │   ├── config.py                 # Settings (env vars)
│   │   │   ├── constants.py              # Thresholds, categories
│   │   │   └── preprocessing.py          # Shared ML text preprocessor
│   │   ├── models/
│   │   │   ├── classifier.py             # ClinicalClassifier (LinearSVC, hash-verified load)
│   │   │   ├── emotions.py               # HuggingFace emotion detection
│   │   │   ├── llm.py                    # OpenRouter insight generation
│   │   │   └── schemas.py                # Pydantic request/response models
│   │   └── services/
│   │       ├── ner.py                    # spaCy entity extraction
│   │       ├── preprocessor.py           # Base Text cleaning (Emoji handling)
│   │       └── risk_engine.py            # Enhanced risk assessment
│   ├── data/                             # Model artifacts & training data
│   │   ├── Combined Data.csv             # Generated, gitignored (3,841 unique synthetic sentences)
│   │   ├── sentiment_model.joblib        # Calibrated LinearSVC (v5)
│   │   ├── vectorizer.joblib             # TF-IDF vectorizer (v5)
│   │   └── model_metadata.json           # Metrics, leakage stats, versions, SHA-256 hashes
│   ├── scripts/
│   │   ├── generate_training_data.py     # Writes every unique pool sentence once
│   │   ├── train_model.py                # Group-aware split, grouped CV grid search
│   │   ├── eval_cases.py                 # 51 held-out adversarial cases + leakage helpers
│   │   ├── keep_alive.py                 # Pings /wake (needs an external scheduler)
│   │   └── training_data/                # Modular class data files
│   ├── tests/
│   │   ├── test_preprocessor.py          # Preprocessor unit tests
│   │   ├── test_emotions.py              # Emotion detection tests
│   │   ├── test_classifier.py            # Classifier + artifact integrity tests
│   │   ├── test_openrouter.py            # LLM client tests
│   │   └── test_risk_engine.py           # Risk engine tests
│   ├── requirements.txt                  # Runtime deps (pinned, incl. spaCy model)
│   ├── requirements-dev.txt              # + pytest
│   └── requirements-train.txt            # + pandas
├── frontend/                             # React + Vite frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── EmotionChart.jsx        # Radar chart (Recharts)
│   │   │   ├── InsightModal.jsx        # AI insight display
│   │   │   └── RiskBadge.jsx           # Risk level indicator
│   │   ├── hooks/
│   │   │   └── useAnalysis.js          # React hook for API calls
│   │   ├── pages/                      # Journal, Chat, History, Screener, ... (behind ProtectedRoute)
│   │   ├── services/
│   │   │   └── *Service.js             # Axios clients (attach the Supabase JWT)
│   │   ├── App.jsx                     # Main app component
│   │   └── main.jsx                      # Entry point
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
└── docs/                                 # Documentation
    ├── DATA_VISUALIZATION_STRATEGY.md    # UI/UX guidelines
    └── deliverables/                     # University deliverables
```

---

## Component Details

### 1. Analysis Pipeline (`app/api/analysis.py`)

**Entry Point:** `POST /api/v1/analysis/`

**Flow:**
1. Receive `AnalysisRequest` (text input)
2. Preprocess text (`clean_text` in `services.preprocessor` replaces emojis)
3. Run parallel analysis:
   - **Emotions**: `detect_emotions()` → HuggingFace API
   - **Clinical**: `classifier.predict()` → Local LinearSVC
   - **NER**: `extract_entities()` → spaCy
4. Calculate **Risk**: `assess_risk()` combines clinical + emotions + keywords
5. Generate **Insight**: `generate_insight()` → OpenRouter LLM
6. Return `AnalysisResponse`

---

### 2. Clinical Classifier (`app/models/classifier.py`, model v5)

**Class:** `ClinicalClassifier`

**Behaviour:**
- **Shared Preprocessor**: Uses `app.core.preprocessing` to guarantee inference matches training.
- **Confidence Tiers**: `category` is always the top class. `confidence_tier` is `"high"` (≥ 0.70), `"medium"` (≥ 0.35) or `"low"` (< 0.35); a low tier does **not** change the category to "Uncertain". Callers (risk engine, frontend) read the tier.
- **Ambiguity Detection**: Sets `is_ambiguous = True` (and `alternative_category`) if the top two classes are within 0.10 probability.
- **Insufficient Content Filter**: Fewer than 3 meaningful words returns `"Insufficient"`; empty input returns `"Unknown"`.
- **Artifact integrity**: At load, the SHA-256 of the model and vectorizer is checked against `model_metadata.json`; on mismatch the classifier logs an error and refuses to load (the check is skipped with a warning if the metadata has no hashes). A warning is logged if the installed scikit-learn differs from the training version. The log line shows the metadata's `model_version`.

**Pipeline:**
1. **Preprocessing**:
   - Lowercase, strip punctuation
   - Contraction expansion (`"can't"` → `"cannot"`)
   - Negation scoping (3-word window): `"not very happy"` → `NEG_very NEG_happy`
   - Intensity & temporal marker addition
2. **Vectorization**: TF-IDF (1-2 ngrams, 15K features, chosen by grid search)
3. **Classification**: Calibrated LinearSVC → probability estimates

**Output:**
```python
{
    "category": "Stress",
    "confidence": 0.876,
    "top_categories": [
        {"category": "Stress", "confidence": 0.876},
        {"category": "Anxiety", "confidence": 0.123},
        ...
    ],
    "is_ambiguous": False,
    "alternative_category": None,
    "confidence_tier": "high"
}
```

**Model Files:**
- `data/sentiment_model.joblib`
- `data/vectorizer.joblib`
- `data/model_metadata.json`

**Training:** see [Training Pipeline](#training-pipeline).

---

### 3. Emotion Detection (`app/models/emotions.py`)

**API:** HuggingFace Inference API (`j-hartmann/emotion-english-distilroberta-base`)

**Emoji Support**: Relies on `clean_text` to expand emojis (e.g. 😭 -> "heavy sobbing") before sending the payload.

---

### 4. Risk Engine v3 (`app/services/risk_engine.py`)

**Function:** `assess_risk(text, emotions, clinical) → dict`

**Enhancements over previous versions:**
- **Graduated Keyword Scoring**: "suicide plan" (1.0) scores higher than "hopeless" (0.3).
- **Negation Awareness**: "I am NOT suicidal" dynamically slashes the keyword risk weight by 85%.
- **Temporal Awareness**: Past-tense indicators ("I was suicidal last year") drastically lower the risk score.
- **Context-based Weighting**: The weighting between clinical confidence and keyword scoring shifts depending on context (e.g., if keywords are present but the classifier says "Normal", keywords get a higher weighting to ensure safety).

**Output:**
```python
{
    "level": "high",          # low | medium | high | critical
    "score": 0.85,
    "triggers": ["suicide", "hopeless"],
    "safety_protocol": True   # If suicidal confidence > 0.70
}
```

---

### 5. Schemas (`app/models/schemas.py`)

**Key Models:**

```python
class AnalysisResponse(BaseModel):
    raw_text: str
    preprocessed_text: str
    emotions: List[EmotionResult]       # From HuggingFace
    clinical: ClinicalResult            # From LinearSVC (includes is_ambiguous)
    entities: List[EntityResult]        # From spaCy
    risk: RiskAssessment                # Calculated
    insight: str                        # From LLM
```

---

## Configuration (`.env`)

A single `.env` at the **repo root** serves both halves (`vite.config.js` sets
`envDir: "../"`; `app/core/config.py` reads `.env` or `../.env`). Copy
[`.env.example`](.env.example), which documents every variable:

- Backend: `HF_API_TOKEN`, `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `OPENROUTER_MAX_TOKENS`,
  `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `ALLOWED_ORIGINS`, `ENVIRONMENT`, optional
  rate limits, `SENTIMIND_MODEL_PATH` / `SENTIMIND_VECTORIZER_PATH`.
- Frontend: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (required), `VITE_API_URL`.

---

## Training Pipeline

### Data Format (`data/Combined Data.csv`)

Generated by `scripts/generate_training_data.py` from the modular `scripts/training_data/`
package. Every unique sentence (after case/punctuation normalisation) is written once;
any sentence that matches a held-out evaluation sentence (`scripts/eval_cases.py` or a
`classifier.predict("...")` call in `tests/test_classifier.py`) is dropped.

**Total:** 3,841 synthetic samples across 7 classes (476–621 per class, including hard
negatives to prevent keyword overfitting). Imbalance is handled with
`class_weight="balanced"`. This is not clinical data.

### Training Script (`scripts/train_model.py`)

1. Clusters near-duplicate sentences (token Jaccard ≥ 0.6, union-find) into groups.
2. Holds out ~20% as a test set with `StratifiedGroupKFold`, so no group spans train and test.
3. Grid-searches `C`, n-gram range and `max_features` with group-aware 5-fold CV **on the
   training split only**.
4. Fits the final model on the training split (the saved artifact is the one the test
   metrics describe), evaluates it on the test set and on the 51 adversarial cases.
5. Writes the artifacts and `model_metadata.json` (metrics, confusion matrix, leakage
   check, Python/scikit-learn versions, git commit, SHA-256 of the CSV and artifacts).

### Current results (v5)

| | v4 (previous, random split) | v5 (group split) |
|---|---|---|
| Held-out macro F1 | 0.795 | 0.767 |
| Held-out accuracy | 0.795 | 0.773 |
| CV macro F1 | 0.792 ± 0.029 (10-fold, included test rows) | 0.759 ± 0.027 (grouped 5-fold, train only) |
| Adversarial spot-check | 43/51 (8 cases were in the training data) | 46/51 (37/42 without a train near-duplicate) |
| Test rows with a near-duplicate in train | ~26% | 0% |

Weakest class: Depression (F1 0.52), confused with Personality disorder and Bipolar.
These are metrics on synthetic text; **the classifier is not clinically validated.**

After any change to `app/core/preprocessing.py` or the training data, regenerate, retrain
and run `pytest tests/test_classifier.py`; keep `scikit-learn` in `requirements.txt` equal
to the `environment.sklearn_version` recorded in the metadata.

---

## API Endpoints

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/v1/analysis/` | Full analysis pipeline |
| POST | `/api/v1/chat/` | Senti-Agent chat (OpenRouter) |
| POST/GET | `/api/v1/journal/`, `/api/v1/journal/{entry_id}`, `/api/v1/journal/gratitude/` | Journal entries and gratitude snippets |
| POST/GET | `/api/v1/mood/`, `/api/v1/mood/heatmap`, `/api/v1/mood/trends` | Mood logging and charts |
| POST/GET | `/api/v1/screener/`, `/api/v1/screener/history` | GAD-2 / PHQ-2 screeners |
| GET | `/health` | Status + allowed CORS origins |
| GET | `/wake` | No-inference keep-alive for Render cold starts |

---

## Crisis Resources

The app's crisis banner and chat agent point to Pakistan services:
- **Umang Mental Health Helpline**: 042 3576 5951
- **Rescue 1122** (emergency services): 1122
- Elsewhere: the IASP crisis centre directory, https://www.iasp.info/resources/Crisis_Centres/

---

## Security Considerations

1. **CORS**: Configured in `main.py` via `ALLOWED_ORIGINS`
2. **API Keys**: Stored in `.env`, never committed
3. **Input Validation**: Pydantic schemas validate requests
4. **Safety Protocol**: Hardcoded at 70% suicidal threshold

---

**Last Updated:** October 2026
**Version:** Classifier v5 (group-aware evaluation)
**Maintainer:** Future agents - read this before making changes!
