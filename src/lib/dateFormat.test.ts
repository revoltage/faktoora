import { describe, expect, test } from "vitest";

import {
  currentMonthKey,
  formatMonthDisplay,
  gmailAttachmentSearchUrl,
  isMonthKey,
  monthKeyFromPath,
  monthKeyOfInvoiceDate,
} from "./dateFormat";

describe("date format helpers", () => {
  test("formats month keys for display", () => {
    expect(formatMonthDisplay("2026-03")).toBe("March 2026");
  });

  test("builds the current month key from a provided date", () => {
    expect(currentMonthKey(new Date(2026, 0, 5))).toBe("2026-01");
    expect(currentMonthKey(new Date(2026, 11, 31))).toBe("2026-12");
  });

  test("builds the monthly Gmail attachment search range", () => {
    expect(gmailAttachmentSearchUrl("2026-07")).toBe(
      "https://mail.google.com/mail/u/0/#search/has%3Aattachment+after%3A2026%2F7%2F1+before%3A2026%2F8%2F3",
    );
    expect(gmailAttachmentSearchUrl("2026-12")).toBe(
      "https://mail.google.com/mail/u/0/#search/has%3Aattachment+after%3A2026%2F12%2F1+before%3A2027%2F1%2F3",
    );
  });

  test("reads the month key off a parsed invoice date", () => {
    expect(monthKeyOfInvoiceDate("2026-03-01")).toBe("2026-03");
    expect(monthKeyOfInvoiceDate("2026-03-31")).toBe("2026-03");
    expect(monthKeyOfInvoiceDate("2026-12-31T23:30:00Z")).toBe("2026-12");
  });

  test("falls back to date parsing for non-ISO invoice dates", () => {
    expect(monthKeyOfInvoiceDate("March 15, 2026")).toBe("2026-03");
  });

  test("returns null for invoice dates it cannot place in a month", () => {
    expect(monthKeyOfInvoiceDate("")).toBeNull();
    expect(monthKeyOfInvoiceDate("not a date")).toBeNull();
    expect(monthKeyOfInvoiceDate("2026-13-01")).toBeNull();
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

  test("falls back to the previous month for invalid paths", () => {
    const march = new Date(2026, 2, 15);

    expect(monthKeyFromPath("/", march)).toBe("2026-02");
    expect(monthKeyFromPath("/settings", march)).toBe("2026-02");
    expect(monthKeyFromPath("/", new Date(2026, 0, 1))).toBe("2025-12");
  });
});
