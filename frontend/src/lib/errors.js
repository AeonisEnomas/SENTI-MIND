// Turns axios / FastAPI errors into a single user-facing string.

const DEFAULT_MESSAGE = "An unexpected error occurred.";

/** Normalises a FastAPI `detail` (string | validation-error array | object) to a string. */
export function normalizeErrorDetail(detail) {
  if (detail == null) return null;
  if (typeof detail === "string") return detail.trim() || null;
  if (Array.isArray(detail)) {
    const parts = detail
      .map((d) => {
        if (typeof d === "string") return d;
        if (d && typeof d === "object") {
          const msg = d.msg ?? d.message ?? null;
          if (!msg) return null;
          // loc is e.g. ["body", "text"]; drop the "body" prefix for readability.
          const loc = Array.isArray(d.loc) ? d.loc.filter((p) => p !== "body").join(".") : "";
          return loc ? `${loc}: ${msg}` : msg;
        }
        return null;
      })
      .filter(Boolean);
    return parts.length ? parts.join("; ") : null;
  }
  if (typeof detail === "object") {
    if (typeof detail.message === "string") return detail.message;
    if (typeof detail.msg === "string") return detail.msg;
    try {
      return JSON.stringify(detail);
    } catch {
      return null;
    }
  }
  return String(detail);
}

function readRetryAfter(headers) {
  if (!headers) return null;
  const raw = typeof headers.get === "function" ? headers.get("retry-after") : headers["retry-after"] ?? headers["Retry-After"];
  const seconds = Number.parseInt(raw, 10);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
}

export function rateLimitMessage(retryAfterSeconds) {
  return retryAfterSeconds
    ? `You're sending requests a little quickly. Please wait about ${retryAfterSeconds} second${retryAfterSeconds === 1 ? "" : "s"} and try again.`
    : "You're sending requests a little quickly. Please wait a moment and try again.";
}

/** Returns a user-facing message for any thrown error (axios or otherwise). */
export function getErrorMessage(err, fallback = DEFAULT_MESSAGE) {
  if (!err) return fallback;
  const response = err.response;
  if (response) {
    if (response.status === 429) return rateLimitMessage(readRetryAfter(response.headers));
    if (response.status === 401) return "Your session has expired. Please sign in again.";
    const detail = normalizeErrorDetail(response.data?.detail);
    if (detail) return detail;
    return fallback;
  }
  if (err.request || err.code === "ERR_NETWORK") {
    return "We couldn't reach the server. It may be waking up, so please try again in a moment.";
  }
  return fallback;
}

export function isRateLimited(err) {
  return err?.response?.status === 429;
}
