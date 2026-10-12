

# Mental Health Categories (7-class clinical classification)
MENTAL_HEALTH_CATEGORIES = [
    "Anxiety",
    "Depression",
    "Suicidal",
    "Stress",
    "Bipolar",
    "Normal",
    "Personality Disorder",
]

# Risk Assessment Thresholds
RISK_THRESHOLDS = {
    "low": 0.25,
    "medium": 0.50,
    "high": 0.75,
}

# Safety Protocol - Triggers at 70% suicidal confidence
SAFETY_PROTOCOL_THRESHOLD = 0.70

# Risk Levels
RISK_LEVELS = ["low", "medium", "high", "critical"]

# ── Consolidated Crisis Keywords (single source of truth) ──────────────
# Used by both the preprocessing pipeline and the risk engine.
# Keys are lowercase phrases; values are severity weights (0.0–1.0).
CRISIS_KEYWORDS = {
    # Tier 1 — Active planning / method (weight 1.0)
    "kill myself": 1.0,
    "killing myself": 1.0,
    "end my life": 1.0,
    "ending my life": 1.0,
    "end it all": 1.0,
    "take my own life": 1.0,
    "suicide plan": 1.0,
    "going to die": 1.0,
    "final exit": 1.0,
    "ending it": 1.0,
    # Tier 2 — Active ideation (weight 0.7–0.9)
    "suicide": 0.7,
    "suicidal": 0.7,
    "want to die": 0.7,
    "wanting to die": 0.7,
    "better off dead": 0.7,
    "not worth living": 0.7,
    "no reason to live": 0.9,
    "overdose": 0.9,
    # Tier 3 — Self-harm (weight 0.6–0.9)
    "self-harm": 0.9,
    "self harm": 0.9,
    "cut myself": 0.9,
    "cutting myself": 0.9,
    "hurt myself": 0.9,
    "hurting myself": 0.9,
    "harm myself": 0.9,
    "harming myself": 0.9,
    # Tier 4 — Passive / ambiguous (weight 0.3–0.7)
    "can't go on": 0.7,
    "cannot go on": 0.7,
    "tired of living": 0.7,
    "don't want to be alive": 0.7,
    "hopeless": 0.3,
    "worthless": 0.3,
}

# ── Risk-engine keyword tiers ──────────────────────────────────────────
# A keyword hit that is not negated and not in the past sets a floor on the
# risk level:
#   weight >= CRISIS_TIER1_MIN_WEIGHT  -> "critical" + safety protocol
#   weight >= CRISIS_TIER2_MIN_WEIGHT  -> at least "high" + safety protocol
#   any other crisis keyword           -> at least "medium" (never "low")
CRISIS_TIER1_MIN_WEIGHT = 0.9
CRISIS_TIER2_MIN_WEIGHT = 0.7

# Extra phrases matched ONLY by the risk engine. They stay out of
# CRISIS_KEYWORDS on purpose: core/preprocessing.preprocess() turns every
# CRISIS_KEYWORDS entry with weight >= 0.7 into a classifier feature, so new
# keys there would change the features the trained model receives.
RISK_ONLY_CRISIS_KEYWORDS = {
    "hang myself": 1.0,
    "hanging myself": 1.0,
    "shoot myself": 1.0,
    "slit my wrists": 1.0,
    "suicide note": 1.0,
    "end myself": 1.0,
    "ending myself": 1.0,
    "wanted to die": 0.7,
    "wants to die": 0.7,
    "don't want to live": 0.7,
    "do not want to live": 0.7,
    "do not want to be alive": 0.7,
    "no point in living": 0.7,
    "no point living": 0.7,
}

# Figurative or everyday uses of crisis phrases. A keyword occurrence that
# overlaps a match of one of these patterns is ignored. The patterns run on
# lower-cased text with curly apostrophes normalised to "'".
CRISIS_IDIOM_PATTERNS = [
    r"\bgoing to die (?:of|from) (?:laughter|laughing|embarrassment|boredom|shame|cringe|excitement|hunger|cuteness|old age)\b",
    r"\bgoing to die (?:someday|some day|one day|eventually)\b",
    r"\bgoing to die if (?:i|we) (?:don't|dont|do not) (?:get|have|eat|drink|see)\b",
    r"\b(?:we're|we are|we|everyone is|everybody is|everyone's|everybody's) all going to die\b",
    r"\bkill(?:ing)? myself (?:laughing|with laughter)\b",
    r"\bending it (?:with|early|on a)\b",
    r"\b(?:can't|cant|cannot|can not) go on (?:the|a|an|my|our|your|his|her|their|vacation|holiday|trips?|dates?|stage|air|tour|rides?|leave|break|record|social media|twitter|instagram|tiktok)\b",
    r"\boverdose (?:on|of) (?:sugar|caffeine|coffee|chocolate|candy|carbs|netflix|tv|cuteness)\b",
]
