import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { Badge } from "./components/ui/badge";
import { ScrollArea } from "./components/ui/scroll-area";

interface TransactionListProps {
  monthKey: string;
}

export function TransactionList({ monthKey }: TransactionListProps) {
  const transactions = useQuery(api.invoices.getMergedTransactions, { monthKey });

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
    if (!amount || amount === '') return '';
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount)) return amount;
    return `${currency} ${numAmount.toFixed(2)}`;
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return dateString;
    }
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'CARD_PAYMENT':
        return '💳';
      case 'TRANSFER':
        return '💸';
      case 'EXCHANGE':
        return '🔄';
      case 'TOPUP':
        return '💰';
      case 'FEE':
        return '📋';
      default:
        return '📄';
    }
  };

  const getAmountColor = (amount: string) => {
    if (!amount) return 'text-gray-500';
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount)) return 'text-gray-500';
    return numAmount < 0 ? 'text-red-600' : 'text-green-600';
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-foreground tracking-tight">
          📊 Transactions ({transactions.length})
        </h3>
        <div className="text-[11px] text-muted-foreground">Merged from CSV statements</div>
      </div>

      <ScrollArea className="h-72 w-full">
        <div className="space-y-1.5 pr-2">
          {transactions.map((transaction, index) => (
            <div
              key={`${transaction.id}-${index}`}
              className="flex items-center justify-between p-2 rounded-md border bg-card hover:bg-accent/30 transition-colors"
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="text-base flex-shrink-0">
                  {getTransactionIcon(transaction.type)}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5 min-w-0">
                    <span className="font-medium text-foreground truncate text-sm">
                      {transaction.description || 'No description'}
                    </span>
                    <Badge className="uppercase text-[10px] bg-purple-600 text-white border-purple-600">
                      {transaction.type}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground min-w-0">
                    <span className="whitespace-nowrap">📅 {formatDate(transaction.dateCompleted || transaction.dateStarted)}</span>
                    {transaction.payer && (
                      <span className="truncate">👤 {transaction.payer}</span>
                    )}
                    {transaction.sourceFile && (
                      <span className="truncate">📁 {transaction.sourceFile}</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-end text-right flex-shrink-0 ml-3">
                <div className={`font-semibold text-sm ${getAmountColor(transaction.amount)}`}>
                  {formatAmount(transaction.amount, transaction.paymentCurrency)}
                </div>
                {transaction.origAmount && transaction.origAmount !== transaction.amount && (
                  <div className="text-[10px] text-muted-foreground">
                    {formatAmount(transaction.origAmount, transaction.origCurrency)}
                  </div>
                )}
                {transaction.balance && (
                  <div className="text-[10px] text-muted-foreground">
                    Balance: {formatAmount(transaction.balance, transaction.paymentCurrency)}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
