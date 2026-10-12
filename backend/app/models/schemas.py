from pydantic import BaseModel, Field
from typing import Literal, Optional

from app.core.constants import MENTAL_HEALTH_CATEGORIES

# Every category the classifier can emit: the trained labels plus its low-confidence/edge-case labels.
CATEGORY_VALUES = tuple(MENTAL_HEALTH_CATEGORIES) + ("Uncertain", "Insufficient", "Unknown")
Category = Literal[CATEGORY_VALUES]  # type: ignore[valid-type]
RiskLevel = Literal["low", "medium", "high", "critical"]

MAX_ANALYSIS_TEXT_CHARS = 5000


class AnalysisRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=MAX_ANALYSIS_TEXT_CHARS)


class EmotionResult(BaseModel):
    label: str
    score: float


class ClinicalCategory(BaseModel):
    category: str
    confidence: float


class ClinicalResult(BaseModel):
    category: str
    confidence: float
    top_categories: list[ClinicalCategory]
    is_ambiguous: bool = False
    alternative_category: Optional[str] = None
    confidence_tier: str = "medium"


class EntityResult(BaseModel):
    text: str
    label: str
    start: int
    end: int


class RiskAssessment(BaseModel):
    level: str
    score: float
    triggers: list[str]
    safety_protocol: bool


class ModelUsed(BaseModel):
    name: str
    type: str
    provider: str
    details: Optional[dict] = None

class AnalysisResponse(BaseModel):
    raw_text: str
    preprocessed_text: str
    emotions: list[EmotionResult]
    clinical: ClinicalResult
    entities: list[EntityResult]
    risk: RiskAssessment
    insight: Optional[str] = None
    models_used: list[ModelUsed] = []
