import { parseInvoiceAmount } from "@/lib/currency";
import { fuzzyMatch } from "@/utils/invoiceMatching";

/**
 * Bulk invoice <-> transaction auto-matching.
 *
 * Pure, deterministic, no network and no AI: every proposal is derived from
 * currency equality, amount equality and string similarity alone. The result
 * is 1:1 — a transaction and an invoice each appear at most once across the
 * whole proposal set.
 */

/**
 * Amounts within this percentage of each other count as the same amount.
 * Mirrors `SCORING_CONFIG.amount.perfectMatchThreshold` (0.01) in
 * `invoiceMatching.ts`, expressed as a percentage.
 */
const AMOUNT_MATCH_TOLERANCE_PERCENT = 1;

export interface AutoMatchTransaction {
  id: string;
  amount?: string;
  paymentCurrency?: string;
  description?: string;
  /** Truthy (incl. `"NOT_NEEDED"`) means the row is already resolved. */
  boundInvoiceStorageId?: string | null;
}

export interface AutoMatchInvoice {
  storageId: string;
  name?: string;
  fileName?: string;
  analysis?: {
    sender?: { value?: string | null } | null;
    amount?: { value?: string | null } | null;
  } | null;
}

/**
 * `exact` — currency, amount and normalized name all line up.
 * `fuzzy` — currency and amount line up, the names only partially do.
 */
export type AutoMatchKind = "exact" | "fuzzy";

export interface AutoMatchProposal<T, I> {
  transaction: T;
  invoice: I;
  kind: AutoMatchKind;
  /** Best name similarity (0-1) across the invoice's display name and sender. */
  nameScore: number;
  /** Relative amount difference, 0 when the two amounts are identical. */
  amountDelta: number;
  /** The agreed amount (absolute) and currency of the pair. */
  amount: number;
  currency: string;
}

export interface BuildAutoMatchOptions {
  /** Invoices already claimed by some binding; never proposed again. */
  boundInvoiceStorageIds?: Iterable<string>;
}

/**
 * Lowercase, strip punctuation, collapse whitespace. Unicode-aware so that
 * non-latin senders survive normalization instead of collapsing to "".
 */
export function normalizeName(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** Absolute transaction amount; `null` when missing, unparseable or zero. */
function parseTransactionAmount(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Math.abs(parseFloat(value));
  if (!Number.isFinite(parsed) || parsed === 0) return null;
  return parsed;
}

export function proposalKey(proposal: {
  transaction: { id: string };
  invoice: { storageId: string };
}): string {
  return `${proposal.transaction.id}::${proposal.invoice.storageId}`;
}

/**
 * Build the conflict-free set of proposed bindings.
 *
 * Names are compared against both the invoice display name and the parsed
 * sender: the display name is derived from the uploaded filename (often
 * `invoice_1234`), whereas `analysis.sender.value` holds the vendor the
 * transaction description actually names. Taking the better of the two keeps
 * filename-named invoices working while letting parsed invoices match on the
 * far stronger signal.
 *
 * Conflicts are resolved greedily: candidates are ordered exact-first, then by
 * descending name similarity, then by closest amount, and each transaction and
 * invoice is consumed by the first candidate that claims it.
 */
export function buildAutoMatchProposals<
  T extends AutoMatchTransaction,
  I extends AutoMatchInvoice,
>(
  transactions: readonly T[],
  invoices: readonly I[],
  options: BuildAutoMatchOptions = {},
): AutoMatchProposal<T, I>[] {
  const boundInvoices = new Set(options.boundInvoiceStorageIds ?? []);

  const openTransactions = transactions
    .filter((transaction) => !transaction.boundInvoiceStorageId)
    .map((transaction) => ({
      transaction,
      amount: parseTransactionAmount(transaction.amount),
      currency: (transaction.paymentCurrency || "").trim().toUpperCase(),
      name: normalizeName(transaction.description),
    }))
    .filter(
      (entry): entry is typeof entry & { amount: number } =>
        entry.amount !== null && entry.currency !== "",
    );

  const openInvoices = invoices
    .filter((invoice) => !boundInvoices.has(invoice.storageId))
    .map((invoice) => {
      const parsed = parseInvoiceAmount(invoice.analysis?.amount?.value);
      return {
        invoice,
        amount: parsed ? Math.abs(parsed.amount) : 0,
        currency: (parsed?.currency || "").trim().toUpperCase(),
        displayName: normalizeName(invoice.name || invoice.fileName),
        senderName: normalizeName(invoice.analysis?.sender?.value),
      };
    })
    .filter((entry) => entry.amount !== 0 && entry.currency !== "");

  const candidates: AutoMatchProposal<T, I>[] = [];

  for (const tx of openTransactions) {
    for (const inv of openInvoices) {
      if (tx.currency !== inv.currency) continue;

      const amountDelta =
        Math.abs(tx.amount - inv.amount) / Math.max(tx.amount, inv.amount);
      if (amountDelta > AMOUNT_MATCH_TOLERANCE_PERCENT / 100) continue;

      const isExact =
        tx.name !== "" &&
        (tx.name === inv.displayName || tx.name === inv.senderName);

      const nameScore = isExact
        ? 1
        : Math.max(
            fuzzyMatch(tx.name, inv.displayName),
            fuzzyMatch(tx.name, inv.senderName),
          );

      candidates.push({
        transaction: tx.transaction,
        invoice: inv.invoice,
        kind: isExact ? "exact" : "fuzzy",
        nameScore,
        amountDelta,
        amount: inv.amount,
        currency: inv.currency,
      });
    }
  }

  candidates.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "exact" ? -1 : 1;
    if (b.nameScore !== a.nameScore) return b.nameScore - a.nameScore;
    if (a.amountDelta !== b.amountDelta) return a.amountDelta - b.amountDelta;
    if (a.transaction.id !== b.transaction.id) {
      return a.transaction.id < b.transaction.id ? -1 : 1;
    }
    return a.invoice.storageId < b.invoice.storageId ? -1 : 1;
  });

  const usedTransactions = new Set<string>();
  const usedInvoices = new Set<string>();
  const proposals: AutoMatchProposal<T, I>[] = [];

  for (const candidate of candidates) {
    if (usedTransactions.has(candidate.transaction.id)) continue;
    if (usedInvoices.has(candidate.invoice.storageId)) continue;
    usedTransactions.add(candidate.transaction.id);
    usedInvoices.add(candidate.invoice.storageId);
    proposals.push(candidate);
  }

  return proposals;
}
