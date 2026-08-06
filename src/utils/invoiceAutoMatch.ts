import { parseInvoiceAmount } from "@/lib/currency";
import { fuzzyMatch } from "@/utils/invoiceMatching";

/**
 * Bulk invoice <-> transaction auto-matching.
 *
 * Pure, deterministic, no network and no AI: every proposal is derived from
 * currency equality, amount equality, string similarity and date proximity.
 * The result is 1:1 — a transaction and an invoice each appear at most once
 * across the whole proposal set.
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
  dateCompleted?: string;
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
    date?: { value?: string | null } | null;
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
  /** Days between invoice date and transaction date; `null` when undated. */
  dateDistanceDays: number | null;
  /**
   * An equally-good alternative existed and lost out, so this pairing was
   * picked arbitrarily. Never pre-selected in the UI.
   */
  ambiguous: boolean;
  /** How many equally-good alternatives went unmatched. */
  alternatives: number;
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

const MS_PER_DAY = 86_400_000;

/** Epoch ms for a `YYYY-MM-DD` date; `null` when absent or unparseable. */
function parseDate(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Two candidates rank identically, so choosing between them is a coin flip.
 * Compared on every signal that orders the greedy pass.
 */
function isIndistinguishable(
  a: AutoMatchProposal<unknown, unknown>,
  b: AutoMatchProposal<unknown, unknown>,
): boolean {
  return (
    a.kind === b.kind &&
    a.nameScore === b.nameScore &&
    a.dateDistanceDays === b.dateDistanceDays &&
    a.amountDelta === b.amountDelta
  );
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
 * descending name similarity, then by closest invoice date, then by closest
 * amount, and each transaction and invoice is consumed by the first candidate
 * that claims it.
 *
 * Date is a tiebreaker, never a gate: an invoice is routinely issued days
 * before or after the payment clears, so distance cannot reject a pair. It
 * only separates candidates that are otherwise identical — which happens a
 * lot when a vendor bills the same amount every month.
 *
 * Where even the date cannot separate them, the winning pair is flagged
 * `ambiguous` rather than silently presented as certain.
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
      date: parseDate(transaction.dateCompleted),
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
        date: parseDate(invoice.analysis?.date?.value),
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
        dateDistanceDays:
          tx.date === null || inv.date === null
            ? null
            : Math.round(Math.abs(tx.date - inv.date) / MS_PER_DAY),
        ambiguous: false,
        alternatives: 0,
        amount: inv.amount,
        currency: inv.currency,
      });
    }
  }

  candidates.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "exact" ? -1 : 1;
    if (b.nameScore !== a.nameScore) return b.nameScore - a.nameScore;
    // An undated invoice sorts behind every dated one rather than winning by
    // default, so a real date always beats a missing one.
    const aDate = a.dateDistanceDays ?? Number.POSITIVE_INFINITY;
    const bDate = b.dateDistanceDays ?? Number.POSITIVE_INFINITY;
    if (aDate !== bDate) return aDate - bDate;
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

  // A pairing is only arbitrary if an equally-good alternative actually LOST
  // OUT. When every tied alternative found a partner of its own, the greedy
  // pass merely picked one permutation of interchangeable pairs and bound the
  // same set either way — flagging that would be noise.
  for (const proposal of proposals) {
    let alternatives = 0;
    for (const candidate of candidates) {
      if (candidate === proposal) continue;
      if (!isIndistinguishable(candidate, proposal)) continue;

      const sharesTransaction =
        candidate.transaction.id === proposal.transaction.id;
      const sharesInvoice =
        candidate.invoice.storageId === proposal.invoice.storageId;
      if (!sharesTransaction && !sharesInvoice) continue;

      const strandedRival = sharesTransaction
        ? !usedInvoices.has(candidate.invoice.storageId)
        : !usedTransactions.has(candidate.transaction.id);
      if (strandedRival) alternatives += 1;
    }

    proposal.alternatives = alternatives;
    proposal.ambiguous = alternatives > 0;
  }

  return proposals;
}
