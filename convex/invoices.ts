import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import { addRefundStatus } from "./refundMatching";

const analysisResult = v.object({
  value: v.union(v.string(), v.null()),
  error: v.union(v.string(), v.null()),
  lastUpdated: v.union(v.number(), v.null()),
});

const MAX_INVOICE_FILE_SIZE_BYTES = 20 * 1024 * 1024;
const MAX_STATEMENT_FILE_SIZE_BYTES = 30 * 1024 * 1024;

// Helper function to get filename without extension
function getFileNameWithoutExtension(fileName: string): string {
  const lastDotIndex = fileName.lastIndexOf(".");
  if (lastDotIndex === -1) {
    return fileName;
  }
  return fileName.substring(0, lastDotIndex);
}

function getFileExtension(fileName: string): string {
  const parts = fileName.split(".");
  if (parts.length < 2) {
    return "";
  }
  return parts[parts.length - 1].toLowerCase();
}

async function assertStorageFileAvailable(ctx: any, storageId: Id<"_storage">) {
  const fileBlob = await ctx.storage.get(storageId);
  if (!fileBlob) {
    throw new Error("Uploaded file was not found in storage");
  }
  return fileBlob;
}

async function validateInvoiceUpload(
  ctx: any,
  storageId: Id<"_storage">,
  fileName: string,
) {
  const extension = getFileExtension(fileName);
  const allowedExtensions = new Set(["pdf", "png", "jpg", "jpeg", "webp"]);
  if (!allowedExtensions.has(extension)) {
    throw new Error("Unsupported invoice file type");
  }

  const fileBlob = await assertStorageFileAvailable(ctx, storageId);
  if (fileBlob.size > MAX_INVOICE_FILE_SIZE_BYTES) {
    throw new Error("Invoice file exceeds 20MB limit");
  }
}

async function validateStatementUpload(
  ctx: any,
  storageId: Id<"_storage">,
  fileName: string,
  fileType: "pdf" | "csv",
) {
  const extension = getFileExtension(fileName);
  const expectedExtension = fileType === "csv" ? "csv" : "pdf";
  if (extension !== expectedExtension) {
    throw new Error(`Statement file extension must be .${expectedExtension}`);
  }

  const fileBlob = await assertStorageFileAvailable(ctx, storageId);
  if (fileBlob.size > MAX_STATEMENT_FILE_SIZE_BYTES) {
    throw new Error("Statement file exceeds 30MB limit");
  }
}

async function addIncomingInvoiceForUser(
  ctx: any,
  args: {
    monthKey: string;
    storageId: Id<"_storage">;
    fileName: string;
    userId: Id<"users">;
  },
) {
  await validateInvoiceUpload(ctx, args.storageId, args.fileName);

  const existing = await ctx.db
    .query("months")
    .withIndex("by_user_and_month", (q: any) =>
      q.eq("userId", args.userId).eq("monthKey", args.monthKey),
    )
    .unique();

  const newInvoice = {
    storageId: args.storageId,
    fileName: args.fileName,
    name: getFileNameWithoutExtension(args.fileName),
    uploadedAt: Date.now(),
    analysis: {
      date: {
        value: null,
        error: null,
        lastUpdated: null,
      },
      sender: {
        value: null,
        error: null,
        lastUpdated: null,
      },
      parsedText: {
        value: null,
        error: null,
        lastUpdated: null,
      },
      amount: {
        value: null,
        error: null,
        lastUpdated: null,
      },
      analysisBigError: null,
    },
    parsing: {
      parsedText: {
        value: null,
        error: null,
        lastUpdated: null,
      },
    },
  };

  if (existing) {
    await ctx.db.patch(existing._id, {
      incomingInvoices: [...existing.incomingInvoices, newInvoice],
    });
  } else {
    await ctx.db.insert("months", {
      userId: args.userId,
      monthKey: args.monthKey,
      incomingInvoices: [newInvoice],
      statements: [],
      transactionInvoiceBindings: [],
    });
  }

  await ctx.scheduler.runAfter(0, internal.invoiceAnalysis.analyzeInvoice, {
    monthKey: args.monthKey,
    storageId: args.storageId,
    userId: args.userId,
  });

  await ctx.scheduler.runAfter(0, internal.invoiceParsing.parseInvoice, {
    monthKey: args.monthKey,
    storageId: args.storageId,
    userId: args.userId,
  });
}

