import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toEur, fromEur, parseInvoiceAmount } from "@/lib/currency";

const DISPLAY_CURRENCIES = ['EUR', 'USD', 'BGN'] as const;

function format(amount: number, currency: string) {
  return `${currency} ${amount.toFixed(2)}`;
}

export function MonthSummary({
  monthKey,
  invoices,
}: {
  monthKey: string;
  invoices: any[];
}) {
  const transactions = useQuery(api.invoices.getMergedTransactions, {
    monthKey,
  });

  const expenseTypes = ['CARD_PAYMENT', 'MANUAL'];
  const incomeTypes = ['TRANSFER', 'TOPUP'];
  let expenseEur = 0;
  let expenseCount = 0;
  let incomeEur = 0;
  let incomeCount = 0;

  if (transactions) {
    for (const t of transactions) {
      const amount = parseFloat(t.amount);
      if (isNaN(amount) || !t.paymentCurrency) continue;

      if (expenseTypes.includes(t.type) && amount < 0) {
        expenseEur += toEur(amount, t.paymentCurrency);
        expenseCount++;
      }

      if (incomeTypes.includes(t.type) && amount > 0) {
        incomeEur += toEur(amount, t.paymentCurrency);
        incomeCount++;
      }
    }
  }

  let invoiceEur = 0;
  let invoiceCount = 0;

  for (const inv of invoices) {
    const parsed = parseInvoiceAmount(inv.analysis?.amount?.value);
    if (parsed) {
      invoiceEur += toEur(parsed.amount, parsed.currency);
      invoiceCount++;
    }
  }

  if (!transactions || (expenseCount === 0 && incomeCount === 0 && invoiceCount === 0)) {
    return null;
  }

  const renderRow = (currency: string) => (
    <div key={currency} className="flex flex-wrap gap-3">
      {expenseCount > 0 && (
        <span>
          Expenses:{" "}
          <span className="font-semibold text-foreground">
            {format(fromEur(expenseEur, currency), currency)}
          </span>{" "}
          <span className="text-[10px]">({expenseCount} txns)</span>
        </span>
      )}
      {incomeCount > 0 && (
        <span>
          Income:{" "}
          <span className="font-semibold text-foreground">
            {format(fromEur(incomeEur, currency), currency)}
          </span>{" "}
          <span className="text-[10px]">({incomeCount} txns)</span>
        </span>
      )}
      {invoiceCount > 0 && (
        <span>
          Invoices:{" "}
          <span className="font-semibold text-foreground">
            {format(fromEur(invoiceEur, currency), currency)}
          </span>{" "}
          <span className="text-[10px]">({invoiceCount} inv)</span>
        </span>
      )}
    </div>
  );

  return (
    <div className="flex flex-col gap-1 text-xs text-muted-foreground">
      {DISPLAY_CURRENCIES.map(renderRow)}
    </div>
  );
}
