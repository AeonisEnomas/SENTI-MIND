// Pure helpers for building the chat request payload.
//
// UI messages look like:
//   { role: "user" | "model", parts: [visibleText], sentContent?, excludeFromHistory? }
// `sentContent` is what was actually sent to the backend (e.g. the user's text plus
// attached data) so follow-up turns keep that context, while the UI keeps showing the
// short visible text. `excludeFromHistory` marks the local greeting, local error
// bubbles and turns that never reached the server.

export const MAX_HISTORY_TURNS = 40; // matches the server-side truncation
export const MAX_PART_CHARS = 4000; // matches the backend per-part cap
export const MAX_MESSAGE_CHARS = 4000; // matches the backend chat message cap

const TRUNCATION_SUFFIX = "\n…[truncated]";

export function truncateText(text, max) {
  const s = String(text ?? "");
  if (s.length <= max) return s;
  return s.slice(0, Math.max(0, max - TRUNCATION_SUFFIX.length)) + TRUNCATION_SUFFIX;
}

/**
 * Builds the `history` array from messages that existed BEFORE the new user turn.
 * The backend appends the new `message` itself, so it must not appear here.
 */
export function buildChatHistory(priorMessages, { maxTurns = MAX_HISTORY_TURNS, maxPartChars = MAX_PART_CHARS } = {}) {
  const turns = (priorMessages ?? [])
    .filter((m) => m && !m.excludeFromHistory && (m.role === "user" || m.role === "model"))
    .map((m) => {
      const content = m.sentContent ?? (Array.isArray(m.parts) ? m.parts.join("\n") : "");
      return { role: m.role, parts: [truncateText(content, maxPartChars)] };
    })
    .filter((m) => m.parts[0].length > 0);

  let trimmed = turns.length > maxTurns ? turns.slice(turns.length - maxTurns) : turns;
  // Gemini-style histories should start with a user turn.
  while (trimmed.length && trimmed[0].role !== "user") trimmed = trimmed.slice(1);
  return trimmed;
}

/**
 * Combines the user's text with optional attached data, keeping the total within
 * the backend message cap. The user's own words take priority over attached data.
 */
export function composeChatPayload(userMessage, attachedDataText = "", maxChars = MAX_MESSAGE_CHARS) {
  const message = truncateText(userMessage, maxChars);
  if (!attachedDataText) return message;
  const separator = "\n\n";
  const room = maxChars - message.length - separator.length;
  if (room <= TRUNCATION_SUFFIX.length) return message;
  return `${message}${separator}${truncateText(attachedDataText, room)}`;
}
