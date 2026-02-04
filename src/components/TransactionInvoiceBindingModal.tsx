import { useMutation, useQuery } from "convex/react";
import { useState } from "react";

import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface TransactionInvoiceBindingModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: any;
  monthKey: string;
}

// ===========================================
// SCORING CONFIGURATION - easy to adjust
// ===========================================
const SCORING_CONFIG = {
  // Weight distribution (should sum to 1.0)
  weights: {
    amount: 0.7,  // How important is amount matching (0-1)
    name: 0.3,    // How important is name/description matching (0-1)
  },
  // Amount scoring parameters
  amount: {
    perfectMatchThreshold: 0.01,  // Amounts within 1% are considered perfect
    maxDeviationPercent: 50,      // Beyond 50% deviation, score is 0
  },
};

/**
 * Parse invoice amount from format "EUR|123.45" or "123.45"
 */
function parseInvoiceAmount(amountStr: string | undefined): { currency?: string; value: number } | null {
  if (!amountStr) return null;
  const parts = amountStr.split("|");
  if (parts.length === 2) {
    return { currency: parts[0], value: parseFloat(parts[1]) };
  }
  const val = parseFloat(amountStr);
  return isNaN(val) ? null : { value: val };
}

/**
 * Simple fuzzy string similarity (0-1)
 * Uses token overlap and substring matching
 */
function fuzzyMatch(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;

  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();

  if (s1 === s2) return 1;

  // Check if one contains the other
  if (s1.includes(s2) || s2.includes(s1)) return 0.8;

  // Token-based matching
  const tokens1 = s1.split(/[\s\-_.,]+/).filter(t => t.length > 2);
  const tokens2 = s2.split(/[\s\-_.,]+/).filter(t => t.length > 2);

  if (tokens1.length === 0 || tokens2.length === 0) return 0;

  let matchCount = 0;
  for (const t1 of tokens1) {
    for (const t2 of tokens2) {
      if (t1 === t2) {
        matchCount += 1;
      } else if (t1.includes(t2) || t2.includes(t1)) {
        matchCount += 0.5;
      }
    }
  }

  const maxPossible = Math.max(tokens1.length, tokens2.length);
  return Math.min(1, matchCount / maxPossible);
}

/**
 * Calculate match score between transaction and invoice (0-1)
 */
function calculateMatchScore(
  transaction: { amount?: string; paymentCurrency?: string; description?: string } | null | undefined,
  invoice: { name?: string; fileName?: string; analysis?: { amount?: { value?: string } } }
): number {
  if (!transaction) return 0;

  const { weights, amount: amountConfig } = SCORING_CONFIG;

  let amountScore = 0;
  let nameScore = 0;

  // Amount scoring
  const txAmount = transaction.amount ? parseFloat(transaction.amount) : null;
  const invAmountData = parseInvoiceAmount(invoice.analysis?.amount?.value);

  if (txAmount && invAmountData) {
    const invAmount = invAmountData.value;
    const diff = Math.abs(txAmount - invAmount);
    const percentDiff = (diff / Math.max(txAmount, invAmount)) * 100;

    if (percentDiff <= amountConfig.perfectMatchThreshold * 100) {
      amountScore = 1;
    } else if (percentDiff >= amountConfig.maxDeviationPercent) {
      amountScore = 0;
    } else {
      // Linear interpolation between perfect and max deviation
      amountScore = 1 - (percentDiff / amountConfig.maxDeviationPercent);
    }
  }

  // Name/description scoring
  const txDesc = transaction.description || "";
  const invName = invoice.name || invoice.fileName || "";
  nameScore = fuzzyMatch(txDesc, invName);

  // Weighted combination
  return (amountScore * weights.amount) + (nameScore * weights.name);
}

export function TransactionInvoiceBindingModal({
  isOpen,
  onClose,
  transaction,
  monthKey,
}: TransactionInvoiceBindingModalProps) {
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(
    transaction?.boundInvoiceStorageId || null
  );

  const monthData = useQuery(api.invoices.getMonthData, { monthKey });
  const bindTransaction = useMutation(api.invoices.bindTransactionToInvoice);

  // Get set of invoice storageIds already bound to OTHER transactions
  const boundToOtherTransactions = new Set(
    (monthData?.transactionInvoiceBindings || [])
      .filter((b) => b.transactionId !== transaction?.id)
      .map((b) => b.invoiceStorageId)
  );

  const handleSave = async () => {
    if (!transaction?.id) return;

    try {
      await bindTransaction({
        monthKey,
        transactionId: transaction.id,
        invoiceStorageId: selectedInvoiceId as Id<"_storage">,
      });
      onClose();
    } catch (error) {
      console.error("🔗 Failed to bind transaction to invoice:", error);
    }
  };

  const handleClose = () => {
    setSelectedInvoiceId(transaction?.boundInvoiceStorageId || null);
    onClose();
  };

  if (!monthData) {
    return (
      <Dialog open={isOpen} onOpenChange={handleClose}>
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
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm">
            🔗 Bind Transaction to Invoice
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Transaction info */}
          <div className="p-3 bg-gray-50 rounded-lg">
            <div className="text-xs font-medium text-gray-700 mb-1">
              Transaction
            </div>
            <div className="text-sm text-gray-900">
              {transaction?.description || "No description"}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {transaction?.amount && transaction?.paymentCurrency
                ? `${transaction.paymentCurrency} ${parseFloat(transaction.amount).toFixed(2)}`
                : "No amount"}
            </div>
          </div>

          {/* Invoice selection */}
          <div className="space-y-2">
            <div className="text-xs font-medium text-gray-700">
              Select Invoice
            </div>
            <div className="max-h-60 overflow-y-auto space-y-1">
              {/* "Nothing" option */}
              <label className="flex items-center p-1 hover:bg-gray-50 rounded cursor-pointer">
                <input
                  type="radio"
                  name="invoice"
                  value=""
                  checked={selectedInvoiceId === null}
                  onChange={() => setSelectedInvoiceId(null)}
                  className="mr-2"
                />
                <span className="text-sm text-gray-600">No invoice</span>
              </label>

              {/* Invoice options */}
              {invoices.map((invoice) => (
                <label
                  key={invoice.storageId}
                  className={`flex items-center p-1 hover:bg-gray-50 rounded cursor-pointer ${invoice.isBoundToOther ? "opacity-50" : ""}`}
                >
                  <input
                    type="radio"
                    name="invoice"
                    value={invoice.storageId}
                    checked={selectedInvoiceId === invoice.storageId}
                    onChange={() => setSelectedInvoiceId(invoice.storageId)}
                    className="mr-2"
                  />
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
                </label>
              ))}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={handleClose} size="sm">
              Cancel
            </Button>
            <Button onClick={() => void handleSave()} size="sm">
              Save Binding
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