async function addStatementForUser(
  ctx: any,
  args: {
    monthKey: string;
    storageId: Id<"_storage">;
    fileName: string;
    fileType: "pdf" | "csv";
    csvContent?: string;
    userId: Id<"users">;
  },
) {
  await validateStatementUpload(
    ctx,
    args.storageId,
    args.fileName,
    args.fileType,
  );

  const existing = await ctx.db
    .query("months")
    .withIndex("by_user_and_month", (q: any) =>
      q.eq("userId", args.userId).eq("monthKey", args.monthKey),
    )
    .unique();

  let transactions = undefined;
  if (args.fileType === "csv" && args.csvContent) {
    transactions = parseCsvTransactions(args.csvContent);
  }

  const newStatement = {
    storageId: args.storageId,
    fileName: args.fileName,
    fileType: args.fileType,
    uploadedAt: Date.now(),
    transactions,
  };

  if (existing) {
    await ctx.db.patch(existing._id, {
      statements: [...existing.statements, newStatement],
    });
  } else {
    await ctx.db.insert("months", {
      userId: args.userId,
      monthKey: args.monthKey,
      incomingInvoices: [],
      statements: [newStatement],
      transactionInvoiceBindings: [],
    });
  }
}

// Helper to safely delete a file from storage, ignoring missing files
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

