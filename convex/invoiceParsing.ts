import { v } from "convex/values";
import { action, internalMutation } from "./_generated/server";
import { getFeatureFlagInternal } from "./featureFlags";
import { internal } from "./_generated/api";

const analysisResult = v.object({
  value: v.union(v.string(), v.null()),
  error: v.union(v.string(), v.null()),
  lastUpdated: v.union(v.number(), v.null()),
});

export const parseInvoice = action({
  args: {
    monthKey: v.string(),
    storageId: v.id("_storage"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Check if invoice parsing feature flag is enabled
    const isEnabled = await ctx.runQuery(internal.featureFlags.getFeatureFlagInternal, {
      flagName: "invoiceParsing",
    });

    if (!isEnabled) {
      console.log("🚫 Invoice parsing feature is disabled");
      return;
    }

    // TODO: Implement classic parsing logic
    throw new Error("Invoice parsing not implemented yet");
  },
});

export const updateInvoiceParsing = internalMutation({
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
          parsing: {
            ...invoice.parsing,
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