import { useMutation, useQuery } from "convex/react";

import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { calculateMatchScore } from "@/utils/invoiceMatching";

export const NOT_NEEDED = "NOT_NEEDED" as const;

interface TransactionInvoiceBindingModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: any;
  monthKey: string;
}

export function TransactionInvoiceBindingModal({
  isOpen,
  onClose,
  transaction,
  monthKey,
}: TransactionInvoiceBindingModalProps) {
  const monthData = useQuery(api.invoices.getMonthData, { monthKey });
  const bindTransaction = useMutation(api.invoices.bindTransactionToInvoice);

  // Get set of invoice storageIds already bound to OTHER transactions
  const boundToOtherTransactions = new Set(
    (monthData?.transactionInvoiceBindings || [])
      .filter((b) => b.transactionId !== transaction?.id)
      .map((b) => b.invoiceStorageId)
  );

  const handleBind = async (invoiceStorageId: string | typeof NOT_NEEDED | null) => {
    if (!transaction?.id) return;

    try {
      await bindTransaction({
        monthKey,
        transactionId: transaction.id,
        invoiceStorageId: invoiceStorageId as Id<"_storage"> | typeof NOT_NEEDED | null,
      });
      onClose();
    } catch (error) {
      console.error("🔗 Failed to bind transaction to invoice:", error);
    }
  };

  if (!monthData) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md">
          <div className="flex justify-center items-center py-4">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Score and sort invoices: by score (highest first), then unbound before bound
  const invoicesWithScores = (monthData.incomingInvoices || []).map((invoice) => ({
    ...invoice,
    matchScore: calculateMatchScore(transaction, invoice),
    isBoundToOther: boundToOtherTransactions.has(invoice.storageId),
  }));

  const invoices = invoicesWithScores.sort((a, b) => {
    // First: unbound invoices before bound ones
    if (a.isBoundToOther !== b.isBoundToOther) {
      return a.isBoundToOther ? 1 : -1;
    }
    // Second: higher score first
    return b.matchScore - a.matchScore;
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm">
            🔗 Bind Transaction to Invoice
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Transaction info */}
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <span className="text-sm font-bold text-gray-900 truncate">
              {transaction?.description || "No description"}
            </span>
            <span className="text-xs text-gray-500 ml-2 flex-shrink-0">
              {transaction?.amount && transaction?.paymentCurrency
                ? `${transaction.paymentCurrency} ${parseFloat(transaction.amount).toFixed(2)}`
                : ""}
            </span>
          </div>

          {/* Invoice selection - click to bind */}
          <div className="space-y-2">
            <div className="text-xs font-medium text-gray-700">
              Select Invoice
            </div>
            <div className="max-h-60 overflow-y-auto space-y-1">
              {/* Invoice options */}
              {invoices.map((invoice) => (
                <div
                  key={invoice.storageId}
                  onClick={() => void handleBind(invoice.storageId)}
                  className={`flex items-center p-2 hover:bg-gray-100 rounded cursor-pointer ${
                    invoice.isBoundToOther ? "opacity-50" : ""
                  } ${transaction?.boundInvoiceStorageId === invoice.storageId ? "bg-green-50" : ""}`}
                >
                  <span className={`text-sm truncate ${invoice.isBoundToOther ? "text-gray-500" : "text-gray-900"}`}>
                    {invoice.name || invoice.fileName}
                  </span>
                  <span className="text-xs text-gray-500 ml-auto">
                    {new Date(invoice.uploadedAt).toLocaleDateString()}
                    {invoice.analysis.amount.value && (
                      <span className={`ml-1 ${invoice.isBoundToOther ? "text-gray-500" : "font-bold text-gray-700"}`}>
                        {invoice.analysis.amount.value.replace("|", " ")}
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleBind(NOT_NEEDED)}
            className="text-gray-500"
          >
            Not Needed
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleBind(null)}
            className="text-gray-600"
          >
            Clear Binding
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
