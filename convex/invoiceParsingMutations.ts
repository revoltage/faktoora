import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

const analysisResult = v.object({
  value: v.union(v.string(), v.null()),
  error: v.union(v.string(), v.null()),
  lastUpdated: v.union(v.number(), v.null()),
});

export const updateInvoiceParsing = internalMutation({
  args: {
    monthKey: v.string(),
    storageId: v.id("_storage"),
    userId: v.id("users"),
    parsedText: v.optional(analysisResult),
    parsedTables: v.optional(analysisResult),
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
        const existingParsing = invoice.parsing ?? {
          parsedText: {
            value: null,
            error: null,
            lastUpdated: null,
          },
          parsedTables: {
            value: null,
            error: null,
            lastUpdated: null,
          },
        };

        const updatedParsing = { ...existingParsing };

        if (args.parsedText) {
          updatedParsing.parsedText = args.parsedText;
        }

        if (args.parsedTables) {
          updatedParsing.parsedTables = args.parsedTables;
        }

        return {
          ...invoice,
          parsing: {
            ...updatedParsing,
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
