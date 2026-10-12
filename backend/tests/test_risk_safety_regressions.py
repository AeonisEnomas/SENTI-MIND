"""Crisis-safety regression tests for the risk engine.

Every case uses a hand-crafted clinical dict, so these tests do not depend on
the trained classifier (which may be retrained independently).
"""

import pytest

from app.core.crisis_detection import find_crisis_hits
from app.core.preprocessing import has_negated_crisis
from app.services.risk_engine import assess_risk

NEUTRAL = [{"label": "neutral", "score": 1.0}]


def clinical(category="Normal", suicidal=0.02):
    """Classifier output stub. ``suicidal=None`` means no top_categories."""
    top = [] if suicidal is None else [{"category": "Suicidal", "confidence": suicidal}]
    return {"category": category, "confidence": 0.6, "top_categories": top}


INSUFFICIENT = {"category": "Insufficient", "confidence": 0.0, "top_categories": []}


# ── The reported bugs ──────────────────────────────────────────────────


def test_bug1_tier1_keyword_not_outvoted_by_depression_category():
    text = ("I'm sick of everything and nothing helps, I have no reason to live "
            "and I'm tired of living")
    r = assess_risk(text, NEUTRAL, clinical("Depression", 0.0156))
    assert r["level"] == "critical"
    assert r["safety_protocol"] is True
    assert "no reason to live" in r["triggers"]
    assert "tired of living" in r["triggers"]


def test_bug2_past_tense_elsewhere_does_not_scale_present_keyword():
    r = assess_risk("I was diagnosed years ago and now I'm suicidal again", NEUTRAL, clinical("Normal", 0.03))
    assert r["level"] in ("high", "critical")
    assert r["triggers"] == ["suicidal"]


@pytest.mark.parametrize("text", [
    "No, I want to die",
    "I don't know why I want to die every day",
    "I don’t know why I want to die every day",
])
def test_bug2_comma_or_dont_know_why_is_not_negation(text):
    r = assess_risk(text, NEUTRAL, clinical("Depression", 0.29))
    assert r["level"] in ("high", "critical")
    assert "want to die" in r["triggers"]
    assert not has_negated_crisis(text)


def test_bug3_short_input_with_tier1_keyword_triggers_protocol():
    r = assess_risk("kill myself", NEUTRAL, INSUFFICIENT)
    assert r["level"] == "critical"
    assert r["safety_protocol"] is True


def test_bug3_missing_top_categories_key():
    r = assess_risk("kill myself", NEUTRAL, {"category": "Uncertain"})
    assert r["safety_protocol"] is True


def test_bug4_substring_inside_other_word_does_not_match():
    r = assess_risk("Tom is pending it on the new laptop", NEUTRAL, clinical("Normal", 0.03))
    assert r["level"] == "low"
    assert r["triggers"] == []
    assert r["safety_protocol"] is False


@pytest.mark.parametrize("text", [
    "I can’t go on anymore",
    "I don’t want to be alive",
    "I‘m tired of living",
])
def test_bug4_curly_apostrophes_match(text):
    r = assess_risk(text, NEUTRAL, clinical("Normal", 0.02))
    assert r["triggers"], text
    assert r["level"] in ("high", "critical")


# ── Return-shape contract (API / frontend depend on it) ────────────────


def test_return_shape_unchanged():
    r = assess_risk("hello", NEUTRAL, clinical())
    assert set(r) == {"level", "score", "triggers", "safety_protocol"}
    assert isinstance(r["score"], float)
    assert isinstance(r["triggers"], list)
    assert isinstance(r["safety_protocol"], bool)


# ── Floors and protocol rule ───────────────────────────────────────────


def test_classifier_alone_still_triggers_protocol():
    r = assess_risk("everything is grey", NEUTRAL, clinical("Suicidal", 0.85))
    assert r["safety_protocol"] is True
    assert r["level"] == "critical"


def test_weak_keyword_is_never_low():
    r = assess_risk("I feel hopeless about my exams", NEUTRAL, clinical("Stress", 0.0))
    assert r["level"] == "medium"
    assert r["safety_protocol"] is False


def test_tier2_keyword_is_at_least_high():
    r = assess_risk("I am suicidal", NEUTRAL, clinical("Normal", 0.0))
    assert r["level"] in ("high", "critical")


def test_critical_level_always_sets_protocol():
    emotions = [{"label": "sadness", "score": 1.0}, {"label": "fear", "score": 1.0}]
    r = assess_risk("I am suicidal and scared", emotions, clinical("Suicidal", 0.65))
    if r["level"] == "critical":
        assert r["safety_protocol"] is True


# ── Positive / hard-negative table ─────────────────────────────────────

