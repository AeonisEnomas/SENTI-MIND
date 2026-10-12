import logging
from fastapi import APIRouter, Depends, HTTPException
from app.models.schemas import (
    AnalysisRequest, AnalysisResponse,
    EmotionResult, ClinicalResult, ClinicalCategory,
    EntityResult, RiskAssessment, ModelUsed
)
from app.models.classifier import classifier
from app.models.emotions import detect_emotions
from app.models.llm import generate_insight
from app.services.ner import extract_entities
from app.services.risk_engine import assess_risk
from app.services.preprocessor import clean_text
from app.api.auth_middleware import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/", response_model=AnalysisResponse)
async def analyze_text(
    payload: AnalysisRequest,
    user_id: str = Depends(get_current_user),
):
    raw_text = payload.text.strip()
    if not raw_text:
        raise HTTPException(status_code=422, detail="Text cannot be empty.")

    try:
        # Clean and preprocess text
        cleaned_text, emoji_tokens = clean_text(raw_text)

        # Detect emotions
        raw_emotions = await detect_emotions(cleaned_text)
        emotions = [EmotionResult(label=e["label"], score=e["score"]) for e in raw_emotions]

        # Predict clinical category
        raw_clinical = classifier.predict(cleaned_text)
        clinical = ClinicalResult(
            category=raw_clinical["category"],
            confidence=raw_clinical["confidence"],
            top_categories=[
                ClinicalCategory(category=c["category"], confidence=c["confidence"])
                for c in raw_clinical.get("top_categories", [])
            ],
            is_ambiguous=raw_clinical.get("is_ambiguous", False),
            alternative_category=raw_clinical.get("alternative_category"),
            confidence_tier=raw_clinical.get("confidence_tier", "medium"),
        )

        # Extract named entities
        raw_entities = extract_entities(cleaned_text)
        entities = [
            EntityResult(text=e["text"], label=e["label"], start=e["start"], end=e["end"])
            for e in raw_entities
        ]

        # Assess risk level based on clinical and emotion data
        raw_risk = assess_risk(cleaned_text, raw_emotions, raw_clinical)
        risk = RiskAssessment(
            level=raw_risk["level"],
            score=raw_risk["score"],
            triggers=raw_risk["triggers"],
            safety_protocol=raw_risk["safety_protocol"],
        )

        # Generate insights using LLM
        insight, llm_details = await generate_insight(cleaned_text, raw_emotions, raw_clinical, raw_risk)

        # Track model usage metadata
        models_used = [
            ModelUsed(
                name="j-hartmann/emotion-english-distilroberta-base",
                type="emotion",
                provider="huggingface",
                details={"api_endpoint": "router.huggingface.co"}
            ),
            ModelUsed(
                name="ClinicalClassifier v3 (LinearSVC TF-IDF)",
                type="clinical",
                provider="local",
            )
        ]
        if llm_details:
            models_used.append(
                ModelUsed(
                    name=llm_details["model"],
                    type="llm",
                    provider="openrouter",
                    details=llm_details.get("usage", {})
                )
            )

        # Construct and return final response
        return AnalysisResponse(
            raw_text=raw_text,
            preprocessed_text=cleaned_text,
            emotions=emotions,
            clinical=clinical,
            entities=entities,
            risk=risk,
            insight=insight,
            models_used=models_used,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Analysis failed for user %s: %s", user_id, e)
        raise HTTPException(status_code=500, detail="Analysis failed. Please try again.")
