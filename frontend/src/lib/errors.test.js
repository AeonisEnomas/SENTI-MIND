import { describe, it, expect } from "vitest";
import { normalizeErrorDetail, getErrorMessage, isRateLimited } from "./errors";

describe("normalizeErrorDetail", () => {
  it("passes strings through", () => {
    expect(normalizeErrorDetail("Bad input")).toBe("Bad input");
  });

  it("returns null for empty values", () => {
    expect(normalizeErrorDetail(null)).toBeNull();
    expect(normalizeErrorDetail(undefined)).toBeNull();
    expect(normalizeErrorDetail("   ")).toBeNull();
    expect(normalizeErrorDetail([])).toBeNull();
  });

  it("joins FastAPI 422 validation arrays into one string", () => {
    const detail = [
      { loc: ["body", "text"], msg: "String should have at most 5000 characters", type: "string_too_long" },
      { loc: ["body", "history", 0, "role"], msg: "Field required", type: "missing" },
    ];
    const out = normalizeErrorDetail(detail);
    expect(typeof out).toBe("string");
    expect(out).toBe("text: String should have at most 5000 characters; history.0.role: Field required");
  });

  it("handles objects with a message", () => {
    expect(normalizeErrorDetail({ message: "Nope" })).toBe("Nope");
  });

  it("stringifies unknown objects instead of returning an object", () => {
    expect(normalizeErrorDetail({ code: 7 })).toBe('{"code":7}');
  });
});

describe("getErrorMessage", () => {
  const axiosError = (status, data = {}, headers = {}) => ({ response: { status, data, headers } });

  it("uses the backend detail string", () => {
    expect(getErrorMessage(axiosError(400, { detail: "Text is empty" }))).toBe("Text is empty");
  });

  it("never returns an array/object for 422 errors", () => {
    const msg = getErrorMessage(axiosError(422, { detail: [{ loc: ["body", "text"], msg: "too long" }] }));
    expect(msg).toBe("text: too long");
  });

  it("maps 429 to a friendly message including Retry-After", () => {
    const err = axiosError(429, { detail: "Too Many Requests" }, { "retry-after": "12" });
    expect(isRateLimited(err)).toBe(true);
    expect(getErrorMessage(err)).toMatch(/wait about 12 seconds/);
  });

  it("maps 429 without Retry-After", () => {
    expect(getErrorMessage(axiosError(429))).toMatch(/wait a moment/);
  });

  it("supports AxiosHeaders-style get()", () => {
    const headers = { get: (name) => (name === "retry-after" ? "1" : undefined) };
    expect(getErrorMessage(axiosError(429, {}, headers))).toMatch(/about 1 second and/);
  });

  it("explains expired sessions", () => {
    expect(getErrorMessage(axiosError(401))).toMatch(/sign in again/);
  });

  it("explains network failures", () => {
    expect(getErrorMessage({ request: {} })).toMatch(/couldn't reach the server/);
  });

  it("falls back when nothing useful is present", () => {
    expect(getErrorMessage(axiosError(500, {}), "Fallback")).toBe("Fallback");
    expect(getErrorMessage(null, "Fallback")).toBe("Fallback");
  });
});
