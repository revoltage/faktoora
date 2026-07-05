import { describe, expect, test } from "vitest";

import {
  currentMonthKey,
  formatMonthDisplay,
  isMonthKey,
  monthKeyFromPath,
} from "./dateFormat";

describe("date format helpers", () => {
  test("formats month keys for display", () => {
    expect(formatMonthDisplay("2026-03")).toBe("March 2026");
  });

  test("builds the current month key from a provided date", () => {
    expect(currentMonthKey(new Date(2026, 0, 5))).toBe("2026-01");
    expect(currentMonthKey(new Date(2026, 11, 31))).toBe("2026-12");
  });

  test("validates strict YYYY-MM month keys", () => {
    expect(isMonthKey("2026-01")).toBe(true);
    expect(isMonthKey("2026-12")).toBe(true);
    expect(isMonthKey("2026-00")).toBe(false);
    expect(isMonthKey("2026-13")).toBe(false);
    expect(isMonthKey("26-01")).toBe(false);
    expect(isMonthKey("2026-1")).toBe(false);
  });

  test("extracts valid month keys from paths", () => {
    expect(monthKeyFromPath("/2026-03")).toBe("2026-03");
    expect(monthKeyFromPath("2026-04")).toBe("2026-04");
  });

  test("falls back to the current month for invalid paths", () => {
    const now = new Date();
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    expect(monthKeyFromPath("/")).toBe(expected);
    expect(monthKeyFromPath("/settings")).toBe(expected);
  });
});
