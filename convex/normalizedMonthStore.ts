import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { addRefundStatus } from "./refundMatching";

type ReadCtx = QueryCtx | MutationCtx;
type WriteCtx = MutationCtx;

type InvoiceMatchArgs = {
  invoiceId?: string;
  storageId: Id<"_storage">;
  uploadedAt?: number;
};

type NormalizedInvoice = Doc<"incomingInvoices">;
type NormalizedStatement = Doc<"statements">;
type NormalizedBinding = Doc<"transactionInvoiceBindings">;
type ManualTransaction = Doc<"manualTransactions">;

type StatementTransaction = Doc<"statementTransactions">["transaction"];
type MergedTransaction = StatementTransaction & {
  sourceFile: string;
  boundInvoiceStorageId: Id<"_storage"> | "NOT_NEEDED" | null;
};
type MergedTransactionWithRefundStatus = MergedTransaction & {
  isRefunded: boolean;
};
export type InvoiceVatStatus =
  | "not_configured"
  | "no_parsed_text"
  | "found"
  | "missing";

export async function listNormalizedInvoices(
  ctx: ReadCtx,
  userId: Id<"users">,
  monthKey: string,
): Promise<NormalizedInvoice[]> {
  const invoices = await ctx.db
    .query("incomingInvoices")
    .withIndex("by_user_and_month", (q) =>
      q.eq("userId", userId).eq("monthKey", monthKey),
    )
    .collect();

  return invoices.sort(
    (a: NormalizedInvoice, b: NormalizedInvoice) => b.uploadedAt - a.uploadedAt,
  );
}

export async function listNormalizedStatements(
  ctx: ReadCtx,
  userId: Id<"users">,
  monthKey: string,
): Promise<NormalizedStatement[]> {
  const statements = await ctx.db
    .query("statements")
    .withIndex("by_user_and_month", (q) =>
      q.eq("userId", userId).eq("monthKey", monthKey),
    )
    .collect();

  return statements.sort(
    (a: NormalizedStatement, b: NormalizedStatement) =>
      a.uploadedAt - b.uploadedAt,
  );
}

export async function listNormalizedStatementTransactions(
  ctx: ReadCtx,
  userId: Id<"users">,
  monthKey: string,
): Promise<Doc<"statementTransactions">[]> {
  return await ctx.db
    .query("statementTransactions")
    .withIndex("by_user_and_month", (q) =>
      q.eq("userId", userId).eq("monthKey", monthKey),
    )
    .collect();
}

export async function listNormalizedBindings(
  ctx: ReadCtx,
  userId: Id<"users">,
  monthKey: string,
): Promise<NormalizedBinding[]> {
  const bindings = await ctx.db
    .query("transactionInvoiceBindings")
    .withIndex("by_user_and_month", (q) =>
      q.eq("userId", userId).eq("monthKey", monthKey),
    )
    .collect();

  return bindings.sort(
    (a: NormalizedBinding, b: NormalizedBinding) => a.boundAt - b.boundAt,
  );
}

export async function getMonthDataFromNormalized(
  ctx: QueryCtx,
  userId: Id<"users">,
  monthKey: string,
  userVatId?: string,
) {
  const [incomingInvoices, statements, transactionInvoiceBindings] =
    await Promise.all([
      listNormalizedInvoices(ctx, userId, monthKey),
      listNormalizedStatements(ctx, userId, monthKey),
      listNormalizedBindings(ctx, userId, monthKey),
    ]);

  const incomingInvoicesWithUrls = await Promise.all(
    incomingInvoices.map(async (invoice) => ({
      ...invoice,
      vatStatus: getInvoiceVatStatus(invoice, userVatId),
      url: await ctx.storage.getUrl(invoice.storageId),
    })),
  );

  const statementsWithUrls = await Promise.all(
    statements.map(async (statement) => ({
      ...statement,
      url: await ctx.storage.getUrl(statement.storageId),
    })),
  );

  return {
    monthKey,
    incomingInvoices: incomingInvoicesWithUrls,
    statements: statementsWithUrls,
    transactionInvoiceBindings,
  };
}

function getInvoiceVatStatus(
  invoice: NormalizedInvoice,
  userVatId?: string,
): InvoiceVatStatus {
  if (!userVatId?.trim()) {
    return "not_configured";
  }

  const classicParsedText = normalizeParsedText(
    invoice.parsing.parsedText.value,
  );
  const aiParsedText = normalizeParsedText(invoice.analysis.parsedText.value);

  if (!classicParsedText && !aiParsedText) {
    return "no_parsed_text";
  }

  return [classicParsedText, aiParsedText]
    .filter((text): text is string => Boolean(text))
    .some((text) => hasVatIdInText(text, userVatId))
    ? "found"
    : "missing";
}

function normalizeParsedText(parsedText: string | null): string | null {
  const normalizedText = parsedText?.trim();
  return normalizedText ? normalizedText : null;
}

function hasVatIdInText(parsedText: string, userVatId: string): boolean {
  const normalizedText = parsedText.replace(/\s+/g, "").toLowerCase();
  const normalizedVatId = userVatId.replace(/\s+/g, "").toLowerCase();
  return normalizedText.includes(normalizedVatId);
}

