import type { Doc, Id } from "../../convex/_generated/dataModel";

/**
 * Shared client-side type aliases derived from the Convex schema. Keeping
 * these in sync with what `getMonthData` / `getMergedTransactions` actually
 * return removes the need for `any[]` props throughout the component tree.
 */

export type InvoiceVatStatus =
  | "not_configured"
  | "no_parsed_text"
  | "found"
  | "missing";

/** Shape returned by `api.invoices.getMonthData` for each incoming invoice. */
export type IncomingInvoice = Doc<"incomingInvoices"> & {
  vatStatus: InvoiceVatStatus;
  url: string | null;
};

/** Shape returned by `api.invoices.getMonthData` for each statement. */
export type StatementDoc = Doc<"statements"> & {
  url: string | null;
};

export type TransactionBinding = Doc<"transactionInvoiceBindings">;

/**
 * A row of the parsed Revolut CSV transaction list, enriched with the
 * source statement filename, an optional refund flag, and any bound
 * invoice storage id. Mirrors the records produced by
 * `getMergedTransactionsFromNormalized` in `convex/normalizedMonthStore.ts`.
 */
type StatementTransactionTuple = NonNullable<Doc<"statements">["transactions"]>;
type StatementTransaction = StatementTransactionTuple extends ReadonlyArray<
  infer T
>
  ? T
  : never;

export type MergedTransaction = StatementTransaction & {
  sourceFile: string;
  boundInvoiceStorageId: Id<"_storage"> | "NOT_NEEDED" | null;
  isRefunded?: boolean;
};

export type StorageId = Id<"_storage">;
