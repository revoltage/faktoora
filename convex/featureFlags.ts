import { v } from "convex/values";
import { query, mutation, internalQuery } from "./_generated/server";

export const FEATURE_FLAGS = {
  invoiceAnalysis: "invoiceAnalysis",
  invoiceParsing: "invoiceParsing",
} as const;

export const getFeatureFlag = query({
  args: { flagName: v.string() },
  handler: async (ctx, args) => {
    const flag = await ctx.db
      .query("featureFlags")
      .withIndex("by_flag_name", (q) => q.eq("flagName", args.flagName))
      .unique();
    
    // Return default value if flag doesn't exist
    if (!flag) {
      // Default flags with their default values
      const defaultFlags: Record<string, boolean> = {
        invoiceAnalysis: true,
      };
      return defaultFlags[args.flagName] ?? false;
    }
    
    return flag.enabled;
  },
});

export const getFeatureFlagInternal = internalQuery({
  args: { flagName: v.string() },
  handler: async (ctx, args) => {
    const flag = await ctx.db
      .query("featureFlags")
      .withIndex("by_flag_name", (q) => q.eq("flagName", args.flagName))
      .unique();
    
    // Return default value if flag doesn't exist
    if (!flag) {
      // Default flags with their default values
      const defaultFlags: Record<string, boolean> = {
        invoiceAnalysis: true,
      };
      return defaultFlags[args.flagName] ?? false;
    }
    
    return flag.enabled;
  },
});

export const setFeatureFlag = mutation({
  args: {
    flagName: v.string(),
    enabled: v.boolean(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("featureFlags")
      .withIndex("by_flag_name", (q) => q.eq("flagName", args.flagName))
      .unique();
    
    if (existing) {
      await ctx.db.patch(existing._id, {
        enabled: args.enabled,
        description: args.description,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("featureFlags", {
        flagName: args.flagName,
        enabled: args.enabled,
        description: args.description,
        updatedAt: Date.now(),
      });
    }
  },
});

export const getAllFeatureFlags = query({
  args: {},
  handler: async (ctx) => {
    const flags = await ctx.db.query("featureFlags").collect();
    
    // Add default flags that don't exist in the database
    const defaultFlags: Record<string, { enabled: boolean; description?: string }> = {
      invoiceAnalysis: { enabled: true, description: "Enable AI-powered invoice analysis" },
    };
    
    const flagMap = new Map<string, { enabled: boolean; description?: string }>();
    
    // Add existing flags
    for (const flag of flags) {
      flagMap.set(flag.flagName, {
        enabled: flag.enabled,
        description: flag.description,
      });
    }
    
    // Add default flags that don't exist
    for (const [name, config] of Object.entries(defaultFlags)) {
      if (!flagMap.has(name)) {
        flagMap.set(name, config);
      }
    }
    
    return Array.from(flagMap.entries()).map(([flagName, config]) => ({
      flagName,
      ...config,
    }));
  },
});
