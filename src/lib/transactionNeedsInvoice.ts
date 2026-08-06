import type { MergedTransaction } from "@/lib/types";

const cfg = {
  // Filtering constants
  hidePositiveAmounts: true, // set to true to hide positive amounts
  hideExchangeRows: true, // set to true to hide rows with exchangeRate filled
  hideRevolutBusinessFee: true, // set to true to hide rows with description 'Revolut Business Fee'

  // Allowed transaction types (uncomment to allow more)
  allowedTransactionTypes: [
    "CARD_PAYMENT",
    "MANUAL",
    // "FEE",
    // "EXCHANGE",
    // "TOPUP",
  ],
};

/**
 * Whether a transaction is expected to have an invoice attached.
 *
 * Shared by the transaction list's filter and the bulk auto-matcher so both
 * agree on which rows carry the obligation — matching a row the list hides
 * would produce a binding the user never sees.
 */
export function transactionNeedsInvoice(transaction: MergedTransaction) {
  // Refunded transactions don't need invoices
  if (transaction.isRefunded) {
    return false;
  }

  // Filter by allowed transaction types
  if (!cfg.allowedTransactionTypes.includes(transaction.type)) {
    return false;
  }

  if (cfg.hidePositiveAmounts && transaction.amount) {
    const numAmount = parseFloat(transaction.amount);
    if (!isNaN(numAmount) && numAmount > 0) return false;
  }

  if (cfg.hideExchangeRows && transaction.type === "EXCHANGE") {
    return false;
  }

  if (
    cfg.hideRevolutBusinessFee &&
    transaction.description?.toLowerCase().includes("revolut business fee")
  ) {
    return false;
  }

  return true;
}
