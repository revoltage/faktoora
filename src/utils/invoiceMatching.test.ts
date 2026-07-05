import { describe, expect, test } from "vitest";

import { calculateMatchScore } from "./invoiceMatching";

describe("calculateMatchScore", () => {
  test("returns a perfect score for matching amount and invoice name", () => {
    const score = calculateMatchScore(
      {
        amount: "50.80",
        paymentCurrency: "BGN",
        description: "Faktoora Cloud Invoice",
      },
      {
        name: "Faktoora Cloud Invoice",
        analysis: { amount: { value: "50.80|BGN" } },
      },
    );

    expect(score).toBe(1);
  });

  test("weights amount matches more heavily than fuzzy name matches", () => {
    const score = calculateMatchScore(
      {
        amount: "100",
        paymentCurrency: "EUR",
        description: "Google Cloud Platform",
      },
      {
        fileName: "google-cloud-invoice.pdf",
        analysis: { amount: { value: "100|EUR" } },
      },
    );

    expect(score).toBeCloseTo(0.85);
  });

  test("uses the invoice filename when no friendly name exists", () => {
    const score = calculateMatchScore(
      {
        amount: "10",
        paymentCurrency: "EUR",
        description: "Vercel invoice",
      },
      {
        fileName: "vercel-january.pdf",
        analysis: { amount: { value: "20|EUR" } },
      },
    );

    expect(score).toBeCloseTo(0.1);
  });

  test("returns zero when neither amount nor name can match", () => {
    const score = calculateMatchScore(
      { amount: "100", paymentCurrency: "EUR", description: "Alpha" },
      { name: "Beta", analysis: { amount: { value: "300|EUR" } } },
    );

    expect(score).toBe(0);
  });

  test("returns zero when the transaction is missing", () => {
    expect(calculateMatchScore(null, {})).toBe(0);
    expect(calculateMatchScore(undefined, {})).toBe(0);
  });
});
