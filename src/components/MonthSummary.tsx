import { useQuery } from "convex/react";
import { Fragment } from "react";
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

  const cols = [
    expenseCount > 0 && { label: 'Expenses', eurAmount: Math.abs(expenseEur), tooltip: `${expenseCount} transactions (CARD_PAYMENT, MANUAL)` },
    incomeCount > 0 && { label: 'Income', eurAmount: incomeEur, tooltip: `${incomeCount} transactions (TRANSFER, TOPUP)` },
    invoiceCount > 0 && { label: 'Invoices', eurAmount: invoiceEur, tooltip: `${invoiceCount} invoices` },
  ].filter(Boolean) as { label: string; eurAmount: number; tooltip: string }[];

  return (
    <div
      className="grid w-fit gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground"
      style={{ gridTemplateColumns: `repeat(${cols.length}, auto auto)` }}
    >
      {DISPLAY_CURRENCIES.map(currency =>
        cols.map(col => (
          <Fragment key={`${currency}-${col.label}`}>
            <span title={col.tooltip}>{col.label}:</span>
            <span className="text-right font-semibold text-foreground tabular-nums" title={col.tooltip}>
              {format(fromEur(col.eurAmount, currency), currency)}
            </span>
          </Fragment>
        ))
      )}
    </div>
  );
}
