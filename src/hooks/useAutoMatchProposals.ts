import { useQuery } from "convex/react";
import { useMemo } from "react";

import { api } from "../../convex/_generated/api";

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
 * Deterministic invoice <-> transaction pairs for the current month. Reads the
 * same `getMonthData` query the single-row binding modal uses, so the caller
 * pays no extra round trip.
 */
export function useAutoMatchProposals(
  monthKey: string,
  transactions: MergedTransaction[] | undefined,
): InvoiceMatchProposal[] {
  const monthData = useQuery(api.invoices.getMonthData, { monthKey });

  return useMemo(() => {
    if (!monthData || !transactions) return [];
    return buildAutoMatchProposals(
      transactions,
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
