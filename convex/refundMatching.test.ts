import { describe, expect, test } from "vitest";

import { addRefundStatus, findRefundedPaymentIds } from "./refundMatching";

type RefundTestTransaction = {
  id: string;
  type: string;
  dateStarted: string;
  dateCompleted: string;
  origAmount: string;
  origCurrency: string;
  mcc: string;
};

function tx(
  overrides: Partial<RefundTestTransaction> &
    Pick<RefundTestTransaction, "id" | "type">,
): RefundTestTransaction {
  return {
    dateStarted: "2026-03-01T00:00:00Z",
    dateCompleted: "2026-03-01T00:00:00Z",
    origAmount: "10",
    origCurrency: "EUR",
    mcc: "5734",
    ...overrides,
  };
}

describe("refund matching", () => {
  test("matches each refund to the latest eligible payment before it", () => {
    const transactions = [
      tx({
        id: "older",
        type: "CARD_PAYMENT",
        dateCompleted: "2026-03-01T10:00:00Z",
      }),
      tx({
        id: "latest",
        type: "CARD_PAYMENT",
        dateCompleted: "2026-03-02T10:00:00Z",
      }),
      tx({
        id: "refund",
        type: "CARD_REFUND",
        dateCompleted: "2026-03-03T10:00:00Z",
        origAmount: "-10",
      }),
    ];

    expect(findRefundedPaymentIds(transactions)).toEqual(new Set(["latest"]));
  });

  test("does not double-claim a payment for multiple matching refunds", () => {
    const transactions = [
      tx({
        id: "first",
        type: "CARD_PAYMENT",
        dateCompleted: "2026-03-01T10:00:00Z",
      }),
      tx({
        id: "second",
        type: "CARD_PAYMENT",
        dateCompleted: "2026-03-02T10:00:00Z",
      }),
      tx({
        id: "refund-a",
        type: "CARD_REFUND",
        dateCompleted: "2026-03-03T10:00:00Z",
        origAmount: "-10",
      }),
      tx({
        id: "refund-b",
        type: "CARD_REFUND",
        dateCompleted: "2026-03-04T10:00:00Z",
        origAmount: "-10",
      }),
    ];

    expect(findRefundedPaymentIds(transactions)).toEqual(
      new Set(["second", "first"]),
    );
  });

  test("requires matching currency, MCC, amount, and non-future payment date", () => {
    const transactions = [
      tx({ id: "currency", type: "CARD_PAYMENT", origCurrency: "USD" }),
      tx({ id: "mcc", type: "CARD_PAYMENT", mcc: "5812" }),
      tx({ id: "amount", type: "CARD_PAYMENT", origAmount: "11" }),
      tx({
        id: "future",
        type: "CARD_PAYMENT",
        dateCompleted: "2026-03-05T10:00:00Z",
      }),
      tx({
        id: "refund",
        type: "CARD_REFUND",
        dateCompleted: "2026-03-03T10:00:00Z",
        origAmount: "-10",
      }),
    ];

    expect(findRefundedPaymentIds(transactions)).toEqual(new Set());
  });

  test("adds isRefunded flags without mutating transaction fields", () => {
    const transactions = [
      tx({ id: "payment", type: "CARD_PAYMENT" }),
      tx({
        id: "refund",
        type: "CARD_REFUND",
        dateCompleted: "2026-03-02T00:00:00Z",
        origAmount: "-10",
      }),
    ];

    expect(addRefundStatus(transactions)).toEqual([
      { ...transactions[0], isRefunded: true },
      { ...transactions[1], isRefunded: false },
    ]);
  });
});
