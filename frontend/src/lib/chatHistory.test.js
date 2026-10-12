import { describe, it, expect } from "vitest";
import {
  buildChatHistory,
  composeChatPayload,
  truncateText,
  MAX_HISTORY_TURNS,
  MAX_MESSAGE_CHARS,
} from "./chatHistory";

const greeting = { role: "model", parts: ["Hi there!"], excludeFromHistory: true };
const user = (text, extra = {}) => ({ role: "user", parts: [text], ...extra });
const model = (text, extra = {}) => ({ role: "model", parts: [text], ...extra });

describe("buildChatHistory", () => {
  it("returns an empty history for the first message (greeting only)", () => {
    expect(buildChatHistory([greeting])).toEqual([]);
  });

  it("only contains turns before the new message (no duplicate of the new turn)", () => {
    const prior = [greeting, user("first"), model("reply one")];
    const history = buildChatHistory(prior);
    expect(history).toEqual([
      { role: "user", parts: ["first"] },
      { role: "model", parts: ["reply one"] },
    ]);
    // The new message is sent separately; it must not be in history.
    expect(history.some((m) => m.parts[0] === "second")).toBe(false);
  });

  it("uses sentContent (with attached data) instead of the visible text", () => {
    const prior = [
      greeting,
      user("Please analyze my mood.", { sentContent: "Please analyze my mood.\n\nAttached Data: [...]" }),
      model("Your mood looks steady."),
    ];
    expect(buildChatHistory(prior)[0].parts[0]).toContain("Attached Data");
  });

  it("drops local error bubbles and failed turns", () => {
    const prior = [
      greeting,
      user("hello"),
      model("hi"),
      user("lost turn", { excludeFromHistory: true }),
      model("Sorry, something failed", { excludeFromHistory: true, isError: true }),
    ];
    expect(buildChatHistory(prior)).toEqual([
      { role: "user", parts: ["hello"] },
      { role: "model", parts: ["hi"] },
    ]);
  });

  it(`trims to the last ${MAX_HISTORY_TURNS} turns`, () => {
    const prior = [greeting];
    for (let i = 0; i < 30; i++) {
      prior.push(user(`u${i}`), model(`m${i}`));
    }
    const history = buildChatHistory(prior);
    expect(history).toHaveLength(MAX_HISTORY_TURNS);
    expect(history[history.length - 1]).toEqual({ role: "model", parts: ["m29"] });
    expect(history[0]).toEqual({ role: "user", parts: ["u10"] });
  });

  it("never starts with a model turn after trimming", () => {
    const prior = [user("u0"), model("m0"), user("u1"), model("m1")];
    const history = buildChatHistory(prior, { maxTurns: 3 });
    expect(history[0].role).toBe("user");
    expect(history).toEqual([
      { role: "user", parts: ["u1"] },
      { role: "model", parts: ["m1"] },
    ]);
  });

  it("caps each part to the backend limit", () => {
    const history = buildChatHistory([user("x".repeat(5000))], { maxPartChars: 4000 });
    expect(history[0].parts[0].length).toBe(4000);
  });
});

describe("composeChatPayload", () => {
  it("returns the message unchanged without attachments", () => {
    expect(composeChatPayload("hello")).toBe("hello");
  });

  it("appends attached data", () => {
    expect(composeChatPayload("hello", "Attached Data: {}")).toBe("hello\n\nAttached Data: {}");
  });

  it("keeps the payload within the message cap, truncating attached data first", () => {
    const payload = composeChatPayload("my question", "d".repeat(10000));
    expect(payload.length).toBeLessThanOrEqual(MAX_MESSAGE_CHARS);
    expect(payload.startsWith("my question\n\n")).toBe(true);
    expect(payload).toContain("[truncated]");
  });
});

describe("truncateText", () => {
  it("leaves short text alone", () => {
    expect(truncateText("abc", 10)).toBe("abc");
  });
  it("truncates long text to exactly max chars", () => {
    expect(truncateText("a".repeat(50), 20)).toHaveLength(20);
  });
});
