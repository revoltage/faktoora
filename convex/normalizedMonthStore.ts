import type { Doc, Id } from "./_generated/dataModel";
import { addRefundStatus } from "./refundMatching";
import {
  buildBindingLegacyKey,
  buildInvoiceLegacyKey,
  buildScopedLegacyKey,
  buildStatementLegacyKey,
  getStableInvoiceId,
  getStableStatementId,
} from "./monthData";

type DbCtx = { db: any; storage?: any };

type InvoiceMatchArgs = {
  invoiceId?: string;
  storageId: Id<"_storage">;
  uploadedAt?: number;
};

type MonthScope = {
  userId: Id<"users">;
  monthKey: string;
  legacyMonthId?: Id<"months">;
};

type LegacyMonth = Doc<"months">;
type LegacyInvoice = LegacyMonth["incomingInvoices"][number];
type LegacyStatement = LegacyMonth["statements"][number];
type LegacyBinding = LegacyMonth["transactionInvoiceBindings"][number];
type NormalizedInvoice = Doc<"incomingInvoices">;
type NormalizedStatement = Doc<"statements">;
type NormalizedBinding = Doc<"transactionInvoiceBindings">;

export async function listNormalizedInvoices(
  ctx: DbCtx,
  userId: Id<"users">,
  monthKey: string,
): Promise<NormalizedInvoice[]> {
  const invoices = await ctx.db
    .query("incomingInvoices")
    .withIndex("by_user_and_month", (q: any) =>
      q.eq("userId", userId).eq("monthKey", monthKey),
    )
    .collect();

  return invoices.sort(
    (a: NormalizedInvoice, b: NormalizedInvoice) => b.uploadedAt - a.uploadedAt,
  );
}

export async function listNormalizedStatements(
  ctx: DbCtx,
  userId: Id<"users">,
  monthKey: string,
): Promise<NormalizedStatement[]> {
  const statements = await ctx.db
    .query("statements")
    .withIndex("by_user_and_month", (q: any) =>
      q.eq("userId", userId).eq("monthKey", monthKey),
    )
    .collect();

  return statements.sort(
    (a: NormalizedStatement, b: NormalizedStatement) =>
      a.uploadedAt - b.uploadedAt,
  );
}

export async function listNormalizedBindings(
  ctx: DbCtx,
  userId: Id<"users">,
  monthKey: string,
): Promise<NormalizedBinding[]> {
  const bindings = await ctx.db
    .query("transactionInvoiceBindings")
    .withIndex("by_user_and_month", (q: any) =>
      q.eq("userId", userId).eq("monthKey", monthKey),
    )
    .collect();

  return bindings.sort(
    (a: NormalizedBinding, b: NormalizedBinding) => a.boundAt - b.boundAt,
  );
}

