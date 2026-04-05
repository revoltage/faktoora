import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { analysisResultValidator } from "./monthData";
import { patchNormalizedInvoicesByStorageId } from "./normalizedMonthStore";

export const updateInvoiceParsing = internalMutation({
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
        parsing: {
          ...invoice.parsing,
          parsedText: args.parsedText,
        },
      }),
    );
  },
});
