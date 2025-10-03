import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";

interface TransactionListProps {
  monthKey: string;
}

export function TransactionList({ monthKey }: TransactionListProps) {
  const transactions = useQuery(api.invoices.getMergedTransactions, { monthKey });

  if (!transactions) {
    return (
      <div className="flex justify-center items-center py-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
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
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">
          📊 Transactions ({transactions.length})
        </h3>
        <div className="text-sm text-gray-500">
          Merged from CSV statements
        </div>
      </div>
      
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {transactions.map((transaction, index) => (
          <div
            key={`${transaction.id}-${index}`}
            className="flex items-center justify-between p-3 bg-gray-50 rounded border border-gray-200 hover:bg-gray-100 transition-colors"
          >
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <span className="text-lg flex-shrink-0">
                {getTransactionIcon(transaction.type)}
              </span>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-gray-900 truncate">
                    {transaction.description || 'No description'}
                  </span>
                  <span className="text-xs px-2 py-1 bg-gray-200 text-gray-600 rounded uppercase">
                    {transaction.type}
                  </span>
                </div>
                
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span>📅 {formatDate(transaction.dateCompleted || transaction.dateStarted)}</span>
                  {transaction.payer && (
                    <span className="truncate">👤 {transaction.payer}</span>
                  )}
                  {transaction.sourceFile && (
                    <span className="truncate">📁 {transaction.sourceFile}</span>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex flex-col items-end text-right flex-shrink-0 ml-4">
              <div className={`font-semibold ${getAmountColor(transaction.amount)}`}>
                {formatAmount(transaction.amount, transaction.paymentCurrency)}
              </div>
              {transaction.origAmount && transaction.origAmount !== transaction.amount && (
                <div className="text-xs text-gray-500">
                  {formatAmount(transaction.origAmount, transaction.origCurrency)}
                </div>
              )}
              {transaction.balance && (
                <div className="text-xs text-gray-400">
                  Balance: {formatAmount(transaction.balance, transaction.paymentCurrency)}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
