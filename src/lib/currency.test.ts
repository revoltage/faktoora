import { describe, expect, test } from "vitest";

import {
  convert,
  formatEur,
  fromEur,
  parseInvoiceAmount,
  toEur,
} from "./currency";

describe("currency utilities", () => {
  test("converts supported currencies through EUR", () => {
    expect(toEur(195.58, "BGN")).toBeCloseTo(100);
    expect(fromEur(100, "USD")).toBeCloseTo(118);
    expect(convert(195.58, "BGN", "USD")).toBeCloseTo(118);
  });

  test("passes unknown currencies through unchanged", () => {
    expect(toEur(42, "JPY")).toBe(42);
    expect(fromEur(42, "JPY")).toBe(42);
    expect(convert(42, "JPY", "USD")).toBeCloseTo(49.56);
  });

  test("formats EUR amounts with fixed cents", () => {
    expect(formatEur(12)).toBe("EUR 12.00");
    expect(formatEur(12.345)).toBe("EUR 12.35");
  });

  test("parses invoice amount payloads", () => {
    expect(parseInvoiceAmount("50.80|BGN")).toEqual({
      amount: 50.8,
      currency: "BGN",
    });
    expect(parseInvoiceAmount(" 12.5 | EUR ")).toEqual({
      amount: 12.5,
      currency: "EUR",
    });
  });

  test("rejects malformed invoice amount payloads", () => {
    expect(parseInvoiceAmount(null)).toBeNull();
    expect(parseInvoiceAmount(undefined)).toBeNull();
    expect(parseInvoiceAmount("50.80")).toBeNull();
    expect(parseInvoiceAmount("amount|BGN")).toBeNull();
    expect(parseInvoiceAmount("50.80| ")).toBeNull();
  });
});
