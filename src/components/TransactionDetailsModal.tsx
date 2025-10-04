import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";

interface TransactionDetailsModalProps {
  transaction: any;
  isOpen: boolean;
  onClose: () => void;
}

export const TransactionDetailsModal = ({ 
  transaction, 
  isOpen, 
  onClose 
}: TransactionDetailsModalProps) => {
  if (!transaction) return null;

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'Not available';
    try {
      return new Date(dateStr).toISOString().split('T')[0];
    } catch {
      return dateStr;
    }
  };

  const formatAmount = (amount: string, currency: string) => {
    if (!amount || amount === '') return 'Not available';
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount)) return amount;
    return `${currency} ${numAmount.toFixed(2)}`;
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

  const getStateBadge = (state: string) => {
    if (!state) return <Badge variant="outline" className="text-xs">N/A</Badge>;
    
    switch (state.toLowerCase()) {
      case 'completed':
        return <Badge variant="default" className="text-xs bg-green-600">Completed</Badge>;
      case 'pending':
        return <Badge variant="secondary" className="text-xs">Pending</Badge>;
      case 'failed':
        return <Badge variant="destructive" className="text-xs">Failed</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">{state}</Badge>;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getTransactionIcon(transaction.type)} Transaction Details
            <Badge variant="outline" className="text-xs">
              {transaction.id}
            </Badge>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Transaction Overview */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">📊 Transaction Overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Description:</span>
                  <p className="mt-1 text-sm">{transaction.description || 'No description'}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Type:</span>
                  <div className="mt-1">
                    <Badge className="uppercase text-[8px] bg-gray-200 text-gray-600 border-gray-200 px-1 py-0">
                      {transaction.type}
                    </Badge>
                  </div>
                </div>
                <div>
                  <span className="text-sm font-medium text-muted-foreground">State:</span>
                  <div className="mt-1">
                    {getStateBadge(transaction.state)}
                  </div>
                </div>
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Amount:</span>
                  <p className={`mt-1 text-sm font-semibold ${getAmountColor(transaction.amount)}`}>
                    {formatAmount(transaction.amount, transaction.paymentCurrency)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Dates */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">📅 Dates</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Date Started:</span>
                  <p className="mt-1 text-sm">{formatDate(transaction.dateStarted)}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Date Completed:</span>
                  <p className="mt-1 text-sm">{formatDate(transaction.dateCompleted)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Financial Details */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">💰 Financial Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Original Amount:</span>
                  <p className="mt-1 text-sm">
                    {transaction.origAmount ? formatAmount(transaction.origAmount, transaction.origCurrency) : 'Not available'}
                  </p>
                </div>
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Payment Amount:</span>
                  <p className={`mt-1 text-sm font-semibold ${getAmountColor(transaction.amount)}`}>
                    {formatAmount(transaction.amount, transaction.paymentCurrency)}
                  </p>
                </div>
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Total Amount:</span>
                  <p className="mt-1 text-sm">
                    {transaction.totalAmount ? formatAmount(transaction.totalAmount, transaction.paymentCurrency) : 'Not available'}
                  </p>
                </div>
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Balance:</span>
                  <p className="mt-1 text-sm">
                    {transaction.balance ? formatAmount(transaction.balance, transaction.paymentCurrency) : 'Not available'}
                  </p>
                </div>
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Exchange Rate:</span>
                  <p className="mt-1 text-sm">
                    {transaction.exchangeRate || 'Not available'}
                  </p>
                </div>
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Fee:</span>
                  <p className="mt-1 text-sm">
                    {transaction.fee ? formatAmount(transaction.fee, transaction.feeCurrency) : 'Not available'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment Details */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">💳 Payment Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Payer:</span>
                  <p className="mt-1 text-sm">{transaction.payer || 'Not available'}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Reference:</span>
                  <p className="mt-1 text-sm">{transaction.reference || 'Not available'}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Account:</span>
                  <p className="mt-1 text-sm">{transaction.account || 'Not available'}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Card Number:</span>
                  <p className="mt-1 text-sm">{transaction.cardNumber || 'Not available'}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Card Label:</span>
                  <p className="mt-1 text-sm">{transaction.cardLabel || 'Not available'}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Card State:</span>
                  <p className="mt-1 text-sm">{transaction.cardState || 'Not available'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Beneficiary Details */}
          {(transaction.beneficiaryAccountNumber || transaction.beneficiarySortCode || 
            transaction.beneficiaryIban || transaction.beneficiaryBic) && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">🏦 Beneficiary Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <span className="text-sm font-medium text-muted-foreground">Account Number:</span>
                    <p className="mt-1 text-sm">{transaction.beneficiaryAccountNumber || 'Not available'}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-muted-foreground">Sort Code:</span>
                    <p className="mt-1 text-sm">{transaction.beneficiarySortCode || 'Not available'}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-muted-foreground">IBAN:</span>
                    <p className="mt-1 text-sm">{transaction.beneficiaryIban || 'Not available'}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-muted-foreground">BIC:</span>
                    <p className="mt-1 text-sm">{transaction.beneficiaryBic || 'Not available'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Additional Information */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">ℹ️ Additional Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <span className="text-sm font-medium text-muted-foreground">MCC:</span>
                  <p className="mt-1 text-sm">{transaction.mcc || 'Not available'}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Related Transaction ID:</span>
                  <p className="mt-1 text-sm">{transaction.relatedTransactionId || 'Not available'}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Spend Program:</span>
                  <p className="mt-1 text-sm">{transaction.spendProgram || 'Not available'}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Source File:</span>
                  <p className="mt-1 text-sm">{transaction.sourceFile || 'Not available'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
