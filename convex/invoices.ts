import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";

const analysisResult = v.object({
  value: v.union(v.string(), v.null()),
  error: v.union(v.string(), v.null()),
  lastUpdated: v.union(v.number(), v.null()),
});

// Helper function to get filename without extension
function getFileNameWithoutExtension(fileName: string): string {
  const lastDotIndex = fileName.lastIndexOf('.');
  if (lastDotIndex === -1) {
    return fileName;
  }
  return fileName.substring(0, lastDotIndex);
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
        q.eq("userId", userId).eq("monthKey", args.monthKey)
      )
      .unique();

    if (!monthData) {
      return {
        monthKey: args.monthKey,
        incomingInvoices: [],
        statements: [],
      };
    }

    const incomingInvoicesWithUrls = await Promise.all(
      monthData.incomingInvoices.map(async (invoice) => ({
        ...invoice,
        url: await ctx.storage.getUrl(invoice.storageId),
      }))
    );

    const statementsWithUrls = await Promise.all(
      monthData.statements.map(async (statement) => ({
        ...statement,
        url: await ctx.storage.getUrl(statement.storageId),
      }))
    );

    // Sort invoices by uploadedAt in descending order (latest first)
    const sortedInvoices = incomingInvoicesWithUrls.sort(
      (a, b) => b.uploadedAt - a.uploadedAt
    );

    return {
      monthKey: args.monthKey,
      incomingInvoices: sortedInvoices,
      statements: statementsWithUrls,
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

    const existing = await ctx.db
      .query("months")
      .withIndex("by_user_and_month", (q) =>
        q.eq("userId", userId).eq("monthKey", args.monthKey)
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
        analysisBigError: null,
      },
      parsing: {},
    };

    if (existing) {
      await ctx.db.patch(existing._id, {
        incomingInvoices: [...existing.incomingInvoices, newInvoice],
      });
    } else {
      await ctx.db.insert("months", {
        userId,
        monthKey: args.monthKey,
        incomingInvoices: [newInvoice],
        statements: [],
      });
    }

    // Trigger background analysis (includes parsing)
    await ctx.scheduler.runAfter(0, internal.invoiceAnalysis.analyzeInvoice, {
      monthKey: args.monthKey,
      storageId: args.storageId,
      userId,
    });
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

    const existing = await ctx.db
      .query("months")
      .withIndex("by_user_and_month", (q) =>
        q.eq("userId", userId).eq("monthKey", args.monthKey)
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
        userId,
        monthKey: args.monthKey,
        incomingInvoices: [],
        statements: [newStatement],
      });
    }
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
        q.eq("userId", userId).eq("monthKey", args.monthKey)
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        incomingInvoices: existing.incomingInvoices.filter(
          (inv) => inv.storageId !== args.storageId
        ),
      });
      await ctx.storage.delete(args.storageId);
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
        q.eq("userId", userId).eq("monthKey", args.monthKey)
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        statements: existing.statements.filter(
          (stmt) => stmt.storageId !== args.storageId
        ),
      });
      await ctx.storage.delete(args.storageId);
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
    analysisBigError: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    const monthData = await ctx.db
      .query("months")
      .withIndex("by_user_and_month", (q) =>
        q.eq("userId", args.userId).eq("monthKey", args.monthKey)
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
        q.eq("userId", args.userId).eq("monthKey", args.monthKey)
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
        q.eq("userId", args.userId).eq("monthKey", args.monthKey)
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
        q.eq("userId", args.userId).eq("monthKey", args.monthKey)
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
        q.eq("userId", args.userId).eq("monthKey", args.monthKey)
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
  const lines = csvText.split('\n').filter(line => line.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim());
  const transactions = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    // Simple CSV parsing - split by comma and handle quoted fields
    const values = parseCsvLine(line);
    
    if (values.length >= headers.length) {
      const transaction = {
        id: values[2] || '', // ID column
        dateStarted: values[0] || '',
        dateCompleted: values[1] || '',
        type: values[3] || '',
        state: values[4] || '',
        description: values[5] || '',
        reference: values[6] || '',
        payer: values[7] || '',
        cardNumber: values[8] || '',
        cardLabel: values[9] || '',
        cardState: values[10] || '',
        origCurrency: values[11] || '',
        origAmount: values[12] || '',
        paymentCurrency: values[13] || '',
        amount: values[14] || '',
        totalAmount: values[15] || '',
        exchangeRate: values[16] || '',
        fee: values[17] || '',
        feeCurrency: values[18] || '',
        balance: values[19] || '',
        account: values[20] || '',
        beneficiaryAccountNumber: values[21] || '',
        beneficiarySortCode: values[22] || '',
        beneficiaryIban: values[23] || '',
        beneficiaryBic: values[24] || '',
        mcc: values[25] || '',
        relatedTransactionId: values[26] || '',
        spendProgram: values[27] || '',
      };
      transactions.push(transaction);
    }
  }

  return transactions;
}

function parseCsvLine(line: string): string[] {
  const result = [];
  let current = '';
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
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
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
        q.eq("userId", userId).eq("monthKey", args.monthKey)
      )
      .unique();

    if (!monthData) {
      return [];
    }

    // Collect all transactions from CSV statements
    const allTransactions = [];
    const seenIds = new Set<string>();

    for (const statement of monthData.statements) {
      if (statement.fileType === "csv" && statement.transactions) {
        for (const transaction of statement.transactions) {
          // Only add unique transactions based on ID
          if (transaction.id && !seenIds.has(transaction.id)) {
            seenIds.add(transaction.id);
            allTransactions.push({
              ...transaction,
              sourceFile: statement.fileName,
            });
          }
        }
      }
    }

    // Sort by date (most recent first)
    return allTransactions.sort((a, b) => {
      const dateA = new Date(a.dateCompleted || a.dateStarted);
      const dateB = new Date(b.dateCompleted || b.dateStarted);
      return dateB.getTime() - dateA.getTime();
    });
  },
});

