// Local-calendar date helpers. Avoid toISOString(), which converts to UTC and
// shifts the day for users east/west of Greenwich.

const pad = (n) => String(n).padStart(2, "0");

/** Formats a Date as YYYY-MM-DD in the user's local timezone. */
export function formatLocalDate(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Parses a YYYY-MM-DD string as a local-midnight Date. `new Date("2024-01-05")`
 * would be parsed as UTC midnight and can display as the previous day.
 * Falls back to the native parser for full timestamps.
 */
export function parseLocalDate(value) {
  if (typeof value === "string") {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  return new Date(value);
}

/** Returns the last `count` local dates (oldest first) as YYYY-MM-DD strings. */
export function lastNDates(count, today = new Date()) {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    d.setDate(d.getDate() - (count - 1 - i));
    return formatLocalDate(d);
  });
}