// Migration function to add name field to existing invoices
export const migrateInvoiceNames = internalMutation({
  args: {},
  handler: async (ctx) => {
    const allMonths = await ctx.db.query("months").collect();

    for (const month of allMonths) {
      const updatedInvoices = month.incomingInvoices.map((invoice) => {
        if (!invoice.name) {
          return {
            ...invoice,
            name: getFileNameWithoutExtension(invoice.fileName),
          };
        }
        return invoice;
      });

      await ctx.db.patch(month._id, {
        incomingInvoices: updatedInvoices,
      });
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

export const generateUploadUrlInternal = internalMutation({
  args: {},
  handler: async (ctx) => {
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

    const monthData = await ctx.db
      .query("months")
      .withIndex("by_user_and_month", (q) =>
        q.eq("userId", userId).eq("monthKey", args.monthKey),
      )
      .unique();

    if (!monthData) {
      return {
        monthKey: args.monthKey,
        incomingInvoices: [],
        statements: [],
        transactionInvoiceBindings: [],
      };
    }

    const incomingInvoicesWithUrls = await Promise.all(
      monthData.incomingInvoices.map(async (invoice) => ({
        ...invoice,
        url: await ctx.storage.getUrl(invoice.storageId),
      })),
    );

    const statementsWithUrls = await Promise.all(
      monthData.statements.map(async (statement) => ({
        ...statement,
        url: await ctx.storage.getUrl(statement.storageId),
      })),
    );

    // Sort invoices by uploadedAt in descending order (latest first)
    const sortedInvoices = incomingInvoicesWithUrls.sort(
      (a, b) => b.uploadedAt - a.uploadedAt,
    );

    return {
      monthKey: args.monthKey,
      incomingInvoices: sortedInvoices,
      statements: statementsWithUrls,
      transactionInvoiceBindings: monthData.transactionInvoiceBindings || [],
    };
  },
});

export const addIncomingInvoice = mutation({
  args: {
    monthKey: v.string(),
    storageId: v.id("_storage"),
    fileName: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    await addIncomingInvoiceForUser(ctx, {
      monthKey: args.monthKey,
      storageId: args.storageId,
      fileName: args.fileName,
      userId,
    });
  },
});

export const addIncomingInvoiceForUserInternal = internalMutation({
  args: {
    monthKey: v.string(),
    storageId: v.id("_storage"),
    fileName: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    await addIncomingInvoiceForUser(ctx, args);
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

    await addStatementForUser(ctx, {
      monthKey: args.monthKey,
      storageId: args.storageId,
      fileName: args.fileName,
      fileType: args.fileType,
      csvContent: args.csvContent,
      userId,
    });
  },
});

export const addStatementForUserInternal = internalMutation({
  args: {
    monthKey: v.string(),
    storageId: v.id("_storage"),
    fileName: v.string(),
    fileType: v.union(v.literal("pdf"), v.literal("csv")),
    csvContent: v.optional(v.string()),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    await addStatementForUser(ctx, args);
  },
});

export const deleteIncomingInvoice = mutation({
  args: {
    monthKey: v.string(),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const existing = await ctx.db
      .query("months")
      .withIndex("by_user_and_month", (q) =>
        q.eq("userId", userId).eq("monthKey", args.monthKey),
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        incomingInvoices: existing.incomingInvoices.filter(
          (inv) => inv.storageId !== args.storageId,
        ),
      });
      await safeDeleteStorage(ctx, args.storageId);
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

    const existing = await ctx.db
      .query("months")
      .withIndex("by_user_and_month", (q) =>
        q.eq("userId", userId).eq("monthKey", args.monthKey),
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        statements: existing.statements.filter(
          (stmt) => stmt.storageId !== args.storageId,
        ),
      });
      await safeDeleteStorage(ctx, args.storageId);
    }
  },
});

export const updateInvoiceAnalysis = internalMutation({
  args: {
    monthKey: v.string(),
    storageId: v.id("_storage"),
    userId: v.id("users"),
    date: analysisResult,
    sender: analysisResult,
    parsedText: analysisResult,
    amount: analysisResult,
    analysisBigError: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    const monthData = await ctx.db
      .query("months")
      .withIndex("by_user_and_month", (q) =>
        q.eq("userId", args.userId).eq("monthKey", args.monthKey),
      )
      .unique();

    if (!monthData) {
      return;
    }

    const updatedInvoices = monthData.incomingInvoices.map((invoice) => {
      if (invoice.storageId === args.storageId) {
        return {
          ...invoice,
          analysis: {
            date: args.date,
            sender: args.sender,
            parsedText: args.parsedText,
            amount: args.amount,
            analysisBigError: args.analysisBigError,
          },
        };
      }
      return invoice;
    });

    await ctx.db.patch(monthData._id, {
      incomingInvoices: updatedInvoices,
    });
  },
});

export const updateInvoiceDate = internalMutation({
  args: {
    monthKey: v.string(),
    storageId: v.id("_storage"),
    userId: v.id("users"),
    date: analysisResult,
  },
  handler: async (ctx, args) => {
    const monthData = await ctx.db
      .query("months")
      .withIndex("by_user_and_month", (q) =>
        q.eq("userId", args.userId).eq("monthKey", args.monthKey),
      )
      .unique();

    if (!monthData) {
      return;
    }

    const updatedInvoices = monthData.incomingInvoices.map((invoice) => {
      if (invoice.storageId === args.storageId) {
        return {
          ...invoice,
          analysis: {
            ...invoice.analysis,
            date: args.date,
          },
        };
      }
      return invoice;
    });

    await ctx.db.patch(monthData._id, {
      incomingInvoices: updatedInvoices,
    });
  },
});

export const updateInvoiceSender = internalMutation({
  args: {
    monthKey: v.string(),
    storageId: v.id("_storage"),
    userId: v.id("users"),
    sender: analysisResult,
  },
  handler: async (ctx, args) => {
    const monthData = await ctx.db
      .query("months")
      .withIndex("by_user_and_month", (q) =>
        q.eq("userId", args.userId).eq("monthKey", args.monthKey),
      )
      .unique();

    if (!monthData) {
      return;
    }

    const updatedInvoices = monthData.incomingInvoices.map((invoice) => {
      if (invoice.storageId === args.storageId) {
        return {
          ...invoice,
          name: args.sender.value || invoice.name, // Update name to sender if available, otherwise keep existing name
          analysis: {
            ...invoice.analysis,
            sender: args.sender,
          },
        };
      }
      return invoice;
    });

    await ctx.db.patch(monthData._id, {
      incomingInvoices: updatedInvoices,
    });
  },
});

export const updateInvoiceParsedText = internalMutation({
  args: {
    monthKey: v.string(),
    storageId: v.id("_storage"),
    userId: v.id("users"),
    parsedText: analysisResult,
  },
  handler: async (ctx, args) => {
    const monthData = await ctx.db
      .query("months")
      .withIndex("by_user_and_month", (q) =>
        q.eq("userId", args.userId).eq("monthKey", args.monthKey),
      )
      .unique();

    if (!monthData) {
      return;
    }

    const updatedInvoices = monthData.incomingInvoices.map((invoice) => {
      if (invoice.storageId === args.storageId) {
        return {
          ...invoice,
          analysis: {
            ...invoice.analysis,
            parsedText: args.parsedText,
          },
        };
      }
      return invoice;
    });

    await ctx.db.patch(monthData._id, {
      incomingInvoices: updatedInvoices,
    });
  },
});

export const updateInvoiceName = mutation({
  args: {
    monthKey: v.string(),
    storageId: v.id("_storage"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const monthData = await ctx.db
      .query("months")
      .withIndex("by_user_and_month", (q) =>
        q.eq("userId", userId).eq("monthKey", args.monthKey),
      )
      .unique();

    if (!monthData) {
      throw new Error("Month data not found");
    }

    const updatedInvoices = monthData.incomingInvoices.map((invoice) => {
      if (invoice.storageId === args.storageId) {
        return {
          ...invoice,
          name: args.name,
        };
      }
      return invoice;
    });

    await ctx.db.patch(monthData._id, {
      incomingInvoices: updatedInvoices,
    });
  },
});

export const updateInvoiceAmount = internalMutation({
  args: {
    monthKey: v.string(),
    storageId: v.id("_storage"),
    userId: v.id("users"),
    amount: analysisResult,
  },
  handler: async (ctx, args) => {
    const monthData = await ctx.db
      .query("months")
      .withIndex("by_user_and_month", (q) =>
        q.eq("userId", args.userId).eq("monthKey", args.monthKey),
      )
      .unique();

    if (!monthData) {
      return;
    }

    const updatedInvoices = monthData.incomingInvoices.map((invoice) => {
      if (invoice.storageId === args.storageId) {
        return {
          ...invoice,
          analysis: {
            ...invoice.analysis,
            amount: args.amount,
          },
        };
      }
      return invoice;
    });

    await ctx.db.patch(monthData._id, {
      incomingInvoices: updatedInvoices,
    });
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
    const monthData = await ctx.db
      .query("months")
      .withIndex("by_user_and_month", (q) =>
        q.eq("userId", args.userId).eq("monthKey", args.monthKey),
      )
      .unique();

    if (!monthData) {
      return;
    }

    const updatedInvoices = monthData.incomingInvoices.map((invoice) => {
      if (invoice.storageId === args.storageId) {
        return {
          ...invoice,
          analysis: {
            ...invoice.analysis,
            analysisBigError: args.analysisBigError,
          },
        };
      }
      return invoice;
    });

    await ctx.db.patch(monthData._id, {
      incomingInvoices: updatedInvoices,
    });
  },
});

function parseCsvTransactions(csvText: string) {
  const lines = csvText.split("\n").filter((line) => line.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim());
  const transactions = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    // Simple CSV parsing - split by comma and handle quoted fields
    const values = parseCsvLine(line);

    if (values.length >= headers.length) {
      const transaction = {
        id: values[2] || "", // ID column
        dateStarted: values[0] || "",
        dateCompleted: values[1] || "",
        type: values[3] || "",
        state: values[4] || "",
        description: values[5] || "",
        reference: values[6] || "",
        payer: values[7] || "",
        cardNumber: values[8] || "",
        cardLabel: values[9] || "",
        cardState: values[10] || "",
        origCurrency: values[11] || "",
        origAmount: values[12] || "",
        paymentCurrency: values[13] || "",
        amount: values[14] || "",
        totalAmount: values[15] || "",
        exchangeRate: values[16] || "",
        fee: values[17] || "",
        feeCurrency: values[18] || "",
        balance: values[19] || "",
        account: values[20] || "",
        beneficiaryAccountNumber: values[21] || "",
        beneficiarySortCode: values[22] || "",
        beneficiaryIban: values[23] || "",
        beneficiaryBic: values[24] || "",
        mcc: values[25] || "",
        relatedTransactionId: values[26] || "",
        spendProgram: values[27] || "",
      };
      transactions.push(transaction);
    }
  }

  return transactions;
}

function parseCsvLine(line: string): string[] {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        // Handle escaped quotes
        current += '"';
        i++; // Skip the next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

export const getMergedTransactions = query({
  args: { monthKey: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    const monthData = await ctx.db
      .query("months")
      .withIndex("by_user_and_month", (q) =>
        q.eq("userId", userId).eq("monthKey", args.monthKey),
      )
      .unique();

    if (!monthData) {
      return [];
    }

    // Create a map of transaction bindings
    const bindingMap = new Map<string, string | null>();
    for (const binding of monthData.transactionInvoiceBindings || []) {
      bindingMap.set(binding.transactionId, binding.invoiceStorageId);
    }

    // Collect all transactions from CSV statements (newer uploads overwrite older)
    const transactionMap = new Map<string, any>();

    for (const statement of monthData.statements) {
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

    // Add isRefunded flag to transactions that were later refunded
    const transactionsWithRefundStatus = addRefundStatus(allTransactions);

    // Sort by date (most recent first)
    const sortedTransactions = transactionsWithRefundStatus.sort((a, b) => {
      const dateA = new Date(a.dateCompleted || a.dateStarted);
      const dateB = new Date(b.dateCompleted || b.dateStarted);
      return dateB.getTime() - dateA.getTime();
    });

    // Get user settings for manual transactions
    const userSettings = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    // Parse and append manual transactions
    if (userSettings?.manualTransactions) {
      const manualTransactions = parseManualTransactions(
        userSettings.manualTransactions,
        bindingMap,
      );
      sortedTransactions.push(...manualTransactions);
    }

    return sortedTransactions;
  },
});

function parseManualTransactions(
  text: string,
  bindingMap: Map<string, string | null>,
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

export const deleteAllStatements = mutation({
  args: {
    monthKey: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const monthData = await ctx.db
      .query("months")
      .withIndex("by_user_and_month", (q) =>
        q.eq("userId", userId).eq("monthKey", args.monthKey),
      )
      .unique();

    if (!monthData) {
      return;
    }

    // Delete all statement files from storage
    for (const statement of monthData.statements) {
      await safeDeleteStorage(ctx, statement.storageId);
    }

    // Clear statements array and transaction bindings
    await ctx.db.patch(monthData._id, {
      statements: [],
      transactionInvoiceBindings: [],
    });
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

    const monthData = await ctx.db
      .query("months")
      .withIndex("by_user_and_month", (q) =>
        q.eq("userId", userId).eq("monthKey", args.monthKey),
      )
      .unique();

    if (!monthData) {
      return;
    }

    // Delete all invoice files from storage
    for (const invoice of monthData.incomingInvoices) {
      await safeDeleteStorage(ctx, invoice.storageId);
    }

    // Clear incoming invoices array
    await ctx.db.patch(monthData._id, {
      incomingInvoices: [],
    });
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

    const monthData = await ctx.db
      .query("months")
      .withIndex("by_user_and_month", (q) =>
        q.eq("userId", userId).eq("monthKey", args.monthKey),
      )
      .unique();

    if (!monthData) {
      throw new Error("Month data not found");
    }

    const existingBindings = monthData.transactionInvoiceBindings || [];
    const updatedBindings = existingBindings.filter(
      (binding) => binding.transactionId !== args.transactionId,
    );

    // Add new binding if invoiceStorageId is not null (includes "NOT_NEEDED")
    if (args.invoiceStorageId) {
      updatedBindings.push({
        transactionId: args.transactionId,
        invoiceStorageId: args.invoiceStorageId,
        boundAt: Date.now(),
      });
    }

    await ctx.db.patch(monthData._id, {
      transactionInvoiceBindings: updatedBindings,
    });
  },
});
