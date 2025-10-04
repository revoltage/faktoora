import { useQuery } from "convex/react";
import { FileIcon, UserIcon } from "lucide-react";
import { useState } from "react";

import { api } from "../convex/_generated/api";
import { TransactionDetailsModal } from "./components/TransactionDetailsModal";
import { Badge } from "./components/ui/badge";

interface TransactionListProps {
  monthKey: string;
}

export function TransactionList({ monthKey }: TransactionListProps) {
  const transactions = useQuery(api.invoices.getMergedTransactions, {
    monthKey,
  });
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  if (!transactions) {
    return (
      <div className="flex justify-center items-center py-2">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="text-gray-500 text-sm py-4">
        📊 No transactions found in CSV statements
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

  const getAmountColor = (amount: string) => {
    if (!amount) return "text-gray-500";
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount)) return "text-gray-500";
    return numAmount < 0 ? "text-red-600" : "text-green-600";
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-foreground tracking-tight">
          📊 Transactions ({transactions.length})
        </h3>
        <div className="text-[11px] text-muted-foreground">
          Merged from CSV statements
        </div>
      </div>

      <div className="space-y-0">
        {transactions.map((transaction, index) => (
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
                    <Badge className="uppercase text-[8px] bg-gray-100 text-gray-600 border-gray-200 px-1 py-0 shadow-none">
                      {transaction.type}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-[9px] text-muted-foreground min-w-0">
                    <span className="whitespace-nowrap">
                      {formatDate(
                        transaction.dateCompleted || transaction.dateStarted
                      )}
                    </span>

                    {transaction.sourceFile && (
                      <span className="truncate">
                        <FileIcon className="h-2 w-2 inline" />{" "}
                        {transaction.sourceFile}
                      </span>
                    )}
                    {transaction.payer && (
                      <span className="truncate">
                        <UserIcon className="h-2 w-2 inline" />{" "}
                        {transaction.payer}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-end text-right flex-shrink-0 ml-3">
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
            </div>
          ))}
      </div>

      <TransactionDetailsModal
        transaction={selectedTransaction}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
      />
    </div>
  );
}
