import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import {
  computeApiKeyHash,
  generateApiKey,
  getApiKeyPrefix,
} from "./apiKeyUtils";

async function requireAuthenticatedUserWithEmail(ctx: any) {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new Error("Not authenticated");
  }

  const user = await ctx.db.get(userId);
  const email = user && typeof user.email === "string" ? user.email.trim() : "";
  if (!email) {
    throw new Error("API keys are available only for email accounts");
  }

  return userId;
}

function normalizeLabel(label?: string) {
  const normalized = label?.trim();
  if (!normalized) {
    return "Headless Upload";
  }
  return normalized.slice(0, 80);
}

export const listApiKeys = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    const apiKeys = await ctx.db
      .query("apiKeys")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    return apiKeys
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((apiKey) => ({
        _id: apiKey._id,
        label: apiKey.label,
        keyPrefix: apiKey.keyPrefix,
        scopes: apiKey.scopes,
        createdAt: apiKey.createdAt,
        lastUsedAt: apiKey.lastUsedAt ?? null,
        revokedAt: apiKey.revokedAt ?? null,
      }));
  },
});

export const createApiKey = mutation({
  args: {
    label: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthenticatedUserWithEmail(ctx);

    const rawKey = generateApiKey();
    const keyHash = await computeApiKeyHash(rawKey);

    const existingKey = await ctx.db
      .query("apiKeys")
      .withIndex("by_hash", (q) => q.eq("keyHash", keyHash))
      .first();
    if (existingKey) {
      throw new Error("Failed to generate unique API key. Please retry.");
    }

    const label = normalizeLabel(args.label);
    const createdAt = Date.now();

    await ctx.db.insert("apiKeys", {
      userId,
      label,
      keyHash,
      keyPrefix: getApiKeyPrefix(rawKey),
      scopes: ["upload:write"],
      createdAt,
    });

    return {
      key: rawKey,
      keyPrefix: getApiKeyPrefix(rawKey),
      label,
      createdAt,
    };
  },
});

export const revokeApiKey = mutation({
  args: {
    apiKeyId: v.id("apiKeys"),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthenticatedUserWithEmail(ctx);

    const apiKey = await ctx.db.get(args.apiKeyId);
    if (!apiKey || apiKey.userId !== userId) {
      throw new Error("API key not found");
    }

    if (apiKey.revokedAt) {
      return;
    }

    await ctx.db.patch(args.apiKeyId, {
      revokedAt: Date.now(),
    });
  },
});

export const getApiKeyByHashInternal = internalQuery({
  args: {
    keyHash: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("apiKeys")
      .withIndex("by_hash", (q) => q.eq("keyHash", args.keyHash))
      .first();
  },
});

export const touchApiKeyUsageInternal = internalMutation({
  args: {
    apiKeyId: v.id("apiKeys"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.apiKeyId, {
      lastUsedAt: Date.now(),
    });
  },
});
