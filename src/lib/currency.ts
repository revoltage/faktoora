/**
 * Currency conversion constants and utilities.
 * EUR is used as the base currency.
 * Rates as of February 2026.
 */

// How many units of X you get for 1 EUR
export const EUR_RATES: Record<string, number> = {
  EUR: 1,
  USD: 1.18,
  BGN: 1.9558,
};

export type SupportedCurrency = keyof typeof EUR_RATES;

/** Convert an amount from `fromCurrency` to EUR. */
export function toEur(amount: number, fromCurrency: string): number {
  const rate = EUR_RATES[fromCurrency];
  if (rate === undefined) return amount; // unknown currency, pass through
  return amount / rate;
}

/** Convert an amount from EUR to `toCurrency`. */
export function fromEur(amountEur: number, toCurrency: string): number {
  const rate = EUR_RATES[toCurrency];
  if (rate === undefined) return amountEur;
  return amountEur * rate;
}

/** Convert between any two supported currencies. */
export function convert(amount: number, from: string, to: string): number {
  if (from === to) return amount;
  return fromEur(toEur(amount, from), to);
}

/** Format EUR amount for display. */
export function formatEur(amount: number): string {
  return `EUR ${amount.toFixed(2)}`;
}

/**
 * Parse an invoice amount string like "50.80|BGN" into { amount, currency }.
 * Returns null if unparseable.
 */
export function parseInvoiceAmount(
  value: string | null | undefined
): { amount: number; currency: string } | null {
  if (!value) return null;
  const parts = value.split("|");
  if (parts.length !== 2) return null;
  const amount = parseFloat(parts[0]);
  const currency = parts[1].trim();
  if (isNaN(amount) || !currency) return null;
  return { amount, currency };
}
