import { describe, expect, test } from "vitest";

import { parseCsvTransactions } from "./monthData";

const columns = [
  "Started Date",
  "Completed Date",
  "ID",
  "Type",
  "State",
  "Description",
  "Reference",
  "Payer",
  "Card Number",
  "Card Label",
  "Card State",
  "Orig Currency",
  "Orig Amount",
  "Payment Currency",
  "Amount",
  "Total Amount",
  "Exchange Rate",
  "Fee",
  "Fee Currency",
  "Balance",
  "Account",
  "Beneficiary Account Number",
  "Beneficiary Sort Code",
  "Beneficiary IBAN",
  "Beneficiary BIC",
  "MCC",
  "Related Transaction ID",
  "Spend Program",
] as const;

type Column = (typeof columns)[number];

const baseRow: Record<Column, string> = {
  "Started Date": "2026-03-01 10:00:00",
  "Completed Date": "2026-03-01 10:00:03",
  ID: "tx-1",
  Type: "CARD_PAYMENT",
  State: "COMPLETED",
  Description: "Plain Vendor",
  Reference: "ref-1",
  Payer: "",
  "Card Number": "1234",
  "Card Label": "Main",
  "Card State": "ACTIVE",
  "Orig Currency": "EUR",
  "Orig Amount": "50.80",
  "Payment Currency": "EUR",
  Amount: "50.80",
  "Total Amount": "50.80",
  "Exchange Rate": "",
  Fee: "0",
  "Fee Currency": "EUR",
  Balance: "1000",
  Account: "Primary",
  "Beneficiary Account Number": "",
  "Beneficiary Sort Code": "",
  "Beneficiary IBAN": "",
  "Beneficiary BIC": "",
  MCC: "5734",
  "Related Transaction ID": "",
  "Spend Program": "",
};

function csvLine(values: readonly string[]): string {
  return values
    .map((value) => {
      if (!/[",\n]/.test(value)) return value;
      return `"${value.replaceAll('"', '""')}"`;
    })
    .join(",");
}

function csvFor(
  orderedColumns: readonly Column[],
  row: Record<Column, string> = baseRow,
): string {
  return [
    csvLine(orderedColumns),
    csvLine(orderedColumns.map((column) => row[column])),
  ].join("\n");
}

describe("parseCsvTransactions", () => {
  test("parses quoted fields with commas and escaped quotes", () => {
    const transactions = parseCsvTransactions(
      csvFor(columns, {
        ...baseRow,
        Description: 'Vendor, Inc. "Pro" subscription',
        Reference: "invoice, 123",
      }),
    );

    expect(transactions).toHaveLength(1);
    expect(transactions[0]).toMatchObject({
      id: "tx-1",
      description: 'Vendor, Inc. "Pro" subscription',
      reference: "invoice, 123",
      amount: "50.80",
      paymentCurrency: "EUR",
    });
  });

  test("maps fields by header name when CSV columns are reordered", () => {
    const reordered = [
      "Amount",
      "Description",
      "ID",
      ...columns.filter(
        (column) => !["Amount", "Description", "ID"].includes(column),
      ),
    ] as const;

    const transactions = parseCsvTransactions(
      csvFor(reordered, {
        ...baseRow,
        ID: "tx-reordered",
        Description: "Reordered Vendor",
        Amount: "123.45",
      }),
    );

    expect(transactions[0]).toMatchObject({
      id: "tx-reordered",
      description: "Reordered Vendor",
      amount: "123.45",
      type: "CARD_PAYMENT",
      dateStarted: "2026-03-01 10:00:00",
    });
  });

  test("fails loudly when a required Amount header is missing", () => {
    const withoutAmount = columns.filter((column) => column !== "Amount");

    expect(() => parseCsvTransactions(csvFor(withoutAmount))).toThrow(
      "Revolut CSV is missing required column: Amount",
    );
  });

  test("returns an empty list when no transaction rows are present", () => {
    expect(parseCsvTransactions(csvLine(columns))).toEqual([]);
  });
});
