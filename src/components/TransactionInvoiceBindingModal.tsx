import { useMutation, useQuery } from "convex/react";
import { useState } from "react";

import { api } from "../../convex/_generated/api";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";

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
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(
    transaction?.boundInvoiceStorageId || null
  );

  const monthData = useQuery(api.invoices.getMonthData, { monthKey });
  const bindTransaction = useMutation(api.invoices.bindTransactionToInvoice);

  const handleSave = async () => {
    if (!transaction?.id) return;

    try {
      await bindTransaction({
        monthKey,
        transactionId: transaction.id,
        invoiceStorageId: selectedInvoiceId,
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

  const invoices = monthData.incomingInvoices || [];

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
              <label className="flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer">
                <input
                  type="radio"
                  name="invoice"
                  value=""
                  checked={selectedInvoiceId === null}
                  onChange={() => setSelectedInvoiceId(null)}
                  className="mr-2"
                />
                <div className="flex-1">
                  <div className="text-sm text-gray-600">🚫 No invoice</div>
                </div>
              </label>

              {/* Invoice options */}
              {invoices.map((invoice) => (
                <label
                  key={invoice.storageId}
                  className="flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer"
                >
                  <input
                    type="radio"
                    name="invoice"
                    value={invoice.storageId}
                    checked={selectedInvoiceId === invoice.storageId}
                    onChange={() => setSelectedInvoiceId(invoice.storageId)}
                    className="mr-2"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">
                      📄 {invoice.name || invoice.fileName}
                    </div>
                    <div className="text-xs text-gray-500">
                      {new Date(invoice.uploadedAt).toLocaleDateString()}
                    </div>
                    {invoice.analysis.sender.value && (
                      <div className="text-xs text-blue-600">
                        From: {invoice.analysis.sender.value}
                      </div>
                    )}
                    {invoice.analysis.date.value && (
                      <div className="text-xs text-green-600">
                        Date: {invoice.analysis.date.value}
                      </div>
                    )}
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={handleClose} size="sm">
              Cancel
            </Button>
            <Button onClick={handleSave} size="sm">
              Save Binding
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
