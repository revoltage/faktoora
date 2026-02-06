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

  // --- Transaction totals ---
  let transactionTotalEur = 0;
  let transactionCount = 0;

  if (transactions) {
    for (const t of transactions) {
      const amount = parseFloat(t.origAmount || t.amount);
      const currency = t.origCurrency || t.paymentCurrency;
      if (!isNaN(amount) && currency) {
        transactionTotalEur += toEur(amount, currency);
        transactionCount++;
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

  if (!transactions || (transactionCount === 0 && invoiceCount === 0)) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
      {transactionCount > 0 && (
        <span>
          Transactions total:{" "}
          <span className="font-semibold text-foreground">
            {formatEur(transactionTotalEur)}
          </span>{" "}
          <span className="text-[10px]">({transactionCount} txns)</span>
        </span>
      )}
      {invoiceCount > 0 && (
        <span>
          Invoices total:{" "}
          <span className="font-semibold text-foreground">
            {formatEur(invoiceTotalEur)}
          </span>{" "}
          <span className="text-[10px]">({invoiceCount} inv)</span>
        </span>
      )}
    </div>
  );
}
