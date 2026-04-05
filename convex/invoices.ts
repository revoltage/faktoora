import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalMutation, mutation, query } from "./_generated/server";
import {
  analysisResultValidator,
  buildBindingLegacyKey,
  buildInvoiceLegacyKey,
  buildScopedLegacyKey,
  buildStatementLegacyKey,
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
  listNormalizedBindings,
  listNormalizedInvoices,
  listNormalizedInvoicesByStorageId,
  listNormalizedStatements,
  patchNormalizedInvoicesByStorageId,
} from "./normalizedMonthStore";

async function safeDeleteStorage(ctx: any, storageId: Id<"_storage">) {
  try {
    const url = await ctx.storage.getUrl(storageId);
    if (url) {
      await ctx.storage.delete(storageId);
    }
  } catch (error) {
    console.warn("Failed to delete file from storage.", error);
  }
}

export const migrateInvoiceNames = internalMutation({
  args: {},
  handler: async (ctx) => {
    const allInvoices = await ctx.db.query("incomingInvoices").collect();

    for (const invoice of allInvoices) {
      if (!invoice.name) {
        await ctx.db.patch(invoice._id, {
          name: getFileNameWithoutExtension(invoice.fileName),
        });
      }
    }
  },
});

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }
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

    return await getMonthDataFromNormalized(ctx, userId, args.monthKey);
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
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

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
      legacyKey: buildScopedLegacyKey({
        kind: "invoice",
        userId,
        monthKey: args.monthKey,
        legacyKey: buildInvoiceLegacyKey({
          invoiceId,
          storageId: duplicateSource?.storageId ?? args.storageId,
          uploadedAt,
        }),
      }),
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
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const uploadedAt = Date.now();

    await ctx.db.insert("statements", {
      userId,
      monthKey: args.monthKey,
      legacyKey: buildScopedLegacyKey({
        kind: "statement",
        userId,
        monthKey: args.monthKey,
        legacyKey: buildStatementLegacyKey({
          storageId: args.storageId,
          uploadedAt,
        }),
      }),
      statementId: generateStatementId(),
      storageId: args.storageId,
      fileName: args.fileName,
      fileType: args.fileType,
      uploadedAt,
      transactions:
        args.fileType === "csv" && args.csvContent
          ? parseCsvTransactions(args.csvContent)
          : undefined,
    });
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

    for (const statement of statements) {
      await ctx.db.delete(statement._id);
    }

    if (statements.length > 0) {
      await safeDeleteStorage(ctx, args.storageId);
    }
  },
});

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
      () => ({
        analysis: {
          date: args.date,
          sender: args.sender,
          parsedText: args.parsedText,
          amount: args.amount,
          analysisBigError: args.analysisBigError,
        },
      }),
    );
  },
});

export const updateInvoiceDate = internalMutation({
  args: {
    monthKey: v.string(),
    storageId: v.id("_storage"),
    userId: v.id("users"),
    date: analysisResultValidator,
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
          date: args.date,
        },
      }),
    );
  },
});

export const updateInvoiceSender = internalMutation({
  args: {
    monthKey: v.string(),
    storageId: v.id("_storage"),
    userId: v.id("users"),
    sender: analysisResultValidator,
  },
  handler: async (ctx, args) => {
    await patchNormalizedInvoicesByStorageId(
      ctx,
      args.userId,
      args.monthKey,
      args.storageId,
      (invoice) => ({
        name: args.sender.value || invoice.name,
        analysis: {
          ...invoice.analysis,
          sender: args.sender,
        },
      }),
    );
  },
});

export const updateInvoiceParsedText = internalMutation({
  args: {
    monthKey: v.string(),
    storageId: v.id("_storage"),
    userId: v.id("users"),
    parsedText: analysisResultValidator,
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
          parsedText: args.parsedText,
        },
      }),
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
      throw new Error("Month data not found");
    }

    await ctx.db.patch(invoice._id, { name: args.name });
  },
});

export const updateInvoiceAmount = internalMutation({
  args: {
    monthKey: v.string(),
    storageId: v.id("_storage"),
    userId: v.id("users"),
    amount: analysisResultValidator,
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
          amount: args.amount,
        },
      }),
    );
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

    const userSettings = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    return await getMergedTransactionsFromNormalized(
      ctx,
      userId,
      args.monthKey,
      userSettings?.manualTransactions,
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

    const [statements, bindings] = await Promise.all([
      listNormalizedStatements(ctx, userId, args.monthKey),
      listNormalizedBindings(ctx, userId, args.monthKey),
    ]);

    for (const statement of statements) {
      await safeDeleteStorage(ctx, statement.storageId);
    }

    for (const statement of statements) {
      await ctx.db.delete(statement._id);
    }

    for (const binding of bindings) {
      await ctx.db.delete(binding._id);
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

    for (const storageId of storageIds) {
      await safeDeleteStorage(ctx, storageId);
    }

    for (const invoice of invoices) {
      await ctx.db.delete(invoice._id);
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

    const existingBindings = await ctx.db
      .query("transactionInvoiceBindings")
      .withIndex("by_user_month_and_transaction_id", (q) =>
        q
          .eq("userId", userId)
          .eq("monthKey", args.monthKey)
          .eq("transactionId", args.transactionId),
      )
      .collect();

    for (const binding of existingBindings) {
      await ctx.db.delete(binding._id);
    }

    if (!args.invoiceStorageId) {
      return;
    }

    await ctx.db.insert("transactionInvoiceBindings", {
      userId,
      monthKey: args.monthKey,
      legacyKey: buildScopedLegacyKey({
        kind: "binding",
        userId,
        monthKey: args.monthKey,
        legacyKey: buildBindingLegacyKey({ transactionId: args.transactionId }),
      }),
      transactionId: args.transactionId,
      invoiceStorageId: args.invoiceStorageId,
      boundAt: Date.now(),
    });
  },
});
