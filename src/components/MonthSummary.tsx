import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { parseInvoiceAmount } from "@/lib/currency";

type CurrencyTotals = Record<string, { total: number; count: number }>;

function addTo(totals: CurrencyTotals, currency: string, amount: number) {
  if (!totals[currency]) totals[currency] = { total: 0, count: 0 };
  totals[currency].total += amount;
  totals[currency].count++;
}

function formatAmount(amount: number, currency: string) {
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
  const expenses: CurrencyTotals = {};
  const income: CurrencyTotals = {};

  if (transactions) {
    for (const t of transactions) {
      const amount = parseFloat(t.amount);
      if (isNaN(amount) || !t.paymentCurrency) continue;

      if (expenseTypes.includes(t.type) && amount < 0) {
        addTo(expenses, t.paymentCurrency, amount);
      }

      if (incomeTypes.includes(t.type) && amount > 0) {
        addTo(income, t.paymentCurrency, amount);
      }
    }
  }

  const invoiceTotals: CurrencyTotals = {};
  for (const inv of invoices) {
    const parsed = parseInvoiceAmount(inv.analysis?.amount?.value);
    if (parsed) {
      addTo(invoiceTotals, parsed.currency, parsed.amount);
    }
  }

  const hasExpenses = Object.keys(expenses).length > 0;
  const hasIncome = Object.keys(income).length > 0;
  const hasInvoices = Object.keys(invoiceTotals).length > 0;

  if (!transactions || (!hasExpenses && !hasIncome && !hasInvoices)) {
    return null;
  }

  const renderTotals = (totals: CurrencyTotals) =>
    Object.entries(totals)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([currency, { total, count }]) => (
        <span key={currency}>
          <span className="font-semibold text-foreground">
            {formatAmount(total, currency)}
          </span>{" "}
          <span className="text-[10px]">({count})</span>
        </span>
      ));

  return (
    <div className="flex flex-col gap-1 text-xs text-muted-foreground">
      {hasExpenses && (
        <div className="flex flex-wrap gap-3">
          <span>Expenses:</span>
          {renderTotals(expenses)}
        </div>
      )}
      {hasIncome && (
        <div className="flex flex-wrap gap-3">
          <span>Income:</span>
          {renderTotals(income)}
        </div>
      )}
      {hasInvoices && (
        <div className="flex flex-wrap gap-3">
          <span>Invoices:</span>
          {renderTotals(invoiceTotals)}
        </div>
      )}
    </div>
  );
}
