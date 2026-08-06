import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { internalMutation, mutation, query } from "./_generated/server";
import {
  analysisResultValidator,
  createEmptyAnalysis,
  createEmptyParsing,
  generateInvoiceId,
  generateStatementId,
  getFileNameWithoutExtension,
  parseCsvTransactions,
} from "./monthData";
import {
  findNormalizedInvoiceByMatch,
  getMergedTransactionsFromNormalized,
  getMonthDataFromNormalized,
  listNormalizedInvoices,
  listNormalizedInvoicesByStorageId,
  listNormalizedStatements,
  listNormalizedStatementTransactions,
  patchNormalizedInvoicesByStorageId,
} from "./normalizedMonthStore";

async function safeDeleteStorage(ctx: MutationCtx, storageId: Id<"_storage">) {
  try {
    await ctx.storage.delete(storageId);
  } catch (error) {
    console.warn("🗑️ Failed to delete file from storage.", error);
  }
}

async function requireNonAnonymousUser(ctx: MutationCtx): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new Error("Not authenticated");
  }

  const user = await ctx.db.get(userId);
  if (!user || user.isAnonymous) {
    throw new Error("Password account required for file uploads");
  }

  return userId;
}

async function deleteBindingsForInvoiceStorageIds(
  ctx: MutationCtx,
  userId: Id<"users">,
  monthKey: string,
  storageIds: Set<Id<"_storage">>,
) {
  if (storageIds.size === 0) {
    return;
  }

  const bindings = await ctx.db
    .query("transactionInvoiceBindings")
    .withIndex("by_user_and_month", (q) =>
      q.eq("userId", userId).eq("monthKey", monthKey),
    )
    .collect();

  for (const binding of bindings) {
    if (
      binding.invoiceStorageId !== null &&
      binding.invoiceStorageId !== "NOT_NEEDED" &&
      storageIds.has(binding.invoiceStorageId)
    ) {
      await ctx.db.delete(binding._id);
    }
  }
}

async function insertStatementTransactions(
  ctx: MutationCtx,
  userId: Id<"users">,
  monthKey: string,
  statementId: string,
  transactions: Doc<"statementTransactions">["transaction"][] | undefined,
) {
  if (!transactions) {
    return;
  }

  const now = Date.now();
  for (const transaction of transactions) {
    await ctx.db.insert("statementTransactions", {
      userId,
      monthKey,
      statementId,
      transactionId: transaction.id,
      transaction,
      createdAt: now,
    });
  }
}

async function listStatementTransactionsByStatementId(
  ctx: MutationCtx,
  statementId: string,
) {
  return await ctx.db
    .query("statementTransactions")
    .withIndex("by_statement_id", (q) => q.eq("statementId", statementId))
    .collect();
}

