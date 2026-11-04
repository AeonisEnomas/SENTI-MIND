// Pure helpers for deciding when to surface crisis support in the UI.

/**
 * Returns the crisis banner severity for an analysis result:
 *   "critical" - safety protocol triggered, critical risk, or Suicidal classification
 *   "high"     - high risk without crisis indicators (gentler banner)
 *   null       - no banner
 */
export function getCrisisSeverity(result) {
  if (!result) return null;
  const level = result.risk?.level;
  if (
    result.risk?.safety_protocol === true ||
    level === "critical" ||
    result.clinical?.category === "Suicidal"
  ) {
    return "critical";
  }
  if (level === "high") return "high";
  return null;
}

export function isCriticalResult(result) {
  return getCrisisSeverity(result) === "critical";
}

export function shouldShowCrisisBanner(result) {
  return getCrisisSeverity(result) !== null;
}

// Offline fallback for when the analysis server can't be reached. Mirrors the backend's
// weight >= 0.7 crisis keywords (core/constants.py: CRISIS_KEYWORDS + RISK_ONLY_CRISIS_KEYWORDS).
// There is no negation or tense handling here on purpose: this only runs when the real
// engine is unavailable, and over-alerting is the intended failure mode.
const OFFLINE_CRISIS_PHRASES = [
  "kill myself", "killing myself", "end my life", "ending my life", "end it all", "ending it",
  "take my own life", "suicide plan", "going to die", "final exit", "no reason to live",
  "overdose", "self-harm", "self harm", "cut myself", "cutting myself", "hurt myself",
  "hurting myself", "harm myself", "harming myself", "suicide", "suicidal", "want to die",
  "wanting to die", "wanted to die", "wants to die", "better off dead", "not worth living",
  "can't go on", "cannot go on", "tired of living", "don't want to be alive",
  "do not want to be alive", "don't want to live", "do not want to live", "no point in living",
  "no point living", "hang myself", "hanging myself", "shoot myself", "slit my wrists",
  "suicide note", "end myself", "ending myself",
];

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const OFFLINE_CRISIS_RE = new RegExp(
  `(?<![a-z])(?:${OFFLINE_CRISIS_PHRASES.map(escapeRegExp).join("|")})(?![a-z])`,
);

/** True when text contains crisis language. Used only when the server analysis failed. */
export function hasCrisisLanguage(text) {
  const normalized = String(text ?? "").toLowerCase().replace(/[‘’]/g, "'").replace(/\s+/g, " ");
  return OFFLINE_CRISIS_RE.test(normalized);
}
