import { describe, expect, test } from "vitest";

import {
  buildAutoMatchProposals,
  normalizeName,
  proposalKey,
  type AutoMatchInvoice,
  type AutoMatchTransaction,
} from "./invoiceAutoMatch";

function tx(
  overrides: Partial<AutoMatchTransaction> & { id: string },
): AutoMatchTransaction {
  return {
    amount: "-100.00",
    paymentCurrency: "EUR",
    description: "Acme Cloud",
    ...overrides,
  };
}

function invoice(
  overrides: Partial<AutoMatchInvoice> & { storageId: string },
): AutoMatchInvoice {
  const { analysis, ...rest } = overrides;
  return {
    fileName: "acme-cloud.pdf",
    ...rest,
    analysis: {
      amount: { value: "100.00|EUR" },
      sender: { value: null },
      ...analysis,
    },
  };
}

describe("normalizeName", () => {
  test("strips punctuation and case, keeps non-latin letters", () => {
    expect(normalizeName("  ACME*Cloud, Ltd. ")).toBe("acme cloud ltd");
    expect(normalizeName("Мобилтел")).toBe("мобилтел");
    expect(normalizeName(null)).toBe("");
  });
});

describe("buildAutoMatchProposals", () => {
  test("marks currency+amount+name agreement as exact despite sign and punctuation", () => {
    const proposals = buildAutoMatchProposals(
      [tx({ id: "t1", description: "ACME-CLOUD" })],
      [invoice({ storageId: "i1", name: "Acme Cloud" })],
    );

    expect(proposals).toHaveLength(1);
    expect(proposals[0].kind).toBe("exact");
    expect(proposals[0].nameScore).toBe(1);
    expect(proposals[0].amount).toBe(100);
    expect(proposals[0].currency).toBe("EUR");
  });

  test("matches on the parsed sender when the filename is meaningless", () => {
    const proposals = buildAutoMatchProposals(
      [tx({ id: "t1", description: "Acme Cloud" })],
      [
        invoice({
          storageId: "i1",
          name: "invoice_20240102",
          analysis: { sender: { value: "Acme Cloud" } },
        }),
      ],
    );

    expect(proposals[0].kind).toBe("exact");
  });

  test("requires the same currency even when the amount is identical", () => {
    expect(
      buildAutoMatchProposals(
        [tx({ id: "t1", paymentCurrency: "BGN" })],
        [invoice({ storageId: "i1", name: "Acme Cloud" })],
      ),
    ).toEqual([]);
  });

  test("accepts amounts inside the 1% tolerance and rejects amounts outside it", () => {
    const inTolerance = buildAutoMatchProposals(
      [tx({ id: "t1", amount: "-100.50" })],
      [invoice({ storageId: "i1" })],
    );
    expect(inTolerance).toHaveLength(1);

    const outOfTolerance = buildAutoMatchProposals(
      [tx({ id: "t1", amount: "-102.00" })],
      [invoice({ storageId: "i1" })],
    );
    expect(outOfTolerance).toEqual([]);
  });

  test("classifies amount+currency agreement with a different name as fuzzy", () => {
    const proposals = buildAutoMatchProposals(
      [tx({ id: "t1", description: "SUMUP *KIOSK" })],
      [invoice({ storageId: "i1", name: "hosting-january" })],
    );

    expect(proposals).toHaveLength(1);
    expect(proposals[0].kind).toBe("fuzzy");
    expect(proposals[0].nameScore).toBeLessThan(1);
  });

  test("skips transactions that are already bound, including NOT_NEEDED", () => {
    const proposals = buildAutoMatchProposals(
      [
        tx({ id: "t1", boundInvoiceStorageId: "iOther" }),
        tx({ id: "t2", boundInvoiceStorageId: "NOT_NEEDED" }),
      ],
      [invoice({ storageId: "i1", name: "Acme Cloud" })],
    );

    expect(proposals).toEqual([]);
  });

  test("skips invoices already claimed by an existing binding", () => {
    const proposals = buildAutoMatchProposals(
      [tx({ id: "t1" })],
      [invoice({ storageId: "i1", name: "Acme Cloud" })],
      { boundInvoiceStorageIds: ["i1"] },
    );

    expect(proposals).toEqual([]);
  });

  test("keeps the proposal set 1:1, letting the exact pair win over the fuzzy one", () => {
    const proposals = buildAutoMatchProposals(
      [tx({ id: "t1", description: "Acme Cloud" })],
      [
        invoice({ storageId: "iFuzzy", name: "some-unrelated-vendor" }),
        invoice({ storageId: "iExact", name: "Acme Cloud" }),
      ],
    );

    expect(proposals).toHaveLength(1);
    expect(proposals[0].invoice.storageId).toBe("iExact");
  });

  test("resolves competing pairs greedily by highest string similarity", () => {
    // Both transactions cost 100 EUR and both invoices are 100 EUR, so only
    // the names can break the tie.
    const proposals = buildAutoMatchProposals(
      [
        tx({ id: "t1", description: "Hetzner Online" }),
        tx({ id: "t2", description: "Digital Ocean" }),
      ],
      [
        invoice({ storageId: "iHetzner", name: "Hetzner Online" }),
        invoice({ storageId: "iOcean", name: "Digital Ocean" }),
      ],
    );

    expect(
      proposals.map((p) => [p.transaction.id, p.invoice.storageId]),
    ).toEqual([
      ["t1", "iHetzner"],
      ["t2", "iOcean"],
    ]);
  });

  test("orders exact proposals before fuzzy ones", () => {
    const proposals = buildAutoMatchProposals(
      [
        tx({ id: "t1", description: "Unrelated Merchant", amount: "-42.00" }),
        tx({ id: "t2", description: "Acme Cloud" }),
      ],
      [
        invoice({
          storageId: "iFuzzy",
          name: "hosting-january",
          analysis: { amount: { value: "42.00|EUR" } },
        }),
        invoice({ storageId: "iExact", name: "Acme Cloud" }),
      ],
    );

    expect(proposals.map((p) => p.kind)).toEqual(["exact", "fuzzy"]);
  });

  test("ignores rows without a usable amount or currency", () => {
    const proposals = buildAutoMatchProposals(
      [
        tx({ id: "t1", amount: "" }),
        tx({ id: "t2", amount: "0" }),
        tx({ id: "t3", paymentCurrency: "" }),
      ],
      [
        invoice({ storageId: "i1", analysis: { amount: { value: null } } }),
        invoice({ storageId: "i2", analysis: { amount: { value: "100.00" } } }),
        invoice({ storageId: "i3" }),
      ],
    );

    expect(proposals).toEqual([]);
  });

  test("proposalKey identifies a pair uniquely", () => {
    expect(
      proposalKey({ transaction: { id: "t1" }, invoice: { storageId: "i1" } }),
    ).toBe("t1::i1");
  });
});
