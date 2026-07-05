import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const manualTransactionIdValidator = v.id("manualTransactions");

const manualTransactionInputValidator = v.object({
  id: v.optional(manualTransactionIdValidator),
  monthKey: v.optional(v.string()),
  name: v.string(),
  amount: v.string(),
  currency: v.optional(v.string()),
  recurring: v.boolean(),
});

export const listManualTransactions = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    const rows = await ctx.db
      .query("manualTransactions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    return rows.sort((a, b) => {
      if (a.recurring !== b.recurring) {
        return a.recurring ? -1 : 1;
      }
      return a.createdAt - b.createdAt;
    });
  },
});

export const replaceManualTransactions = mutation({
  args: {
    transactions: v.array(manualTransactionInputValidator),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const existingRows = await ctx.db
      .query("manualTransactions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const existingById = new Map(existingRows.map((row) => [row._id, row]));
    const retainedIds = new Set<string>();
    const now = Date.now();

    for (const transaction of args.transactions) {
      const name = transaction.name.trim();
      const amount = transaction.amount.trim();
      const currency = transaction.currency?.trim().toUpperCase();
      const monthKey = transaction.recurring
        ? undefined
        : transaction.monthKey?.trim();

      if (!name) {
        continue;
      }

      if (transaction.id && existingById.has(transaction.id)) {
        retainedIds.add(transaction.id);
        await ctx.db.patch(transaction.id, {
          monthKey: monthKey || undefined,
          name,
          amount,
          currency: currency || undefined,
          recurring: transaction.recurring,
          updatedAt: now,
        });
      } else {
        const id = await ctx.db.insert("manualTransactions", {
          userId,
          monthKey: monthKey || undefined,
          name,
          amount,
          currency: currency || undefined,
          recurring: transaction.recurring,
          createdAt: now,
          updatedAt: now,
        });
        retainedIds.add(id);
      }
    }

    for (const row of existingRows) {
      if (!retainedIds.has(row._id)) {
        await ctx.db.delete(row._id);
      }
    }
  },
});
