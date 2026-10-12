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
- **Framework**: FastAPI 0.110+
- **Server**: Uvicorn (standard)
- **Validation**: Pydantic 2.6
- **Data Processing**: Pandas 2.2
- **NLP**: spaCy 3.7 (en_core_web_sm model)
- **ML**: Scikit-Learn 1.4 (LinearSVC with TF-IDF vectorizer)
- **Model Persistence**: Joblib 1.3
- **Database**: Supabase Python client 2.4
- **Authentication**: python-jose 3.3 with PyJWT 2.8, passlib[bcrypt] 1.7
- **HTTP Client**: httpx 0.27
- **Testing**: pytest 8.0, pytest-asyncio 0.23
- **Environment**: python-dotenv 1.0

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

#### 1️⃣ Backend Setup

1. Navigate to the backend folder:
   ```bash
   cd backend
   ```

2. Create and activate virtual environment (Windows):
   ```bash
   python -m venv .venv
   .venv\Scripts\activate
   ```
   
   Or on macOS/Linux:
   ```bash
   python -m venv .venv
   source .venv/bin/activate
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Download the spaCy language model:
   ```bash
   python -m spacy download en_core_web_sm
   ```

5. Configure environment variables:
   - Rename `.env.example` to `.env`
   - Add your API keys:
     - `HF_API_TOKEN` - HuggingFace API token (for emotion detection)
     - `OPENROUTER_API_KEY` - OpenRouter API key (for LLM insights and the chat agent)
     - `OPENROUTER_MODEL` (optional) - any OpenRouter model id; defaults to `google/gemini-3.1-flash-lite-preview`
     - `SUPABASE_URL` - Supabase project URL
     - `SUPABASE_KEY` - Supabase service key
     - `SECRET_KEY` - JWT secret for authentication

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
- `POST /api/v1/analyze` - Analyze text and get full pipeline results

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

---

## 🔬 Machine Learning Models

### Clinical Classifier Training
Training data includes 200 samples per category (1,400 total):
- Depression
- Anxiety
- Suicidal ideation
- Stress
- Bipolar disorder
- Personality disorder
- Normal/Healthy

Features engineered with:
- **TF-IDF Vectorization**: Captures term importance (15K features)
- **N-grams**: 1-2 grams for context
- **Negation Handling**: 3-word scoped negation (e.g., `not very happy` → `NEG_very NEG_happy`)
- **Crisis Indicators**: Weighted crisis keywords and past-tense recovery context handling
- **Calibration**: Sigmoid calibration for probability estimates

Model achieves 87.1% macro F1 and passes 96% of adversarial edge cases (including hard-negatives).

---

## 🔒 Security Features

- **Authentication**: JWT-based with bcrypt password hashing
- **CORS Protection**: Configured for frontend and deployment origin
- **Environment Secrets**: API keys stored securely in .env
- **Input Validation**: Pydantic models for all requests
- **Database Security**: Row-level security with Supabase

---

## 📝 License

This project is open source. Check the repository for license details.

---

## 🆘 Crisis Support

If you're experiencing a mental health crisis, please reach out to:
- **National Suicide Prevention Lifeline**: 988 (US)
- **Crisis Text Line**: Text HOME to 741741
- **International Association for Suicide Prevention**: https://www.iasp.info/resources/Crisis_Centres/

**SentiMind is a support tool, not a replacement for professional mental health care.**