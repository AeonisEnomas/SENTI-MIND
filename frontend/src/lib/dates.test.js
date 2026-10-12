import { describe, it, expect } from "vitest";
import { formatLocalDate, parseLocalDate, lastNDates } from "./dates";

describe("formatLocalDate", () => {
  it("formats using local calendar fields with zero padding", () => {
    expect(formatLocalDate(new Date(2024, 0, 5))).toBe("2024-01-05");
    expect(formatLocalDate(new Date(2024, 11, 31))).toBe("2024-12-31");
  });

  it("does not shift late-evening local times to the next UTC day", () => {
    // 23:30 local time must stay on the same local date, whatever the TZ.
    const lateEvening = new Date(2024, 5, 15, 23, 30);
    expect(formatLocalDate(lateEvening)).toBe("2024-06-15");
  });

  it("does not shift early-morning local times to the previous UTC day", () => {
    const earlyMorning = new Date(2024, 5, 15, 0, 15);
    expect(formatLocalDate(earlyMorning)).toBe("2024-06-15");
  });
});

describe("parseLocalDate", () => {
  it("parses YYYY-MM-DD as local midnight", () => {
    const d = parseLocalDate("2024-03-09");
    expect(d.getFullYear()).toBe(2024);
    expect(d.getMonth()).toBe(2);
    expect(d.getDate()).toBe(9);
    expect(d.getHours()).toBe(0);
  });

  it("round-trips with formatLocalDate", () => {
    expect(formatLocalDate(parseLocalDate("2023-10-01"))).toBe("2023-10-01");
  });

  it("falls back to native parsing for full timestamps", () => {
    expect(parseLocalDate("2024-03-09T12:00:00Z").getTime()).toBe(Date.UTC(2024, 2, 9, 12));
  });
});

describe("lastNDates", () => {
  it("returns N consecutive local dates ending today, oldest first", () => {
    const dates = lastNDates(3, new Date(2024, 2, 1, 22, 0)); // 1 March, 22:00
    expect(dates).toEqual(["2024-02-28", "2024-02-29", "2024-03-01"]);
  });

  it("returns 30 unique dates", () => {
    const dates = lastNDates(30, new Date(2024, 9, 27));
    expect(new Set(dates).size).toBe(30);
    expect(dates[29]).toBe("2024-10-27");
  });
});
