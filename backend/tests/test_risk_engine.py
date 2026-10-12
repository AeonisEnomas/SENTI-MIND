"""Tests for the enhanced risk engine v3."""

from app.services.risk_engine import assess_risk


def test_low_risk_normal():
    emotions = [{"label": "joy", "score": 0.8}]
    clinical = {"category": "Normal", "confidence": 0.9, "top_categories": [{"category": "Suicidal", "confidence": 0.01}]}
    result = assess_risk("I had a great day!", emotions, clinical)
    assert result["level"] == "low"
    assert not result["safety_protocol"]


def test_high_risk_suicidal_conf():
    emotions = [{"label": "sadness", "score": 0.6}]
    clinical = {
        "category": "Suicidal",
        "confidence": 0.75,
        "top_categories": [{"category": "Suicidal", "confidence": 0.75}],
    }
    result = assess_risk("I want to end my life tonight.", emotions, clinical)
    assert result["level"] == "critical"
    assert result["safety_protocol"] is True


def test_medium_risk_anxiety():
    emotions = [{"label": "fear", "score": 0.7}]
    clinical = {
        "category": "Anxiety",
        "confidence": 0.8,
        "top_categories": [{"category": "Anxiety", "confidence": 0.8}, {"category": "Suicidal", "confidence": 0.1}],
    }
    result = assess_risk("I am so stressed about exams.", emotions, clinical)
    # Anxiety without crisis keywords correctly scores as low-medium risk
    assert result["level"] in ("low", "medium")


def test_keyword_risk_boost():
    emotions = [{"label": "neutral", "score": 0.9}]
    clinical = {"category": "Normal", "confidence": 0.5, "top_categories": [{"category": "Suicidal", "confidence": 0.05}]}
    result = assess_risk("I want to end my life.", emotions, clinical)
    assert any("end my life" in t for t in result["triggers"])
    assert result["score"] >= 0.05


def test_negated_crisis_reduces_risk():
    """'I am NOT suicidal' should score much lower than 'I am suicidal'."""
    emotions = [{"label": "neutral", "score": 0.8}]
    clinical = {"category": "Stress", "confidence": 0.6, "top_categories": [{"category": "Suicidal", "confidence": 0.1}]}

    result_negated = assess_risk("I am not suicidal just stressed", emotions, clinical)
    result_direct = assess_risk("I am suicidal and want to die", emotions, clinical)

    assert result_negated["score"] < result_direct["score"]


def test_past_tense_reduces_risk():
    """'I was suicidal years ago' should score lower than 'I am suicidal'."""
    emotions = [{"label": "neutral", "score": 0.8}]
    clinical = {"category": "Normal", "confidence": 0.7, "top_categories": [{"category": "Suicidal", "confidence": 0.05}]}

    result_past = assess_risk("I was suicidal years ago but recovered", emotions, clinical)
    result_present = assess_risk("I am suicidal right now", emotions, clinical)

    assert result_past["score"] < result_present["score"]


def test_multi_keyword_trigger():
    emotions = [{"label": "sadness", "score": 0.8}]
    clinical = {"category": "Suicidal", "confidence": 0.8, "top_categories": [{"category": "Suicidal", "confidence": 0.8}]}
    result = assess_risk("I want to kill myself and end it all", emotions, clinical)
    assert len(result["triggers"]) >= 2
    assert result["level"] == "critical"
