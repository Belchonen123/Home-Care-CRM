import { describe, expect, it } from "vitest";
import { addDaysIso, daysBetween, isoDate } from "./dates";

describe("dates", () => {
  it("isoDate formats UTC YYYY-MM-DD", () => {
    expect(isoDate(new Date("2026-05-05T12:34:56Z"))).toBe("2026-05-05");
    expect(isoDate(0)).toBe("1970-01-01");
  });

  it("daysBetween counts whole days, signed", () => {
    expect(daysBetween("2026-05-05", "2026-05-05")).toBe(0);
    expect(daysBetween("2026-05-05", "2026-05-12")).toBe(7);
    expect(daysBetween("2026-05-12", "2026-05-05")).toBe(-7);
  });

  it("addDaysIso advances and rewinds correctly across month boundaries", () => {
    expect(addDaysIso("2026-05-30", 5)).toBe("2026-06-04");
    expect(addDaysIso("2026-03-01", -1)).toBe("2026-02-28");
  });
});
