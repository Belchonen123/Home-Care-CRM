import { describe, expect, it } from "vitest";
import { miTaskCategoryMinutesValid } from "../authorizations";

describe("miTaskCategoryMinutesValid", () => {
  it("accepts a perfect sum", () => {
    expect(
      miTaskCategoryMinutesValid(
        [
          { category: "personal_care", minutes: 1200 },
          { category: "household", minutes: 800 },
        ],
        2000,
      ),
    ).toBe(true);
  });

  it("rejects under-allocation", () => {
    expect(
      miTaskCategoryMinutesValid(
        [{ category: "personal_care", minutes: 1500 }],
        2000,
      ),
    ).toBe(false);
  });

  it("rejects over-allocation", () => {
    expect(
      miTaskCategoryMinutesValid(
        [{ category: "personal_care", minutes: 2500 }],
        2000,
      ),
    ).toBe(false);
  });

  it("treats an empty list as 0 (always wrong unless expected is 0)", () => {
    expect(miTaskCategoryMinutesValid([], 0)).toBe(true);
    expect(miTaskCategoryMinutesValid([], 600)).toBe(false);
  });
});