export async function getMonthDataFromNormalized(
  ctx: Required<DbCtx>,
  userId: Id<"users">,
  monthKey: string,
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

export async function getMergedTransactionsFromNormalized(
  ctx: DbCtx,
  userId: Id<"users">,
  monthKey: string,
  manualTransactions?: string,
) {
  const [statements, bindings] = await Promise.all([
    listNormalizedStatements(ctx, userId, monthKey),
    listNormalizedBindings(ctx, userId, monthKey),
  ]);

  const bindingMap = new Map<string, Id<"_storage"> | "NOT_NEEDED" | null>();
  for (const binding of bindings) {
    bindingMap.set(binding.transactionId, binding.invoiceStorageId);
  }

  const transactionMap = new Map<string, any>();
  for (const statement of statements) {
    if (statement.fileType === "csv" && statement.transactions) {
      for (const transaction of statement.transactions) {
        if (transaction.id) {
          transactionMap.set(transaction.id, {
            ...transaction,
            sourceFile: statement.fileName,
            boundInvoiceStorageId: bindingMap.get(transaction.id) || null,
          });
        }
      }
    }
  }

  const allTransactions = [...transactionMap.values()];
  const transactionsWithRefundStatus = addRefundStatus(allTransactions);
  const sortedTransactions = transactionsWithRefundStatus.sort((a, b) => {
    const dateA = new Date(a.dateCompleted || a.dateStarted);
    const dateB = new Date(b.dateCompleted || b.dateStarted);
    return dateB.getTime() - dateA.getTime();
  });

  if (manualTransactions) {
    sortedTransactions.push(
      ...parseManualTransactions(manualTransactions, bindingMap),
    );
  }

  return sortedTransactions;
}

export async function findNormalizedInvoiceByMatch(
  ctx: DbCtx,
  userId: Id<"users">,
  monthKey: string,
  args: InvoiceMatchArgs,
): Promise<NormalizedInvoice | null> {
  if (args.invoiceId) {
    const invoice = await ctx.db
      .query("incomingInvoices")
      .withIndex("by_user_month_and_invoice_id", (q: any) =>
        q
          .eq("userId", userId)
          .eq("monthKey", monthKey)
          .eq("invoiceId", args.invoiceId),
      )
      .unique();

    if (invoice) {
      return invoice;
    }
  }

  const invoices = await ctx.db
    .query("incomingInvoices")
    .withIndex("by_user_month_and_storage_id", (q: any) =>
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
  ctx: DbCtx,
  userId: Id<"users">,
  monthKey: string,
  storageId: Id<"_storage">,
): Promise<NormalizedInvoice[]> {
  return await ctx.db
    .query("incomingInvoices")
    .withIndex("by_user_month_and_storage_id", (q: any) =>
      q
        .eq("userId", userId)
        .eq("monthKey", monthKey)
        .eq("storageId", storageId),
    )
    .collect();
}

export async function patchNormalizedInvoicesByStorageId(
  ctx: DbCtx,
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

export async function upsertNormalizedInvoiceFromLegacy(
  ctx: DbCtx,
  scope: MonthScope,
  invoice: LegacyInvoice,
  migratedAt: number,
) {
  const legacyKey = buildScopedLegacyKey({
    kind: "invoice",
    userId: scope.userId,
    monthKey: scope.monthKey,
    legacyKey: buildInvoiceLegacyKey({
      invoiceId: invoice.invoiceId,
      storageId: invoice.storageId,
      uploadedAt: invoice.uploadedAt,
    }),
  });

  const existing = await ctx.db
    .query("incomingInvoices")
    .withIndex("by_legacy_key", (q: any) => q.eq("legacyKey", legacyKey))
    .unique();

  const doc = {
    userId: scope.userId,
    monthKey: scope.monthKey,
    legacyMonthId: scope.legacyMonthId,
    legacyKey,
    invoiceId: getStableInvoiceId({
      invoiceId: invoice.invoiceId,
      storageId: invoice.storageId,
      uploadedAt: invoice.uploadedAt,
    }),
    storageId: invoice.storageId,
    fileName: invoice.fileName,
    name: invoice.name,
    fileHash: invoice.fileHash,
    isDuplicate: invoice.isDuplicate,
    duplicateOfStorageId: invoice.duplicateOfStorageId,
    uploadedAt: invoice.uploadedAt,
    analysis: invoice.analysis,
    parsing: invoice.parsing,
    migratedAt,
  };

  if (existing) {
    await ctx.db.patch(existing._id, doc);
    return existing._id;
  }

  return await ctx.db.insert("incomingInvoices", doc);
}

export async function upsertNormalizedStatementFromLegacy(
  ctx: DbCtx,
  scope: MonthScope,
  statement: LegacyStatement,
  migratedAt: number,
) {
  const legacyKey = buildScopedLegacyKey({
    kind: "statement",
    userId: scope.userId,
    monthKey: scope.monthKey,
    legacyKey: buildStatementLegacyKey({
      storageId: statement.storageId,
      uploadedAt: statement.uploadedAt,
    }),
  });

  const existing = await ctx.db
    .query("statements")
    .withIndex("by_legacy_key", (q: any) => q.eq("legacyKey", legacyKey))
    .unique();

  const doc = {
    userId: scope.userId,
    monthKey: scope.monthKey,
    legacyMonthId: scope.legacyMonthId,
    legacyKey,
    statementId: getStableStatementId({
      storageId: statement.storageId,
      uploadedAt: statement.uploadedAt,
    }),
    storageId: statement.storageId,
    fileName: statement.fileName,
    fileType: statement.fileType,
    uploadedAt: statement.uploadedAt,
    transactions: statement.transactions,
    migratedAt,
  };

  if (existing) {
    await ctx.db.patch(existing._id, doc);
    return existing._id;
  }

  return await ctx.db.insert("statements", doc);
}

export async function upsertNormalizedBindingFromLegacy(
  ctx: DbCtx,
  scope: MonthScope,
  binding: LegacyBinding,
  migratedAt: number,
) {
  const legacyKey = buildScopedLegacyKey({
    kind: "binding",
    userId: scope.userId,
    monthKey: scope.monthKey,
    legacyKey: buildBindingLegacyKey({ transactionId: binding.transactionId }),
  });

  const existing = await ctx.db
    .query("transactionInvoiceBindings")
    .withIndex("by_legacy_key", (q: any) => q.eq("legacyKey", legacyKey))
    .unique();

  const doc = {
    userId: scope.userId,
    monthKey: scope.monthKey,
    legacyMonthId: scope.legacyMonthId,
    legacyKey,
    transactionId: binding.transactionId,
    invoiceStorageId: binding.invoiceStorageId,
    boundAt: binding.boundAt,
    migratedAt,
  };

  if (existing) {
    await ctx.db.patch(existing._id, doc);
    return existing._id;
  }

  return await ctx.db.insert("transactionInvoiceBindings", doc);
}

export async function backfillNormalizedMonth(
  ctx: DbCtx,
  month: LegacyMonth,
  migratedAt = Date.now(),
) {
  const scope = {
    userId: month.userId,
    monthKey: month.monthKey,
    legacyMonthId: month._id,
  };

  for (const invoice of month.incomingInvoices) {
    await upsertNormalizedInvoiceFromLegacy(ctx, scope, invoice, migratedAt);
  }

  for (const statement of month.statements) {
    await upsertNormalizedStatementFromLegacy(
      ctx,
      scope,
      statement,
      migratedAt,
    );
  }

  for (const binding of month.transactionInvoiceBindings) {
    await upsertNormalizedBindingFromLegacy(ctx, scope, binding, migratedAt);
  }
}

function parseManualTransactions(
  text: string,
  bindingMap: Map<string, Id<"_storage"> | "NOT_NEEDED" | null>,
) {
  const lines = text.split("\n").filter((line) => line.trim());
  const transactions = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const parts = line.split(",").map((p) => p.trim());
    const name = parts[0] || "";
    const amount = parts[1] || "";

    if (name) {
      const id = `manual_transaction_${i}`;
      transactions.push({
        id,
        dateStarted: "",
        dateCompleted: "",
        type: "MANUAL",
        state: "",
        description: name,
        reference: "",
        payer: "",
        cardNumber: "",
        cardLabel: "",
        cardState: "",
        origCurrency: "",
        origAmount: "",
        paymentCurrency: "",
        amount: amount || "",
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
        sourceFile: "Manual",
        boundInvoiceStorageId: bindingMap.get(id) || null,
      });
    }
  }

  return transactions;
}
