import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";

// Convex-recommended seeding approach
export const seedFeatureFlags = internalMutation(async (ctx) => {
  console.log("🌱 Seeding feature flags...");
  
  // Check if already seeded to avoid duplicates
  const existingFlags = await ctx.db.query("featureFlags").collect();
  if (existingFlags.length > 0) {
    console.log("⏭️ Feature flags already seeded, skipping");
    return;
  }

  // Seed default feature flags
  await ctx.db.insert("featureFlags", {
    flagName: "invoiceAnalysis",
    enabled: false, // Start with OFF as requested
    description: "Enable AI-powered invoice analysis",
    updatedAt: Date.now(),
  });

  await ctx.db.insert("featureFlags", {
    flagName: "invoiceParsing", 
    enabled: false, // Start with OFF as requested
    description: "Enable invoice parsing functionality",
    updatedAt: Date.now(),
  });

  console.log("✅ Feature flags seeded successfully");
});

// --- Mock data seeding ---

export const getLastUser = internalQuery(async (ctx) => {
  const users = await ctx.db.query("users").collect();
  if (users.length === 0) throw new Error("No users found");
  // Return the most recently created user
  return users[users.length - 1]._id;
});

export const seedAddInvoice = internalMutation({
  args: {
    userId: v.id("users"),
    monthKey: v.string(),
    storageId: v.id("_storage"),
    fileName: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("months")
      .withIndex("by_user_and_month", (q) =>
        q.eq("userId", args.userId).eq("monthKey", args.monthKey)
      )
      .unique();

    const lastDotIndex = args.fileName.lastIndexOf(".");
    const name = lastDotIndex === -1 ? args.fileName : args.fileName.substring(0, lastDotIndex);

    const newInvoice = {
      storageId: args.storageId,
      fileName: args.fileName,
      name,
      uploadedAt: Date.now(),
      analysis: {
        date: { value: null, error: null, lastUpdated: null },
        sender: { value: null, error: null, lastUpdated: null },
        parsedText: { value: null, error: null, lastUpdated: null },
        amount: { value: null, error: null, lastUpdated: null },
        analysisBigError: null,
      },
      parsing: {
        parsedText: { value: null, error: null, lastUpdated: null },
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
  },
});

export const seedAddStatement = internalMutation({
  args: {
    userId: v.id("users"),
    monthKey: v.string(),
    storageId: v.id("_storage"),
    fileName: v.string(),
    csvContent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("months")
      .withIndex("by_user_and_month", (q) =>
        q.eq("userId", args.userId).eq("monthKey", args.monthKey)
      )
      .unique();

    let transactions = undefined;
    if (args.csvContent) {
      transactions = parseSeedCsvTransactions(args.csvContent);
    }

    const newStatement = {
      storageId: args.storageId,
      fileName: args.fileName,
      fileType: "csv" as const,
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
  },
});

function parseSeedCsvLine(line: string): string[] {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++;
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

function parseSeedCsvTransactions(csvText: string) {
  const lines = csvText.split("\n").filter((line) => line.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim());
  const transactions = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    const values = parseSeedCsvLine(line);

    if (values.length >= headers.length) {
      transactions.push({
        id: values[2] || "",
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
      });
    }
  }

  return transactions;
}

export const seedMockData = internalAction({
  args: {
    files: v.array(
      v.object({
        name: v.string(),
        base64: v.string(),
        type: v.union(v.literal("invoice"), v.literal("statement")),
      })
    ),
  },
  handler: async (ctx, args) => {
    const userId = await ctx.runQuery(internal.seed.getLastUser);
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    let count = 0;
    for (const file of args.files) {
      const bytes = Uint8Array.from(atob(file.base64), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes]);
      const storageId = await ctx.storage.store(blob);

      if (file.type === "invoice") {
        await ctx.runMutation(internal.seed.seedAddInvoice, {
          userId,
          monthKey,
          storageId,
          fileName: file.name,
        });
      } else {
        // For CSVs, decode content for transaction parsing
        const csvContent = new TextDecoder().decode(bytes);
        await ctx.runMutation(internal.seed.seedAddStatement, {
          userId,
          monthKey,
          storageId,
          fileName: file.name,
          csvContent,
        });
      }
      count++;
    }

    return { monthKey, count, userId };
  },
});
