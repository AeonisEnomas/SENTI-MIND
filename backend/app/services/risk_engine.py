
from app.core.constants import (
    CRISIS_TIER1_MIN_WEIGHT,
    CRISIS_TIER2_MIN_WEIGHT,
    RISK_THRESHOLDS,
    SAFETY_PROTOCOL_THRESHOLD,
)
from app.core.crisis_detection import CrisisHit, find_crisis_hits

HIGH_RISK_EMOTIONS = {"anger", "fear", "sadness", "disgust"}

# Crisis keywords live in constants.py (single source of truth). Matching,
# negation and past-tense handling live in core/crisis_detection.py and are
# evaluated per keyword occurrence.


def _summarise_hits(hits: list[CrisisHit]) -> tuple[list[str], float, float]:
    """Return (trigger labels, keyword score, max weight of active hits).

    Each keyword is reported once, using its most severe reading:
    active > past > negated.
    """
    rank = {"active": 0, "past": 1, "negated": 2}
    best: dict[str, str] = {}
    keyword_score = 0.0
    active_weight = 0.0
    for h in hits:
        state = "active" if h.active else ("negated" if h.negated else "past")
        if h.keyword not in best or rank[state] < rank[best[h.keyword]]:
            best[h.keyword] = state
        keyword_score = max(keyword_score, h.effective_weight)
        if h.active:
            active_weight = max(active_weight, h.weight)

    triggers = [kw if state == "active" else f"{kw} ({state})" for kw, state in best.items()]
    return triggers, min(keyword_score, 1.0), active_weight


def assess_risk(text: str, emotions: list[dict], clinical: dict) -> dict:
    triggers, keyword_score, active_weight = _summarise_hits(find_crisis_hits(text))

    emotion_score = 0.0
    if emotions:
        for emo in emotions[:3]:
            if emo["label"] in HIGH_RISK_EMOTIONS:
                position_weight = 1.0 if emo == emotions[0] else 0.5
                emotion_score += emo["score"] * position_weight
        emotion_score = min(emotion_score / 1.5, 1.0)

    suicidal_conf = 0.0
    for item in clinical.get("top_categories", []) or []:
        if item["category"].lower() == "suicidal":
            suicidal_conf = item["confidence"]
            break

    category = clinical.get("category", "Unknown")

    if category == "Normal" and keyword_score > 0.3:
        risk_score = keyword_score * 0.60 + emotion_score * 0.25 + suicidal_conf * 0.15
    elif category == "Suicidal" and not triggers:
        risk_score = suicidal_conf * 0.55 + emotion_score * 0.30 + keyword_score * 0.15
    else:
        risk_score = suicidal_conf * 0.45 + emotion_score * 0.30 + keyword_score * 0.25

    # Keyword floors: a present, non-negated crisis phrase can never be
    # out-voted by the classifier or the emotion model.
    tier1_hit = active_weight >= CRISIS_TIER1_MIN_WEIGHT
    if tier1_hit:
        risk_score = max(risk_score, RISK_THRESHOLDS["high"])
    elif active_weight >= CRISIS_TIER2_MIN_WEIGHT:
        risk_score = max(risk_score, RISK_THRESHOLDS["medium"])
    elif active_weight > 0:
        risk_score = max(risk_score, RISK_THRESHOLDS["low"])

    risk_score = round(float(min(risk_score, 1.0)), 4)

    if suicidal_conf >= SAFETY_PROTOCOL_THRESHOLD or tier1_hit or risk_score >= RISK_THRESHOLDS["high"]:
        level = "critical"
    elif risk_score >= RISK_THRESHOLDS["medium"]:
        level = "high"
    elif risk_score >= RISK_THRESHOLDS["low"]:
        level = "medium"
    else:
        level = "low"

    safety_protocol = suicidal_conf >= SAFETY_PROTOCOL_THRESHOLD or tier1_hit or level == "critical"

    return {
        "level": level,
        "score": risk_score,
        "triggers": triggers,
        "safety_protocol": safety_protocol,
    }
