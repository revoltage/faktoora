import { describe, expect, test } from "vitest";

import { previousMonthKey } from "./monthShift";

describe("previousMonthKey", () => {
  test("steps back within a year", () => {
    expect(previousMonthKey("2026-08")).toBe("2026-07");
    expect(previousMonthKey("2026-07")).toBe("2026-06");
  });

  test("rolls over the year boundary", () => {
    expect(previousMonthKey("2026-01")).toBe("2025-12");
  });

  test("keeps the two-digit month padded", () => {
    expect(previousMonthKey("2026-11")).toBe("2026-10");
    expect(previousMonthKey("2026-10")).toBe("2026-09");
  });

  test("rejects anything that is not a YYYY-MM month key", () => {
    for (const bad of ["2026-13", "2026-00", "2026-7", "2026", "", "junk"]) {
      expect(() => previousMonthKey(bad)).toThrow(/Not a YYYY-MM month key/);
    }
  });
});