async function deleteBindingsForTransactionIds(
  ctx: MutationCtx,
  userId: Id<"users">,
  monthKey: string,
  transactionIds: Set<string>,
) {
  if (transactionIds.size === 0) {
    return;
  }

  const bindings = await ctx.db
    .query("transactionInvoiceBindings")
    .withIndex("by_user_and_month", (q) =>
      q.eq("userId", userId).eq("monthKey", monthKey),
    )
    .collect();

  for (const binding of bindings) {
    if (transactionIds.has(binding.transactionId)) {
      await ctx.db.delete(binding._id);
    }
  }
}

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireNonAnonymousUser(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const getMonthData = query({
  args: { monthKey: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    const userSettings = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    return await getMonthDataFromNormalized(
      ctx,
      userId,
      args.monthKey,
      userSettings?.vatId,
    );
  },
});

export const addIncomingInvoice = mutation({
  args: {
    monthKey: v.string(),
    storageId: v.id("_storage"),
    fileName: v.string(),
    fileHash: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireNonAnonymousUser(ctx);

    const existingInvoices = await ctx.db
      .query("incomingInvoices")
      .withIndex("by_user_and_month", (q) =>
        q.eq("userId", userId).eq("monthKey", args.monthKey),
      )
      .collect();

    const duplicateSource = args.fileHash
      ? existingInvoices.find(
          (invoice) => invoice.fileHash && invoice.fileHash === args.fileHash,
        )
      : null;

    const uploadedAt = Date.now();
    const invoiceId = generateInvoiceId();

    await ctx.db.insert("incomingInvoices", {
      userId,
      monthKey: args.monthKey,
      invoiceId,
      storageId: duplicateSource?.storageId ?? args.storageId,
      fileName: args.fileName,
      name: getFileNameWithoutExtension(args.fileName),
      fileHash: args.fileHash,
      isDuplicate: Boolean(duplicateSource),
      duplicateOfStorageId: duplicateSource?.storageId,
      uploadedAt,
      analysis: duplicateSource
        ? duplicateSource.analysis
        : createEmptyAnalysis(),
      parsing: duplicateSource ? duplicateSource.parsing : createEmptyParsing(),
    });

    if (duplicateSource && duplicateSource.storageId !== args.storageId) {
      await safeDeleteStorage(ctx, args.storageId);
    }

    if (!duplicateSource) {
      await ctx.scheduler.runAfter(0, internal.invoiceAnalysis.analyzeInvoice, {
        monthKey: args.monthKey,
        storageId: args.storageId,
        userId,
      });

      await ctx.scheduler.runAfter(0, internal.invoiceParsing.parseInvoice, {
        monthKey: args.monthKey,
        storageId: args.storageId,
        userId,
      });
    }
  },
});

export const addStatement = mutation({
  args: {
    monthKey: v.string(),
    storageId: v.id("_storage"),
    fileName: v.string(),
    fileType: v.union(v.literal("pdf"), v.literal("csv")),
    csvContent: v.optional(v.string()),
    fileHash: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireNonAnonymousUser(ctx);

    let parsedTransactions: Doc<"statementTransactions">["transaction"][];
    try {
      parsedTransactions =
        args.fileType === "csv" && args.csvContent
          ? parseCsvTransactions(args.csvContent)
          : [];
    } catch (error) {
      await safeDeleteStorage(ctx, args.storageId);
      throw error;
    }

    const duplicateSource = args.fileHash
      ? await ctx.db
          .query("statements")
          .withIndex("by_user_month_and_file_hash", (q) =>
            q
              .eq("userId", userId)
              .eq("monthKey", args.monthKey)
              .eq("fileHash", args.fileHash),
          )
          .first()
      : null;

    const uploadedAt = Date.now();
    const statementId = generateStatementId();
    const duplicateTransactions = duplicateSource
      ? (
          await listStatementTransactionsByStatementId(
            ctx,
            duplicateSource.statementId,
          )
        ).map((row) => row.transaction)
      : undefined;
    const statementTransactions = duplicateTransactions ?? parsedTransactions;

    await ctx.db.insert("statements", {
      userId,
      monthKey: args.monthKey,
      statementId,
      storageId: duplicateSource?.storageId ?? args.storageId,
      fileName: args.fileName,
      fileType: args.fileType,
      fileHash: args.fileHash,
      isDuplicate: Boolean(duplicateSource),
      duplicateOfStorageId: duplicateSource?.storageId,
      uploadedAt,
    });

    await insertStatementTransactions(
      ctx,
      userId,
      args.monthKey,
      statementId,
      statementTransactions,
    );

    if (duplicateSource && duplicateSource.storageId !== args.storageId) {
      await safeDeleteStorage(ctx, args.storageId);
    }

    return {
      isDuplicate: Boolean(duplicateSource),
      duplicateOfStorageId: duplicateSource?.storageId ?? null,
    };
  },
});

export const deleteIncomingInvoice = mutation({
  args: {
    monthKey: v.string(),
    invoiceId: v.optional(v.string()),
    storageId: v.id("_storage"),
    uploadedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const targetInvoice = await findNormalizedInvoiceByMatch(
      ctx,
      userId,
      args.monthKey,
      args,
    );

    if (!targetInvoice) {
      return;
    }

    await ctx.db.delete(targetInvoice._id);

    const remainingInvoices = await listNormalizedInvoicesByStorageId(
      ctx,
      userId,
      args.monthKey,
      targetInvoice.storageId,
    );

    if (remainingInvoices.length === 0) {
      await deleteBindingsForInvoiceStorageIds(
        ctx,
        userId,
        args.monthKey,
        new Set([targetInvoice.storageId]),
      );
      await safeDeleteStorage(ctx, targetInvoice.storageId);
    }
  },
});

export const deleteStatement = mutation({
  args: {
    monthKey: v.string(),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const statements = await ctx.db
      .query("statements")
      .withIndex("by_user_month_and_storage_id", (q) =>
        q
          .eq("userId", userId)
          .eq("monthKey", args.monthKey)
          .eq("storageId", args.storageId),
      )
      .collect();

    const statementTransactionRows = (
      await Promise.all(
        statements.map(
          async (statement) =>
            await listStatementTransactionsByStatementId(
              ctx,
              statement.statementId,
            ),
        ),
      )
    ).flat();
    const transactionIds = new Set(
      statementTransactionRows.map((row) => row.transactionId),
    );

    for (const row of statementTransactionRows) {
      await ctx.db.delete(row._id);
    }

    await deleteBindingsForTransactionIds(
      ctx,
      userId,
      args.monthKey,
      transactionIds,
    );

    for (const statement of statements) {
      await ctx.db.delete(statement._id);
    }

    if (statements.length > 0) {
      await safeDeleteStorage(ctx, args.storageId);
    }
  },
});

/**
 * Single persistence path for an invoice analysis outcome. Commits all four
 * extracted fields plus the big-error state in one transaction (a partial
 * extraction can no longer half-commit), and applies the sender-rename
 * policy: adopt the analyzed sender as the invoice name only while the name
 * is still the filename-derived default.
 */
export const updateInvoiceAnalysis = internalMutation({
  args: {
    monthKey: v.string(),
    storageId: v.id("_storage"),
    userId: v.id("users"),
    date: analysisResultValidator,
    sender: analysisResultValidator,
    parsedText: analysisResultValidator,
    amount: analysisResultValidator,
    analysisBigError: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    await patchNormalizedInvoicesByStorageId(
      ctx,
      args.userId,
      args.monthKey,
      args.storageId,
      (invoice) => {
        const analyzedSender = args.sender.value;
        const defaultName = getFileNameWithoutExtension(invoice.fileName);
        const shouldUseAnalyzedSender =
          analyzedSender !== null &&
          analyzedSender.length > 0 &&
          (!invoice.name || invoice.name === defaultName);

        return {
          ...(shouldUseAnalyzedSender ? { name: analyzedSender } : {}),
          analysis: {
            date: args.date,
            sender: args.sender,
            parsedText: args.parsedText,
            amount: args.amount,
            analysisBigError: args.analysisBigError,
          },
        };
      },
    );
  },
});

export const updateInvoiceName = mutation({
  args: {
    monthKey: v.string(),
    invoiceId: v.optional(v.string()),
    storageId: v.id("_storage"),
    uploadedAt: v.optional(v.number()),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const invoice = await findNormalizedInvoiceByMatch(
      ctx,
      userId,
      args.monthKey,
      args,
    );

    if (!invoice) {
      throw new Error("Invoice not found");
    }

    await ctx.db.patch(invoice._id, { name: args.name });
  },
});

export const updateInvoiceAnalysisBigError = internalMutation({
  args: {
    monthKey: v.string(),
    storageId: v.id("_storage"),
    userId: v.id("users"),
    analysisBigError: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    await patchNormalizedInvoicesByStorageId(
      ctx,
      args.userId,
      args.monthKey,
      args.storageId,
      (invoice) => ({
        analysis: {
          ...invoice.analysis,
          analysisBigError: args.analysisBigError,
        },
      }),
    );
  },
});

export const getMergedTransactions = query({
  args: { monthKey: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    return await getMergedTransactionsFromNormalized(
      ctx,
      userId,
      args.monthKey,
    );
  },
});

export const deleteAllStatements = mutation({
  args: {
    monthKey: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const [statements, statementTransactionRows] = await Promise.all([
      listNormalizedStatements(ctx, userId, args.monthKey),
      listNormalizedStatementTransactions(ctx, userId, args.monthKey),
    ]);
    const transactionIds = new Set(
      statementTransactionRows.map((row) => row.transactionId),
    );
    const storageIds = new Set(
      statements.map((statement) => statement.storageId),
    );

    for (const row of statementTransactionRows) {
      await ctx.db.delete(row._id);
    }

    for (const statement of statements) {
      await ctx.db.delete(statement._id);
    }

    await deleteBindingsForTransactionIds(
      ctx,
      userId,
      args.monthKey,
      transactionIds,
    );

    // Storage deletion is not transactional with the DB: delete blobs only
    // after every row mutation has been issued, so a failed mutation cannot
    // roll back rows while leaving their storage already gone.
    for (const storageId of storageIds) {
      await safeDeleteStorage(ctx, storageId);
    }
  },
});

export const deleteAllInvoices = mutation({
  args: {
    monthKey: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const invoices = await listNormalizedInvoices(ctx, userId, args.monthKey);
    const storageIds = new Set(invoices.map((invoice) => invoice.storageId));

    for (const invoice of invoices) {
      await ctx.db.delete(invoice._id);
    }

    await deleteBindingsForInvoiceStorageIds(
      ctx,
      userId,
      args.monthKey,
      storageIds,
    );

    for (const storageId of storageIds) {
      await safeDeleteStorage(ctx, storageId);
    }
  },
});

export const bindTransactionToInvoice = mutation({
  args: {
    monthKey: v.string(),
    transactionId: v.string(),
    invoiceStorageId: v.union(
      v.id("_storage"),
      v.literal("NOT_NEEDED"),
      v.null(),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const claimedInvoiceStorageId =
      args.invoiceStorageId && args.invoiceStorageId !== "NOT_NEEDED"
        ? args.invoiceStorageId
        : null;

    const existingBindings = await ctx.db
      .query("transactionInvoiceBindings")
      .withIndex("by_user_and_month", (q) =>
        q.eq("userId", userId).eq("monthKey", args.monthKey),
      )
      .collect();

    for (const binding of existingBindings) {
      if (
        binding.transactionId === args.transactionId ||
        (claimedInvoiceStorageId !== null &&
          binding.invoiceStorageId === claimedInvoiceStorageId)
      ) {
        await ctx.db.delete(binding._id);
      }
    }

    if (!args.invoiceStorageId) {
      return;
    }

    await ctx.db.insert("transactionInvoiceBindings", {
      userId,
      monthKey: args.monthKey,
      transactionId: args.transactionId,
      invoiceStorageId: args.invoiceStorageId,
      boundAt: Date.now(),
    });
  },
});

/**
 * Bind many transaction/invoice pairs in one transaction. Same dedupe
 * semantics as `bindTransactionToInvoice` (a transaction keeps at most one
 * binding, an invoice is claimed by at most one transaction), applied in a
 * single pass so the bulk auto-matcher does not fan out N round trips with N
 * partial-failure points.
 */
export const bindTransactionsToInvoices = mutation({
  args: {
    monthKey: v.string(),
    bindings: v.array(
      v.object({
        transactionId: v.string(),
        invoiceStorageId: v.id("_storage"),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Defensive: keep the first pair for any transaction or invoice that shows
    // up twice so a malformed request cannot break the 1:1 invariant.
    const claimedTransactionIds = new Set<string>();
    const claimedInvoiceStorageIds = new Set<string>();
    const bindings = args.bindings.filter((binding) => {
      if (
        claimedTransactionIds.has(binding.transactionId) ||
        claimedInvoiceStorageIds.has(binding.invoiceStorageId)
      ) {
        return false;
      }
      claimedTransactionIds.add(binding.transactionId);
      claimedInvoiceStorageIds.add(binding.invoiceStorageId);
      return true;
    });

    if (bindings.length === 0) {
      return 0;
    }

    const existingBindings = await ctx.db
      .query("transactionInvoiceBindings")
      .withIndex("by_user_and_month", (q) =>
        q.eq("userId", userId).eq("monthKey", args.monthKey),
      )
      .collect();

    for (const binding of existingBindings) {
      if (
        claimedTransactionIds.has(binding.transactionId) ||
        (binding.invoiceStorageId !== null &&
          claimedInvoiceStorageIds.has(binding.invoiceStorageId))
      ) {
        await ctx.db.delete(binding._id);
      }
    }

    const boundAt = Date.now();
    for (const binding of bindings) {
      await ctx.db.insert("transactionInvoiceBindings", {
        userId,
        monthKey: args.monthKey,
        transactionId: binding.transactionId,
        invoiceStorageId: binding.invoiceStorageId,
        boundAt,
      });
    }

    return bindings.length;
  },
});
