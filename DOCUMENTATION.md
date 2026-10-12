# SENTI-MIND Project Documentation

## Project Overview

SENTI-MIND is an AI-powered mental health text analysis application that detects emotional states and clinical risks (depression, anxiety, suicidal thoughts, etc.) and provides compassionate AI-generated coping strategies.

**Location:** `C:\Users\Aeonis\Documents\GitHub\SENTI-MIND`

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
│  │  │ TF-IDF (v3)     │  │ distilroberta    │  │ gemini-flash-lite│   ││
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
| Python | 3.11+ | Runtime |
| FastAPI | 0.100+ | Web framework |
| Uvicorn | Latest | ASGI server |
| scikit-learn | 1.3+ | LinearSVC, TF-IDF, CalibratedClassifierCV |
| spaCy | 3.x | Named Entity Recognition |
| httpx | 0.24+ | Async HTTP client |
| joblib | 1.3+ | Model serialization |
| pandas | 2.x | Data manipulation |
| numpy | 1.24+ | Numerical operations |

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
│   │   │   └── analysis.py               # Main POST /analysis endpoint
│   │   ├── core/
│   │   │   ├── config.py                 # Settings (env vars)
│   │   │   ├── constants.py              # Thresholds, categories
│   │   │   └── preprocessing.py          # Shared ML text preprocessor
│   │   ├── models/
│   │   │   ├── classifier.py             # ClinicalClassifier v3 (LinearSVC)
│   │   │   ├── emotions.py               # HuggingFace emotion detection
│   │   │   ├── llm.py                    # OpenRouter insight generation
│   │   │   └── schemas.py                # Pydantic request/response models
│   │   └── services/
│   │       ├── ner.py                    # spaCy entity extraction
│   │       ├── preprocessor.py           # Base Text cleaning (Emoji handling)
│   │       └── risk_engine.py            # Enhanced risk assessment
│   ├── data/                             # Model artifacts & training data
│   │   ├── Combined Data.csv             # 1,400 training samples (7 classes)
│   │   ├── sentiment_model_v3.joblib     # Trained LinearSVC (v3)
│   │   ├── vectorizer_v3.joblib          # TF-IDF vectorizer (v3)
│   │   └── model_metadata.json           # Training metrics
│   ├── scripts/
│   │   ├── generate_training_data.py     # Data generator pulling from training_data/
│   │   ├── train_model.py                # Training pipeline (GridSearchCV, CV)
│   │   └── training_data/                # Modular class data files
│   ├── tests/
│   │   ├── test_preprocessor.py          # Preprocessor unit tests
│   │   ├── test_emotions.py              # Emotion detection tests
│   │   ├── test_classifier.py            # Classifier v3 tests
│   │   └── test_risk_engine.py           # Risk engine tests
│   └── requirements.txt                  # Python dependencies
├── frontend/                             # React + Vite frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── EmotionChart.jsx        # Radar chart (Recharts)
│   │   │   ├── InsightModal.jsx        # AI insight display
│   │   │   └── RiskBadge.jsx           # Risk level indicator
│   │   ├── hooks/
│   │   │   └── useAnalysis.js          # React hook for API calls
│   │   ├── services/
│   │   │   └── api.js                  # Axios/Fetch wrapper
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

### 2. Clinical Classifier v3 (`app/models/classifier.py`)

**Class:** `ClinicalClassifier`

**Improvements over v2:**
- **Shared Preprocessor**: Uses `app.core.preprocessing` to guarantee inference matches training.
- **Confidence Thresholds**: Returns `"Uncertain"` if confidence is below 35%.
- **Ambiguity Detection**: Sets `is_ambiguous = True` if the top two classes are within 10% probability.
- **Insufficient Content Filter**: Short texts (< 3 words) return `"Insufficient"`.

**Pipeline:**
1. **Preprocessing**:
   - Lowercase, strip punctuation
   - Contraction expansion (`"can't"` → `"cannot"`)
   - Negation scoping (3-word window): `"not very happy"` → `NEG_very NEG_happy`
   - Intensity & temporal marker addition
2. **Vectorization**: TF-IDF (1-2 ngrams, 15K features)
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
- `data/sentiment_model_v3.joblib`
- `data/vectorizer_v3.joblib`

**Training:** Run `scripts/train_model.py` with `data/Combined Data.csv`

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

```bash
# Required
HF_API_TOKEN=hf_xxxxxxxxxxxxxxxxxxxxxxxx  # HuggingFace token

# Optional (for LLM insights + chat agent; falls back to canned text without it)
OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxx   # OpenRouter API key
OPENROUTER_MODEL=google/gemini-3.1-flash-lite-preview   # any OpenRouter model id
OPENROUTER_MAX_TOKENS=1024               # output cap per request

# App
SECRET_KEY=change-me-in-production
ALLOWED_ORIGINS=http://localhost:5173

# Model Paths (optional)
SENTIMIND_MODEL_PATH=data/sentiment_model_v3.joblib
SENTIMIND_VECTORIZER_PATH=data/vectorizer_v3.joblib
```

---

## Training Pipeline

### Data Format (`data/Combined Data.csv`)

Generated by `scripts/generate_training_data.py`. Pulls 200 samples per class from the modular `scripts/training_data/` package.

**Total:** 1,400 samples across 7 classes (including hard negatives to prevent keyword overfitting).

### Training Script (`scripts/train_model.py`)

Runs a GridSearchCV to find optimal `C` and TF-IDF parameters. Evaluates using Stratified 10-Fold CV. Finally, runs a 50+ case adversarial spot-check to guarantee the model passes rigorous edge cases (negations, non-clinical context). Outputs `v3` artifacts.

---

## Security Considerations

1. **CORS**: Configured in `main.py` via `ALLOWED_ORIGINS`
2. **API Keys**: Stored in `.env`, never committed
3. **Input Validation**: Pydantic schemas validate requests
4. **Safety Protocol**: Hardcoded at 70% suicidal threshold

---

**Last Updated:** April 2026
**Version:** 3.0 (ML Pipeline Rebuild)
**Maintainer:** Future agents - read this before making changes!
