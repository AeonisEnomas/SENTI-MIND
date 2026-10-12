import { describe, it, expect } from "vitest";
import { getCrisisSeverity, isCriticalResult, shouldShowCrisisBanner } from "./risk";

const result = (risk = {}, clinical = {}) => ({
  risk: { level: "low", score: 0.1, safety_protocol: false, ...risk },
  clinical: { category: "Normal", confidence: 0.9, ...clinical },
});

describe("getCrisisSeverity", () => {
  it("returns null with no result", () => {
    expect(getCrisisSeverity(null)).toBeNull();
    expect(getCrisisSeverity(undefined)).toBeNull();
    expect(shouldShowCrisisBanner(null)).toBe(false);
  });

  it("returns null for low and medium risk", () => {
    expect(getCrisisSeverity(result({ level: "low" }))).toBeNull();
    expect(getCrisisSeverity(result({ level: "medium" }))).toBeNull();
  });

  it("treats safety_protocol as critical even when level is not critical", () => {
    const r = result({ level: "medium", safety_protocol: true });
    expect(getCrisisSeverity(r)).toBe("critical");
    expect(isCriticalResult(r)).toBe(true);
    expect(shouldShowCrisisBanner(r)).toBe(true);
  });

  it("treats a critical level as critical", () => {
    expect(getCrisisSeverity(result({ level: "critical" }))).toBe("critical");
  });

  it("treats a Suicidal classification as critical regardless of level", () => {
    expect(getCrisisSeverity(result({ level: "low" }, { category: "Suicidal" }))).toBe("critical");
  });

  it("shows the gentler banner for high risk without crisis indicators", () => {
    const r = result({ level: "high" }, { category: "Depression" });
    expect(getCrisisSeverity(r)).toBe("high");
    expect(isCriticalResult(r)).toBe(false);
    expect(shouldShowCrisisBanner(r)).toBe(true);
  });

  it("prefers critical over high when safety_protocol is set", () => {
    expect(getCrisisSeverity(result({ level: "high", safety_protocol: true }))).toBe("critical");
  });

  it("tolerates partial results", () => {
    expect(getCrisisSeverity({})).toBeNull();
    expect(getCrisisSeverity({ risk: { safety_protocol: true } })).toBe("critical");
  });
});
