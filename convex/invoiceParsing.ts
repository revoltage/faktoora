"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { parsePdfFromBuffer, parsePdfTablesFromBuffer } from "./lib/pdfParser";

export const parseInvoice = internalAction({
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
      console.log("🚫 Invoice parsing feature is disabled, setting parsing to disabled state");
      
      // Set parsing field to show disabled state
      const disabledParsingResult = {
        value: null,
        error: "Classic parsing disabled",
        lastUpdated: Date.now(),
      };

      await ctx.runMutation(internal.invoiceParsingMutations.updateInvoiceParsing, {
        monthKey: args.monthKey,
        storageId: args.storageId,
        userId: args.userId,
        parsedText: disabledParsingResult,
        parsedTables: disabledParsingResult,
      });

      return;
    }

    console.log("📄 Starting classic PDF parsing for invoice:", args.storageId);

    // Get the file from storage
    const fileBlob = await ctx.storage.get(args.storageId);
    if (!fileBlob) {
      const errorMessage = "File not found in storage";

      await ctx.runMutation(internal.invoiceParsingMutations.updateInvoiceParsing, {
        monthKey: args.monthKey,
        storageId: args.storageId,
        userId: args.userId,
        parsedText: {
          value: null,
          error: errorMessage,
          lastUpdated: Date.now(),
        },
        parsedTables: {
          value: null,
          error: errorMessage,
          lastUpdated: Date.now(),
        },
      });

      return;
    }

    const arrayBuffer = await fileBlob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const parsedTextPromise = parsePdfFromBuffer(buffer)
      .then(async (result) => {
        const now = Date.now();

        const payload = result.success
          ? {
              value: result.text,
              error: null,
              lastUpdated: now,
            }
          : {
              value: null,
              error: result.error || "Unknown parsing error",
              lastUpdated: now,
            };

        if (result.success) {
          console.log("✅ PDF text parsing completed successfully");
        } else {
          console.log("❌ PDF text parsing failed:", result.error);
        }

        await ctx.runMutation(
          internal.invoiceParsingMutations.updateInvoiceParsing,
          {
            monthKey: args.monthKey,
            storageId: args.storageId,
            userId: args.userId,
            parsedText: payload,
          }
        );

        return payload;
      })
      .catch(async (error) => {
        const now = Date.now();
        const message =
          error instanceof Error ? error.message : "Unknown parsing error";

        console.log("❌ PDF text parsing threw:", error);

        const payload = {
          value: null,
          error: message,
          lastUpdated: now,
        } as const;

        await ctx.runMutation(
          internal.invoiceParsingMutations.updateInvoiceParsing,
          {
            monthKey: args.monthKey,
            storageId: args.storageId,
            userId: args.userId,
            parsedText: payload,
          }
        );

        return payload;
      });

    const parsedTablesPromise = parsePdfTablesFromBuffer(buffer)
      .then(async (result) => {
        const now = Date.now();

        const payload = result.success
          ? {
              value: result.tablesJson,
              error: null,
              lastUpdated: now,
            }
          : {
              value: null,
              error: result.error || "Unknown table parsing error",
              lastUpdated: now,
            };

        if (result.success) {
          console.log("✅ PDF table parsing completed successfully");
        } else {
          console.log("❌ PDF table parsing failed:", result.error);
        }

        await ctx.runMutation(
          internal.invoiceParsingMutations.updateInvoiceParsing,
          {
            monthKey: args.monthKey,
            storageId: args.storageId,
            userId: args.userId,
            parsedTables: payload,
          }
        );

        return payload;
      })
      .catch(async (error) => {
        const now = Date.now();
        const message =
          error instanceof Error
            ? error.message
            : "Unknown table parsing error";

        console.log("❌ PDF table parsing threw:", error);

        const payload = {
          value: null,
          error: message,
          lastUpdated: now,
        } as const;

        await ctx.runMutation(
          internal.invoiceParsingMutations.updateInvoiceParsing,
          {
            monthKey: args.monthKey,
            storageId: args.storageId,
            userId: args.userId,
            parsedTables: payload,
          }
        );

        return payload;
      });

    await Promise.all([parsedTextPromise, parsedTablesPromise]);
  },
});