export async function getMergedTransactionsFromNormalized(
  ctx: ReadCtx,
  userId: Id<"users">,
  monthKey: string,
) {
  const [statements, statementTransactions, bindings, manualTransactions] =
    await Promise.all([
      listNormalizedStatements(ctx, userId, monthKey),
      listNormalizedStatementTransactions(ctx, userId, monthKey),
      listNormalizedBindings(ctx, userId, monthKey),
      listManualTransactionsForMonth(ctx, userId, monthKey),
    ]);

  const statementFileNames = new Map(
    statements.map((statement) => [statement.statementId, statement.fileName]),
  );

  const bindingMap = new Map<string, Id<"_storage"> | "NOT_NEEDED" | null>();
  for (const binding of bindings) {
    bindingMap.set(binding.transactionId, binding.invoiceStorageId);
  }

  const transactionMap = new Map<string, MergedTransaction>();
  for (const row of statementTransactions) {
    const transaction = row.transaction;
    transactionMap.set(transaction.id, {
      ...transaction,
      sourceFile: statementFileNames.get(row.statementId) ?? "Statement",
      boundInvoiceStorageId: bindingMap.get(transaction.id) || null,
    });
  }

  const allTransactions = [...transactionMap.values()];
  const transactionsWithRefundStatus = addRefundStatus(allTransactions);
  const sortedTransactions = transactionsWithRefundStatus.sort((a, b) => {
    const dateA = new Date(a.dateCompleted || a.dateStarted);
    const dateB = new Date(b.dateCompleted || b.dateStarted);
    return dateB.getTime() - dateA.getTime();
  });

  sortedTransactions.push(
    ...manualTransactions.map((transaction) =>
      toManualMergedTransaction(transaction, bindingMap),
    ),
  );

  return sortedTransactions;
}

async function listManualTransactionsForMonth(
  ctx: ReadCtx,
  userId: Id<"users">,
  monthKey: string,
): Promise<ManualTransaction[]> {
  const [monthRows, recurringRows] = await Promise.all([
    ctx.db
      .query("manualTransactions")
      .withIndex("by_user_and_month", (q) =>
        q.eq("userId", userId).eq("monthKey", monthKey),
      )
      .collect(),
    ctx.db
      .query("manualTransactions")
      .withIndex("by_user_and_recurring", (q) =>
        q.eq("userId", userId).eq("recurring", true),
      )
      .collect(),
  ]);

  return [...recurringRows, ...monthRows].sort(
    (a, b) => a.createdAt - b.createdAt,
  );
}

function toManualMergedTransaction(
  transaction: ManualTransaction,
  bindingMap: Map<string, Id<"_storage"> | "NOT_NEEDED" | null>,
): MergedTransactionWithRefundStatus {
  const id = `manual_transaction_${transaction._id}`;

  return {
    id,
    dateStarted: "",
    dateCompleted: "",
    type: "MANUAL",
    state: "",
    description: transaction.name,
    reference: "",
    payer: "",
    cardNumber: "",
    cardLabel: "",
    cardState: "",
    origCurrency: transaction.currency ?? "",
    origAmount: transaction.amount,
    paymentCurrency: transaction.currency ?? "",
    amount: transaction.amount,
    totalAmount: "",
    exchangeRate: "",
    fee: "",
    feeCurrency: "",
    balance: "",
    account: "",
    beneficiaryAccountNumber: "",
    beneficiarySortCode: "",
    beneficiaryIban: "",
    beneficiaryBic: "",
    mcc: "",
    relatedTransactionId: "",
    spendProgram: "",
    sourceFile: transaction.recurring ? "Manual recurring" : "Manual",
    boundInvoiceStorageId: bindingMap.get(id) || null,
    isRefunded: false,
  };
}

export async function findNormalizedInvoiceByMatch(
  ctx: ReadCtx,
  userId: Id<"users">,
  monthKey: string,
  args: InvoiceMatchArgs,
): Promise<NormalizedInvoice | null> {
  if (args.invoiceId) {
    const invoiceId = args.invoiceId;
    const invoice = await ctx.db
      .query("incomingInvoices")
      .withIndex("by_user_month_and_invoice_id", (q) =>
        q
          .eq("userId", userId)
          .eq("monthKey", monthKey)
          .eq("invoiceId", invoiceId),
      )
      .unique();

    if (invoice) {
      return invoice;
    }
  }

  const invoices = await ctx.db
    .query("incomingInvoices")
    .withIndex("by_user_month_and_storage_id", (q) =>
      q
        .eq("userId", userId)
        .eq("monthKey", monthKey)
        .eq("storageId", args.storageId),
    )
    .collect();

  if (args.uploadedAt !== undefined) {
    return (
      invoices.find(
        (invoice: NormalizedInvoice) => invoice.uploadedAt === args.uploadedAt,
      ) ?? null
    );
  }

  return (
    invoices.sort(
      (a: NormalizedInvoice, b: NormalizedInvoice) =>
        b.uploadedAt - a.uploadedAt,
    )[0] ?? null
  );
}

export async function listNormalizedInvoicesByStorageId(
  ctx: ReadCtx,
  userId: Id<"users">,
  monthKey: string,
  storageId: Id<"_storage">,
): Promise<NormalizedInvoice[]> {
  return await ctx.db
    .query("incomingInvoices")
    .withIndex("by_user_month_and_storage_id", (q) =>
      q
        .eq("userId", userId)
        .eq("monthKey", monthKey)
        .eq("storageId", storageId),
    )
    .collect();
}

export async function patchNormalizedInvoicesByStorageId(
  ctx: WriteCtx,
  userId: Id<"users">,
  monthKey: string,
  storageId: Id<"_storage">,
  updater: (invoice: NormalizedInvoice) => Partial<NormalizedInvoice>,
) {
  const invoices = await listNormalizedInvoicesByStorageId(
    ctx,
    userId,
    monthKey,
    storageId,
  );

  for (const invoice of invoices) {
    await ctx.db.patch(invoice._id, updater(invoice));
  }
}
