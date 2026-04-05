import { v } from "convex/values";
import {
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
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
    const uploadedAt = Date.now();
    const invoiceId = generateInvoiceId();

    await ctx.db.insert("incomingInvoices", {
      userId: args.userId,
      monthKey: args.monthKey,
      legacyKey: buildScopedLegacyKey({
        kind: "invoice",
        userId: args.userId,
        monthKey: args.monthKey,
        legacyKey: buildInvoiceLegacyKey({
          invoiceId,
          storageId: args.storageId,
          uploadedAt,
        }),
      }),
      invoiceId,
      storageId: args.storageId,
      fileName: args.fileName,
      name: getFileNameWithoutExtension(args.fileName),
      uploadedAt,
      analysis: createEmptyAnalysis(),
      parsing: createEmptyParsing(),
    });
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
    const uploadedAt = Date.now();

    await ctx.db.insert("statements", {
      userId: args.userId,
      monthKey: args.monthKey,
      legacyKey: buildScopedLegacyKey({
        kind: "statement",
        userId: args.userId,
        monthKey: args.monthKey,
        legacyKey: buildStatementLegacyKey({
          storageId: args.storageId,
          uploadedAt,
        }),
      }),
      statementId: generateStatementId(),
      storageId: args.storageId,
      fileName: args.fileName,
      fileType: "csv",
      uploadedAt,
      transactions: args.csvContent
        ? parseCsvTransactions(args.csvContent)
        : undefined,
    });
  },
});

export const seedMockData = internalAction({
  args: {
    files: v.array(
      v.object({
        name: v.string(),
        base64: v.string(),
        type: v.union(v.literal("invoice"), v.literal("statement")),
      }),
    ),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ monthKey: string; count: number; userId: Id<"users"> }> => {
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
