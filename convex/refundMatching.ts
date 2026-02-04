/**
 * Refund matching utility
 *
 * Matches CARD_REFUND transactions to their original CARD_PAYMENT using:
 * - Same origAmount (absolute value)
 * - Same origCurrency
 * - Same mcc (merchant code)
 * - Refund date >= payment date
 *
 * When multiple payments match, the most recent payment before the refund is selected.
 */

interface Transaction {
  id: string;
  type: string;
  dateStarted: string;
  dateCompleted: string;
  origAmount: string;
  origCurrency: string;
  mcc: string;
}

/**
 * Finds IDs of payments that were later refunded
 */
export function findRefundedPaymentIds<T extends Transaction>(
  transactions: T[]
): Set<string> {
  const refundedPaymentIds = new Set<string>();

  const refunds = transactions
    .filter(t => t.type === 'CARD_REFUND')
    .sort((a, b) =>
      new Date(a.dateCompleted).getTime() - new Date(b.dateCompleted).getTime()
    );

  for (const refund of refunds) {
    const refundDate = new Date(refund.dateCompleted || refund.dateStarted);
    const refundAmount = Math.abs(parseFloat(refund.origAmount));

    // Find matching payment: same amount, currency, mcc, before refund date, not already matched
    const matchingPayment = transactions
      .filter(t =>
        t.type === 'CARD_PAYMENT' &&
        !refundedPaymentIds.has(t.id) &&
        Math.abs(parseFloat(t.origAmount)) === refundAmount &&
        t.origCurrency === refund.origCurrency &&
        t.mcc === refund.mcc &&
        new Date(t.dateCompleted || t.dateStarted) <= refundDate
      )
      .sort((a, b) =>
        new Date(b.dateCompleted).getTime() - new Date(a.dateCompleted).getTime()
      )[0];

    if (matchingPayment) {
      refundedPaymentIds.add(matchingPayment.id);
    }
  }

  return refundedPaymentIds;
}

/**
 * Adds isRefunded flag to each transaction
 */
export function addRefundStatus<T extends Transaction>(
  transactions: T[]
): (T & { isRefunded: boolean })[] {
  const refundedIds = findRefundedPaymentIds(transactions);

  return transactions.map(t => ({
    ...t,
    isRefunded: refundedIds.has(t.id)
  }));
}
