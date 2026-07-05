/**
 * Currency conversion constants and utilities.
 * EUR is used as the base currency.
 *
 * Static fallback rates are visible in the UI and can be overridden in user
 * settings with `CODE=units-per-EUR` lines, e.g. `USD=1.18`.
 *
 * Rate snapshot: European Central Bank reference rates, 2026-02-01.
 */

// How many units of X you get for 1 EUR.
export const EUR_RATES: Record<string, number> = {
  EUR: 1,
  USD: 1.18,
  BGN: 1.9558,
};

export const EUR_RATE_METADATA = {
  source: "User settings or European Central Bank fallback reference rates",
  asOf: "2026-02-01",
  baseCurrency: "EUR",
} as const;

export type CurrencyRates = Record<string, number>;
export type SupportedCurrency = keyof typeof EUR_RATES;

export function parseCurrencyRates(
  value: string | null | undefined,
): CurrencyRates {
  const rates: CurrencyRates = { ...EUR_RATES };
  if (!value) {
    return rates;
  }

  for (const line of value.split(/\r?\n/)) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith("#")) {
      continue;
    }

    const [rawCurrency, rawRate] = trimmedLine.split(/[=:]/, 2);
    const currency = rawCurrency?.trim().toUpperCase();
    const rate = Number(rawRate?.trim());
    if (currency && Number.isFinite(rate) && rate > 0) {
      rates[currency] = rate;
    }
  }

  rates.EUR = 1;
  return rates;
}

/** Convert an amount from `fromCurrency` to EUR. */
export function toEur(
  amount: number,
  fromCurrency: string,
  rates: CurrencyRates = EUR_RATES,
): number {
  const rate = rates[fromCurrency.toUpperCase()];
  if (rate === undefined) return amount; // unknown currency, pass through
  return amount / rate;
}

/** Convert an amount from EUR to `toCurrency`. */
export function fromEur(
  amountEur: number,
  toCurrency: string,
  rates: CurrencyRates = EUR_RATES,
): number {
  const rate = rates[toCurrency.toUpperCase()];
  if (rate === undefined) return amountEur;
  return amountEur * rate;
}

/** Convert between any two supported currencies. */
export function convert(
  amount: number,
  from: string,
  to: string,
  rates: CurrencyRates = EUR_RATES,
): number {
  if (from === to) return amount;
  return fromEur(toEur(amount, from, rates), to, rates);
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
  value: string | null | undefined,
): { amount: number; currency: string } | null {
  if (!value) return null;
  const parts = value.split("|");
  if (parts.length !== 2) return null;
  const amount = parseFloat(parts[0]);
  const currency = parts[1].trim();
  if (isNaN(amount) || !currency) return null;
  return { amount, currency };
}
