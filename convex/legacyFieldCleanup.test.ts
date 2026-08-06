import { describe, expect, test } from "vitest";

import { parseLegacyManualTransactions } from "./legacyFieldCleanup";

describe("parseLegacyManualTransactions", () => {
  test("keeps a bare name when the line has no amount", () => {
    expect(parseLegacyManualTransactions("Vivacom (интернет/тв)")).toEqual([
      { name: "Vivacom (интернет/тв)", amount: "" },
    ]);
  });

  test("splits a trailing numeric amount off the name", () => {
    expect(parseLegacyManualTransactions("Netflix, 15.99")).toEqual([
      { name: "Netflix", amount: "15.99" },
    ]);
    expect(parseLegacyManualTransactions("Rent, -800")).toEqual([
      { name: "Rent", amount: "-800" },
    ]);
  });

  test("only the last comma splits, so names may contain commas", () => {
    expect(parseLegacyManualTransactions("Acme, Inc, 20")).toEqual([
      { name: "Acme, Inc", amount: "20" },
    ]);
  });

  test("treats a non-numeric tail as part of the name", () => {
    expect(parseLegacyManualTransactions("Utilities, water")).toEqual([
      { name: "Utilities, water", amount: "" },
    ]);
  });

  test("skips blank lines and trims each entry", () => {
    expect(parseLegacyManualTransactions("  Foo , 1 \n\n   \n Bar\n")).toEqual([
      { name: "Foo", amount: "1" },
      { name: "Bar", amount: "" },
    ]);
  });

  test("never invents an entry from empty input", () => {
    expect(parseLegacyManualTransactions("")).toEqual([]);
    expect(parseLegacyManualTransactions("   \n \n")).toEqual([]);
  });
});
