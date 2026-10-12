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
