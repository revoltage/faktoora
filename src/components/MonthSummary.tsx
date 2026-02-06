import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toEur, formatEur, parseInvoiceAmount } from "@/lib/currency";

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

  // --- Transaction totals (expenses): CARD_PAYMENT/MANUAL, negative only ---
  const expenseTypes = ['CARD_PAYMENT', 'MANUAL'];
  let expenseTotalEur = 0;
  let expenseCount = 0;

  // --- Transaction totals (income): TRANSFER/TOPUP, positive only ---
  const incomeTypes = ['TRANSFER', 'TOPUP'];
  let incomeTotalEur = 0;
  let incomeCount = 0;

  if (transactions) {
    for (const t of transactions) {
      const amount = parseFloat(t.amount);
      if (isNaN(amount) || !t.paymentCurrency) continue;

      const amountEur = toEur(amount, t.paymentCurrency);

      if (expenseTypes.includes(t.type) && amount < 0) {
        expenseTotalEur += amountEur;
        expenseCount++;
      }

      if (incomeTypes.includes(t.type) && amount > 0) {
        incomeTotalEur += amountEur;
        incomeCount++;
      }
    }
  }

  // --- Invoice totals ---
  let invoiceTotalEur = 0;
  let invoiceCount = 0;

  for (const inv of invoices) {
    const parsed = parseInvoiceAmount(inv.analysis?.amount?.value);
    if (parsed) {
      invoiceTotalEur += toEur(parsed.amount, parsed.currency);
      invoiceCount++;
    }
  }

  if (!transactions || (expenseCount === 0 && incomeCount === 0 && invoiceCount === 0)) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
      {expenseCount > 0 && (
        <span>
          Expenses:{" "}
          <span className="font-semibold text-foreground">
            {formatEur(expenseTotalEur)}
          </span>{" "}
          <span className="text-[10px]">({expenseCount} txns)</span>
        </span>
      )}
      {incomeCount > 0 && (
        <span>
          Income:{" "}
          <span className="font-semibold text-foreground">
            {formatEur(incomeTotalEur)}
          </span>{" "}
          <span className="text-[10px]">({incomeCount} txns)</span>
        </span>
      )}
      {invoiceCount > 0 && (
        <span>
          Invoices:{" "}
          <span className="font-semibold text-foreground">
            {formatEur(invoiceTotalEur)}
          </span>{" "}
          <span className="text-[10px]">({invoiceCount} inv)</span>
        </span>
      )}
    </div>
  );
}
