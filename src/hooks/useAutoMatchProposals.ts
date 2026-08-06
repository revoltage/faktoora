import { useQuery } from "convex/react";
import { useMemo } from "react";

import { api } from "../../convex/_generated/api";

import { transactionNeedsInvoice } from "@/lib/transactionNeedsInvoice";
import type { IncomingInvoice, MergedTransaction } from "@/lib/types";
import {
  buildAutoMatchProposals,
  type AutoMatchProposal,
} from "@/utils/invoiceAutoMatch";

export type InvoiceMatchProposal = AutoMatchProposal<
  MergedTransaction,
  IncomingInvoice
>;

/**
 * Deterministic invoice <-> transaction pairs for the current month.
 *
 * Self-contained on purpose: it reads the same two queries the invoice and
 * transaction lists already subscribe to, so any component can show the
 * proposal count without threading transactions through as props.
 */
export function useAutoMatchProposals(
  monthKey: string,
): InvoiceMatchProposal[] {
  const monthData = useQuery(api.invoices.getMonthData, { monthKey });
  const transactions = useQuery(api.invoices.getMergedTransactions, {
    monthKey,
  });

  return useMemo(() => {
    if (!monthData || !transactions) return [];
    return buildAutoMatchProposals(
      // Only rows the transaction list expects an invoice for are eligible.
      transactions.filter(transactionNeedsInvoice),
      monthData.incomingInvoices ?? [],
      {
        boundInvoiceStorageIds: (
          monthData.transactionInvoiceBindings ?? []
        ).flatMap((binding) =>
          binding.invoiceStorageId ? [binding.invoiceStorageId] : [],
        ),
      },
    );
  }, [monthData, transactions]);
}
