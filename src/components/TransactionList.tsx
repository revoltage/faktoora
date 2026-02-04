import { useQuery } from 'convex/react';
import { AlertCircle, CheckCircle, FileX, Minus } from 'lucide-react';
import { useState } from 'react';

import { api } from '../../convex/_generated/api';

import { TransactionDetailsModal } from '@/components/TransactionDetailsModal';
import { TransactionInvoiceBindingModal, NOT_NEEDED } from '@/components/TransactionInvoiceBindingModal';
import { TransactionListFooter } from '@/components/TransactionListFooter';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getInvoiceHelperLinks } from '@/lib/transactionHelperLinks';

const cfg = {
  // Filtering constants
  hidePositiveAmounts: true, // set to true to hide positive amounts
  hideExchangeRows: true, // set to true to hide rows with exchangeRate filled
  hideRevolutBusinessFee: true, // set to true to hide rows with description 'Revolut Business Fee'

  // Allowed transaction types (uncomment to allow more)
  allowedTransactionTypes: [
    'CARD_PAYMENT',
    'MANUAL',
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
      <div className='flex justify-center items-center py-2'>
        <div className='animate-spin rounded-full h-4 w-4 border-b-2 border-primary'></div>
      </div>
    );
  }

  // Helper function to check if a transaction needs an invoice
  const transactionNeedsInvoice = (transaction: any) => {
    // Filter by allowed transaction types
    if (!cfg.allowedTransactionTypes.includes(transaction.type)) {
      return false;
    }

    if (cfg.hidePositiveAmounts && transaction.amount) {
      const numAmount = parseFloat(transaction.amount);
      if (!isNaN(numAmount) && numAmount > 0) return false;
    }

    if (cfg.hideExchangeRows && transaction.type === 'EXCHANGE') {
      return false;
    }

    if (
      cfg.hideRevolutBusinessFee &&
      transaction.description?.toLowerCase().includes('revolut business fee')
    ) {
      return false;
    }

    return true;
  };

  // Filter transactions based on constants
  const filteredTransactions = transactions.filter(transactionNeedsInvoice);

  if (transactions.length === 0) {
    return (
      <div className='text-gray-500 text-sm py-4'>No transactions found in CSV statements</div>
    );
  }

  if (showFiltered && filteredTransactions.length === 0) {
    return (
      <div className='space-y-2'>
        <div className='flex items-center justify-between mb-2'>
          <h4 className='text-sm font-semibold text-foreground tracking-tight'>Transactions</h4>
          <div className='flex items-center gap-2'>
            <Button
              variant='outline'
              size='sm'
              onClick={() => setShowFiltered(false)}
              className='text-[10px] h-6 px-2'
            >
              Show All
            </Button>
          </div>
        </div>
        <div className='text-gray-500 text-sm py-4'>No transactions need invoices</div>
        <TransactionListFooter
          displayCount={0}
          totalCount={transactions.length}
          showFiltered={true}
        />
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
    if (!dateString) return '—';
    try {
      return new Date(dateString).toISOString().split('T')[0];
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
      case 'MANUAL':
        return '✏️';
      default:
        return '📄';
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
    if (!amount) return 'text-gray-500';
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount)) return 'text-gray-500';
    return numAmount < 0 ? 'text-red-600' : 'text-green-600';
  };

  // Helper function to find matching links for a transaction
  const findHelperLinks = (description: string) => {
    return getInvoiceHelperLinks(description);
  };

  const displayTransactions = showFiltered ? filteredTransactions : transactions;

  return (
    <div className='space-y-2'>
      <div className='flex items-center justify-between mb-2 gap-2 min-w-0'>
        <h4 className='text-sm font-semibold text-foreground tracking-tight truncate'>
          Transactions
        </h4>
        <div className='flex flex-wrap items-center justify-end gap-1 sm:gap-2'>
          <Button
            variant='link'
            size='sm'
            onClick={() => setShowFiltered(!showFiltered)}
            className='text-[10px] h-6 px-2'
          >
            {showFiltered ? 'Show All' : 'Hide Non-Invoice'}
          </Button>
        </div>
      </div>

      <div className='space-y-0'>
        {displayTransactions.map((transaction, index) => {
          const helperLinks = findHelperLinks(transaction.description || '');

          return (
            <div
              key={`${transaction.id}-${index}`}
              className='flex items-center justify-between py-1 hover:bg-gray-50 transition-colors cursor-pointer -mx-2 pl-2 rounded-lg'
              onClick={() => handleTransactionClick(transaction)}
            >
              <div className='flex items-center gap-2 flex-1 min-w-0'>
                <span className='text-base flex-shrink-0'>
                  {getTransactionIcon(transaction.type)}
                </span>
                <div className='flex-1 min-w-0'>
                  <div className='flex items-center gap-1.5 mb-0.5 min-w-0'>
                    <span className='font-medium text-foreground truncate text-xs'>
                      {transaction.description || 'No description'}
                    </span>
                    <Badge
                      variant='outline'
                      className='uppercase text-[8px] text-gray-500 px-1 py-0 shadow-none'
                    >
                      {transaction.type}
                    </Badge>
                  </div>
                  <div className='flex items-center gap-2 sm:gap-3 text-[9px] text-muted-foreground min-w-0'>
                    <span className='whitespace-nowrap'>
                      {formatDate(transaction.dateCompleted || transaction.dateStarted)}
                    </span>

                    {transactionNeedsInvoice(transaction) ? (
                      helperLinks.length > 0 && (
                        <div className='flex min-w-0 flex-1 gap-1 overflow-hidden'>
                          {helperLinks.map((link, linkIndex) => (
                            <a
                              key={linkIndex}
                              href={link}
                              target='_blank'
                              rel='noopener noreferrer'
                              onClick={e => e.stopPropagation()}
                              className='text-blue-600 hover:text-blue-800 hover:underline text-[9px] truncate max-w-[6rem] inline-block'
                              title={link}
                            >
                              {link.replace(/^https?:\/\//, '')}
                            </a>
                          ))}
                        </div>
                      )
                    ) : (
                      <span className='text-gray-400 text-[9px] italic'>Doesn't need invoice</span>
                    )}
                  </div>
                </div>
              </div>
              <div className='flex items-center gap-2 flex-shrink-0 ml-3'>
                <div className='flex flex-col items-end text-right'>
                  <div className={`font-semibold text-xs ${getAmountColor(transaction.amount)}`}>
                    {formatAmount(transaction.amount, transaction.paymentCurrency)}
                  </div>
                  {transaction.origAmount && transaction.origAmount !== transaction.amount && (
                    <div className='text-[9px] text-muted-foreground'>
                      {formatAmount(transaction.origAmount, transaction.origCurrency)}
                    </div>
                  )}
                </div>

                {/* Binding button - only show for transactions that need invoices */}
                {transactionNeedsInvoice(transaction) ? (
                  <Button
                    variant='ghost'
                    size='sm'
                    onClick={e => handleBindingClick(transaction, e)}
                    className={`h-8 w-8 p-0 rounded-full ${
                      transaction.boundInvoiceStorageId === NOT_NEEDED
                        ? 'text-gray-400 hover:text-gray-500'
                        : transaction.boundInvoiceStorageId
                          ? 'text-green-600 hover:text-green-700'
                          : 'text-orange-500 hover:text-orange-600'
                    }`}
                    title={
                      transaction.boundInvoiceStorageId === NOT_NEEDED
                        ? 'Invoice not needed (click to change)'
                        : transaction.boundInvoiceStorageId
                          ? 'Change invoice binding'
                          : 'Bind to invoice'
                    }
                  >
                    {transaction.boundInvoiceStorageId === NOT_NEEDED ? (
                      <FileX className='h-5 w-5 rounded-full' />
                    ) : transaction.boundInvoiceStorageId ? (
                      <CheckCircle className='h-5 w-5 rounded-full' />
                    ) : (
                      <AlertCircle className='h-5 w-5 rounded-full' />
                    )}
                  </Button>
                ) : (
                  <div className='h-8 w-8 flex items-center justify-center'>
                    <Minus className='h-4 w-4 text-gray-300 rounded-full' />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <TransactionListFooter
        displayCount={displayTransactions.length}
        totalCount={showFiltered ? transactions.length : undefined}
        showFiltered={showFiltered && filteredTransactions.length !== transactions.length}
      />

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
