import { useQuery } from "convex/react";
import { useState } from "react";

import { api } from "../convex/_generated/api";
import { TransactionDetailsModal } from "./components/TransactionDetailsModal";
import { TransactionInvoiceBindingModal } from "./components/TransactionInvoiceBindingModal";
import { Badge } from "./components/ui/badge";
import { Button } from "./components/ui/button";
import { getInvoiceHelperLinks } from "./lib/transactionHelperLinks";

const cfg = {
  // Filtering constants
  hidePositiveAmounts: true, // set to true to hide positive amounts
  hideExchangeRows: true, // set to true to hide rows with exchangeRate filled
  hideRevolutBusinessFee: true, // set to true to hide rows with description 'Revolut Business Fee'

  // Allowed transaction types (uncomment to allow more)
  allowedTransactionTypes: [
    "CARD_PAYMENT",
    // "FEE",
    // "EXCHANGE",
    // "TOPUP",
  ],
};

export function TransactionList({ monthKey }: { monthKey: string }) {
  const transactions = useQuery(api.invoices.getMergedTransactions, {
    monthKey,
  });
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showFiltered, setShowFiltered] = useState(true);
  const [bindingTransaction, setBindingTransaction] = useState<any>(null);
  const [isBindingModalOpen, setIsBindingModalOpen] = useState(false);

  if (!transactions) {
    return (
      <div className="flex justify-center items-center py-2">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Filter transactions based on constants
  const filteredTransactions = transactions.filter((transaction) => {
    // Filter by allowed transaction types
    if (!cfg.allowedTransactionTypes.includes(transaction.type)) {
      return false;
    }

    if (cfg.hidePositiveAmounts && transaction.amount) {
      const numAmount = parseFloat(transaction.amount);
      if (!isNaN(numAmount) && numAmount > 0) return false;
    }

    if (cfg.hideExchangeRows && transaction.exchangeRate) {
      return false;
    }

    if (
      cfg.hideRevolutBusinessFee &&
      transaction.description?.toLowerCase().includes("revolut business fee")
    ) {
      return false;
    }

    return true;
  });

  if (transactions.length === 0) {
    return (
      <div className="text-gray-500 text-sm py-4">
        📊 No transactions found in CSV statements
      </div>
    );
  }

  if (showFiltered && filteredTransactions.length === 0) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-foreground tracking-tight">
            📊 Transactions (0/{transactions.length})
          </h3>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFiltered(false)}
              className="text-[10px] h-6 px-2"
            >
              Show All
            </Button>
            <div className="text-[11px] text-muted-foreground">
              Merged from CSV statements
            </div>
          </div>
        </div>
        <div className="text-gray-500 text-sm py-4">
          📊 No transactions need invoices (all filtered out)
        </div>
      </div>
    );
  }

  const formatAmount = (amount: string, currency: string) => {
    if (!amount || amount === "") return "";
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount)) return amount;
    return `${currency} ${numAmount.toFixed(2)}`;
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "";
    try {
      return new Date(dateString).toISOString().split("T")[0];
    } catch {
      return dateString;
    }
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case "CARD_PAYMENT":
        return "💳";
      case "TRANSFER":
        return "💸";
      case "EXCHANGE":
        return "🔄";
      case "TOPUP":
        return "💰";
      case "FEE":
        return "📋";
      default:
        return "📄";
    }
  };

  const handleTransactionClick = (transaction: any) => {
    setSelectedTransaction(transaction);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedTransaction(null);
  };

  const handleBindingClick = (transaction: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setBindingTransaction(transaction);
    setIsBindingModalOpen(true);
  };

  const handleCloseBindingModal = () => {
    setIsBindingModalOpen(false);
    setBindingTransaction(null);
  };

  const getAmountColor = (amount: string) => {
    if (!amount) return "text-gray-500";
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount)) return "text-gray-500";
    return numAmount < 0 ? "text-red-600" : "text-green-600";
  };

  // Helper function to find matching links for a transaction
  const findHelperLinks = (description: string) => {
    return getInvoiceHelperLinks(description);
  };

  const displayTransactions = showFiltered
    ? filteredTransactions
    : transactions;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-foreground tracking-tight">
          📊 Transactions ({displayTransactions.length}
          {showFiltered && filteredTransactions.length !== transactions.length
            ? `/${transactions.length}`
            : ""}
          )
        </h3>
        <div className="flex items-center gap-2">
          <div className="text-[11px] text-muted-foreground">
            Merged from CSV statements
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFiltered(!showFiltered)}
            className="text-[10px] h-6 px-2"
          >
            {showFiltered ? "Show All" : "Hide Non-Invoice"}
          </Button>
        </div>
      </div>

      <div className="space-y-0">
        {displayTransactions.map((transaction, index) => {
          const helperLinks = findHelperLinks(transaction.description || "");

          return (
            <div
              key={`${transaction.id}-${index}`}
              className="flex items-center justify-between py-1 border-t border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer"
              onClick={() => handleTransactionClick(transaction)}
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="text-base flex-shrink-0">
                  {getTransactionIcon(transaction.type)}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5 min-w-0">
                    <span className="font-medium text-foreground truncate text-xs">
                      {transaction.description || "No description"}
                    </span>
                    <Badge 
                    variant="outline"
                    className="uppercase text-[8px] text-gray-500 px-1 py-0 shadow-none">
                      {transaction.type}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-[9px] text-muted-foreground min-w-0">
                    <span className="whitespace-nowrap">
                      {formatDate(
                        transaction.dateCompleted || transaction.dateStarted
                      )}
                    </span>

                    {helperLinks.length > 0 && (
                      <div className="flex gap-1">
                        {helperLinks.map((link, linkIndex) => (
                          <a
                            key={linkIndex}
                            href={link}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-blue-600 hover:text-blue-800 hover:underline text-[9px]"
                          >
                            {link.replace(/^https?:\/\//, "")}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                <div className="flex flex-col items-end text-right">
                  <div
                    className={`font-semibold text-xs ${getAmountColor(transaction.amount)}`}
                  >
                    {formatAmount(
                      transaction.amount,
                      transaction.paymentCurrency
                    )}
                  </div>
                  {transaction.origAmount &&
                    transaction.origAmount !== transaction.amount && (
                      <div className="text-[9px] text-muted-foreground">
                        {formatAmount(
                          transaction.origAmount,
                          transaction.origCurrency
                        )}
                      </div>
                    )}
                </div>
                
                {/* Binding button */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => handleBindingClick(transaction, e)}
                  className={`h-6 w-6 p-0 ${
                    transaction.boundInvoiceStorageId
                      ? "text-green-600 hover:text-green-700"
                      : "text-orange-500 hover:text-orange-600"
                  }`}
                  title={
                    transaction.boundInvoiceStorageId
                      ? "Change invoice binding"
                      : "Bind to invoice"
                  }
                >
                  {transaction.boundInvoiceStorageId ? "✓" : "⚠"}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <TransactionDetailsModal
        transaction={selectedTransaction}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
      />

      <TransactionInvoiceBindingModal
        transaction={bindingTransaction}
        isOpen={isBindingModalOpen}
        onClose={handleCloseBindingModal}
        monthKey={monthKey}
      />
    </div>
  );
}
