import { describe, expect, it } from "vitest";
import { classifyExpiry, thresholdFor } from "./expiryStatus";

describe("classifyExpiry", () => {
  it("treats null as no_expiry", () => {
    expect(classifyExpiry(null)).toBe("no_expiry");
  });
  it("classifies negative days as expired", () => {
    expect(classifyExpiry(-1)).toBe("expired");
    expect(classifyExpiry(-365)).toBe("expired");
  });
  it("classifies 0–7 days as critical", () => {
    expect(classifyExpiry(0)).toBe("critical");
    expect(classifyExpiry(7)).toBe("critical");
  });
  it("classifies 8–14 days as warning", () => {
    expect(classifyExpiry(8)).toBe("warning");
    expect(classifyExpiry(14)).toBe("warning");
  });
  it("classifies 15–30 days as soon", () => {
    expect(classifyExpiry(15)).toBe("soon");
    expect(classifyExpiry(30)).toBe("soon");
  });
  it("classifies > 30 days as ok", () => {
    expect(classifyExpiry(31)).toBe("ok");
    expect(classifyExpiry(365)).toBe("ok");
  });
});

describe("thresholdFor", () => {
  it("returns 'expired' for negative days", () => {
    expect(thresholdFor(-1)).toBe("expired");
  });
  it("returns the lowest threshold matching the window", () => {
    expect(thresholdFor(0)).toBe("7");
    expect(thresholdFor(7)).toBe("7");
    expect(thresholdFor(8)).toBe("14");
    expect(thresholdFor(14)).toBe("14");
    expect(thresholdFor(15)).toBe("30");
    expect(thresholdFor(30)).toBe("30");
  });
  it("returns null when more than 30 days out", () => {
    expect(thresholdFor(31)).toBeNull();
    expect(thresholdFor(365)).toBeNull();
  });
});
