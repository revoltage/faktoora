import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";

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

    return {
      monthKey: args.monthKey,
      incomingInvoices: incomingInvoicesWithUrls,
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
      uploadedAt: Date.now(),
      analysis: {
        date: null,
        sender: null,
      },
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

    // Trigger background analysis
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

    const newStatement = {
      storageId: args.storageId,
      fileName: args.fileName,
      fileType: args.fileType,
      uploadedAt: Date.now(),
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
    date: v.union(v.string(), v.null()),
    sender: v.union(v.string(), v.null()),
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
