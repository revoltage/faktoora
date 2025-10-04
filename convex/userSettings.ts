import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";

export const getUserSettings = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    const settings = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    return settings;
  },
});

export const updateUserSettings = mutation({
  args: {
    vatId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const existingSettings = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (existingSettings) {
      await ctx.db.patch(existingSettings._id, {
        vatId: args.vatId,
        updatedAt: Date.now(),
      });
      return existingSettings._id;
    } else {
      return await ctx.db.insert("userSettings", {
        userId,
        vatId: args.vatId,
        updatedAt: Date.now(),
      });
    }
  },
});
