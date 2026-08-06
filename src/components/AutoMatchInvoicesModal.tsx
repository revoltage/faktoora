import { useMutation } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";

import { api } from "../../convex/_generated/api";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { InvoiceMatchProposal } from "@/hooks/useAutoMatchProposals";
import { proposalKey } from "@/utils/invoiceAutoMatch";

interface AutoMatchInvoicesModalProps {
  isOpen: boolean;
  onClose: () => void;
  monthKey: string;
  proposals: InvoiceMatchProposal[];
}

export function AutoMatchInvoicesModal({
  isOpen,
  onClose,
  monthKey,
  proposals,
}: AutoMatchInvoicesModalProps) {
  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-sm">
            🪄 Auto-match Invoices to Transactions
          </DialogTitle>
        </DialogHeader>
        {/* Remounts on every open so the default selection is recomputed. */}
        <AutoMatchBody
          monthKey={monthKey}
          proposals={proposals}
          onClose={onClose}
        />
      </DialogContent>
    </Dialog>
  );
}

function AutoMatchBody({
  monthKey,
  proposals,
  onClose,
}: {
  monthKey: string;
  proposals: InvoiceMatchProposal[];
  onClose: () => void;
}) {
  const bindTransactions = useMutation(api.invoices.bindTransactionsToInvoices);
  // Exact pairs are pre-approved; fuzzy pairs need an explicit sign-off.
  const [selected, setSelected] = useState<Set<string>>(
    () =>
      new Set(
        proposals
          .filter((proposal) => proposal.kind === "exact")
          .map(proposalKey),
      ),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const exact = proposals.filter((proposal) => proposal.kind === "exact");
  const fuzzy = proposals.filter((proposal) => proposal.kind === "fuzzy");
  const allSelected =
    proposals.length > 0 && selected.size === proposals.length;

  const toggle = (proposal: InvoiceMatchProposal) => {
    setSelected((current) => {
      const next = new Set(current);
      const key = proposalKey(proposal);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  };

  const handleAccept = async () => {
    const accepted = proposals.filter((proposal) =>
      selected.has(proposalKey(proposal)),
    );
    if (accepted.length === 0) return;

    setIsSubmitting(true);
    try {
      await bindTransactions({
        monthKey,
        bindings: accepted.map((proposal) => ({
          transactionId: proposal.transaction.id,
          invoiceStorageId: proposal.invoice.storageId,
        })),
      });
      toast.success(
        `Bound ${accepted.length} ${accepted.length === 1 ? "pair" : "pairs"}`,
      );
      onClose();
    } catch (error) {
      console.error("🪄 Failed to bind auto-matched pairs:", error);
      toast.error("Failed to bind matched pairs");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (proposals.length === 0) {
    return (
      <div className="py-6 text-center text-sm text-gray-500">
        No unbound transaction matches an unbound invoice by currency and
        amount.
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        <label className="flex items-center gap-2 text-xs font-medium text-gray-700 cursor-pointer">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={() =>
              setSelected(
                allSelected ? new Set() : new Set(proposals.map(proposalKey)),
              )
            }
            className="h-4 w-4 cursor-pointer rounded border-gray-300 accent-primary"
          />
          Select all ({proposals.length})
        </label>

        <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
          <ProposalGroup
            title="Exact"
            hint="same currency, amount and name"
            proposals={exact}
            selected={selected}
            onToggle={toggle}
          />
          <ProposalGroup
            title="Fuzzy"
            hint="same currency and amount, names differ — review each"
            proposals={fuzzy}
            selected={selected}
            onToggle={toggle}
          />
        </div>
      </div>

      <DialogFooter className="gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onClose}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={() => void handleAccept()}
          disabled={isSubmitting || selected.size === 0}
        >
          Accept {selected.size}
        </Button>
      </DialogFooter>
    </>
  );
}

function ProposalGroup({
  title,
  hint,
  proposals,
  selected,
  onToggle,
}: {
  title: string;
  hint: string;
  proposals: InvoiceMatchProposal[];
  selected: Set<string>;
  onToggle: (proposal: InvoiceMatchProposal) => void;
}) {
  if (proposals.length === 0) return null;

  return (
    <div className="space-y-1">
      <div className="text-xs font-semibold text-gray-700">
        {title} ({proposals.length})
        <span className="ml-1 font-normal text-gray-500">— {hint}</span>
      </div>
      {proposals.map((proposal) => (
        <ProposalRow
          key={proposalKey(proposal)}
          proposal={proposal}
          isSelected={selected.has(proposalKey(proposal))}
          onToggle={() => onToggle(proposal)}
        />
      ))}
    </div>
  );
}

function ProposalRow({
  proposal,
  isSelected,
  onToggle,
}: {
  proposal: InvoiceMatchProposal;
  isSelected: boolean;
  onToggle: () => void;
}) {
  const { transaction, invoice } = proposal;
  const transactionAmount = parseFloat(transaction.amount);
  const invoiceAmount = invoice.analysis?.amount?.value;

  return (
    <label
      className={`flex items-start gap-3 rounded p-2 cursor-pointer hover:bg-gray-100 ${
        isSelected ? "bg-green-50" : ""
      }`}
    >
      <input
        type="checkbox"
        checked={isSelected}
        onChange={onToggle}
        className="mt-0.5 h-4 w-4 flex-shrink-0 cursor-pointer rounded border-gray-300 accent-primary"
      />
      <div className="grid min-w-0 flex-1 gap-1 sm:grid-cols-2 sm:gap-3">
        <div className="min-w-0">
          <div className="truncate text-xs font-medium text-gray-900">
            {transaction.description || "No description"}
          </div>
          <div className="text-[10px] text-gray-500">
            {formatTransactionDate(transaction.dateCompleted)}
            {" · "}
            <span className="font-medium text-gray-700">
              {isNaN(transactionAmount)
                ? transaction.amount
                : transactionAmount.toFixed(2)}{" "}
              {transaction.paymentCurrency}
            </span>
          </div>
        </div>
        <div className="min-w-0 sm:text-right">
          <div className="truncate text-xs text-gray-900">
            ↳ {invoice.name || invoice.fileName}
          </div>
          <div className="text-[10px] text-gray-500">
            {invoiceAmount ? (
              <span className="font-medium text-gray-700">
                {invoiceAmount.replace("|", " ")}
              </span>
            ) : null}
            {proposal.kind === "fuzzy" && (
              <span className="ml-1">
                {Math.round(proposal.nameScore * 100)}% name match
              </span>
            )}
          </div>
        </div>
      </div>
    </label>
  );
}

function formatTransactionDate(dateString: string | undefined) {
  if (!dateString) return "—";
  try {
    return new Date(dateString).toISOString().split("T")[0];
  } catch {
    return dateString;
  }
}