# (text, minimum level, protocol expected)
POSITIVES = [
    ("kill myself", "critical", True),
    ("I want to kill myself", "critical", True),
    ("I’m going to kill myself", "critical", True),
    ("I'm going to end it all tonight", "critical", True),
    ("I have a suicide plan", "critical", True),
    ("I want to end my life", "critical", True),
    ("I was going to kill myself", "critical", True),
    ("I keep cutting myself", "critical", True),
    ("I took an overdose", "critical", True),
    ("I have no reason to live", "critical", True),
    ("I'm thinking about hanging myself", "critical", True),
    ("I used to want to die, and I still do", "high", False),
    ("I was suicidal years ago and I'm suicidal again now", "high", False),
    ("I felt suicidal last night", "high", False),
    ("I am suicidal right now", "high", False),
    ("No, I want to die", "high", False),
    ("Honestly I want to die", "high", False),
    ("Not gonna lie I want to die", "high", False),
    ("I wanted to die yesterday", "high", False),
    ("I can't go on like this", "high", False),
    ("I'm better off dead", "high", False),
    ("life is not worth living", "high", False),
    ("I don't want to be alive", "high", False),
    ("I DON'T WANT TO LIVE", "high", False),
    ("I feel worthless", "medium", False),
]

# (text, allowed levels) — protocol must be False for all of these.
HARD_NEGATIVES = [
    ("I'm not suicidal, just tired", ("low",)),
    ("I am not suicidal", ("low",)),
    ("I would never kill myself", ("low",)),
    ("I don't want to die", ("low",)),
    ("I have no thoughts of suicide", ("low",)),
    ("I'm not thinking about killing myself", ("low",)),
    ("I used to feel suicidal but therapy helped me a lot", ("low", "medium")),
    ("I used to feel suicidal but now I'm doing great", ("low", "medium")),
    ("I was suicidal years ago, I'm better now", ("low", "medium")),
    ("I was suicidal years ago but recovered", ("low", "medium")),
    ("I am no longer suicidal", ("low", "medium")),
    ("this movie killed it", ("low",)),
    ("Tom is pending it on the new laptop", ("low",)),
    ("I'd die for a pizza right now", ("low",)),
    ("I'm going to die of embarrassment", ("low",)),
    ("I'm going to kill myself laughing at this", ("low",)),
    ("we're ending it early today, see you tomorrow", ("low",)),
    ("I can't go on the trip next week", ("low",)),
    ("I'm going to overdose on coffee", ("low",)),
    ("the ascending item list", ("low",)),
    ("my selfie harmed nobody", ("low",)),
]

LEVEL_ORDER = ["low", "medium", "high", "critical"]


@pytest.mark.parametrize("text,min_level,protocol", POSITIVES)
def test_positive_phrases(text, min_level, protocol):
    r = assess_risk(text, NEUTRAL, clinical("Normal", 0.02))
    assert LEVEL_ORDER.index(r["level"]) >= LEVEL_ORDER.index(min_level), r
    assert r["triggers"], r
    if protocol:
        assert r["safety_protocol"] is True, r


@pytest.mark.parametrize("text,min_level,protocol", POSITIVES)
def test_positive_phrases_without_classifier(text, min_level, protocol):
    r = assess_risk(text, NEUTRAL, INSUFFICIENT)
    assert LEVEL_ORDER.index(r["level"]) >= LEVEL_ORDER.index(min_level), r


@pytest.mark.parametrize("text,allowed", HARD_NEGATIVES)
def test_hard_negatives(text, allowed):
    r = assess_risk(text, NEUTRAL, clinical("Normal", 0.02))
    assert r["level"] in allowed, r
    assert r["safety_protocol"] is False, r


# ── Per-occurrence context ─────────────────────────────────────────────


def test_mixed_negated_and_active_occurrences_report_active():
    text = "I'm not suicidal at work. At home I am suicidal."
    r = assess_risk(text, NEUTRAL, clinical("Normal", 0.02))
    assert r["triggers"] == ["suicidal"]
    assert r["level"] in ("high", "critical")


def test_past_and_present_occurrences_in_one_text():
    hits = find_crisis_hits("I was suicidal years ago. Today I am suicidal")
    states = [(h.past, h.negated) for h in hits]
    assert (True, False) in states and (False, False) in states


@pytest.mark.parametrize("text,negated,past", [
    ("not suicidal", True, False),
    ("I never want to kill myself", True, False),
    ("I used to want to die", False, True),
    ("I was suicidal years ago", False, True),
    ("suicidal thoughts years ago", False, True),
    ("I used to want to die and now I want to die again", False, False),
    ("No, I want to die", False, False),
])
def test_occurrence_flags(text, negated, past):
    hits = find_crisis_hits(text)
    assert hits
    h = hits[0]
    assert (h.negated, h.past) == (negated, past)


def test_has_negated_crisis():
    assert has_negated_crisis("I am not suicidal")
    assert has_negated_crisis("I don’t want to die")
    assert not has_negated_crisis("I want to die")
    assert not has_negated_crisis("nothing helps, I want to die")
