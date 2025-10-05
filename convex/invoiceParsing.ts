"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { parsePdfFromBlob } from "./lib/pdfParser";

export const parseInvoice = internalAction({
  args: {
    monthKey: v.string(),
    storageId: v.id("_storage"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Check if invoice parsing feature flag is enabled
    const isEnabled = await ctx.runQuery(
      internal.featureFlags.getFeatureFlagInternal,
      {
        flagName: "invoiceParsing",
      }
    );

    if (!isEnabled) {
      console.log(
        "🚫 Invoice parsing feature is disabled, setting parsing to disabled state"
      );

      // Set parsing field to show disabled state
      const disabledParsingResult = {
        value: null,
        error: "Classic parsing disabled",
        lastUpdated: Date.now(),
      };

      await ctx.runMutation(
        internal.invoiceParsingMutations.updateInvoiceParsing,
        {
          monthKey: args.monthKey,
          storageId: args.storageId,
          userId: args.userId,
          parsedText: disabledParsingResult,
          pageImages: null,
        }
      );

      return;
    }

    try {
      console.log(
        "📄 Starting classic PDF parsing for invoice:",
        args.storageId
      );

      // Get the file from storage
      const fileBlob = await ctx.storage.get(args.storageId);
      if (!fileBlob) {
        throw new Error("File not found in storage");
      }

      // Parse PDF using utility function
      const result = await parsePdfFromBlob(fileBlob);

      if (result.success) {
        console.log("✅ PDF parsing completed successfully");

        // Save page images to storage if available
        let pageImages = null;
        if (result.pageImages && result.pageImages.length > 0) {
          console.log(
            `📸 Saving ${result.pageImages.length} page images to storage`
          );
          pageImages = [];

          for (const pageImage of result.pageImages) {
            const imageStorageId = await ctx.storage.store(
              new Blob([pageImage.data.buffer as ArrayBuffer], { type: "image/png" })
            );
            pageImages.push({
              pageNumber: pageImage.pageNumber,
              storageId: imageStorageId,
            });
          }

          console.log(`✅ Saved ${pageImages.length} page images to storage`);
        }

        // Update the database with the extracted text and images
        await ctx.runMutation(
          internal.invoiceParsingMutations.updateInvoiceParsing,
          {
            monthKey: args.monthKey,
            storageId: args.storageId,
            userId: args.userId,
            parsedText: {
              value: result.text,
              error: null,
              lastUpdated: Date.now(),
            },
            pageImages: pageImages || null,
          }
        );
      } else {
        console.log("❌ PDF parsing failed:", result.error);

        // Update the database with the error
        await ctx.runMutation(
          internal.invoiceParsingMutations.updateInvoiceParsing,
          {
            monthKey: args.monthKey,
            storageId: args.storageId,
            userId: args.userId,
            parsedText: {
              value: null,
              error: result.error || "Unknown parsing error",
              lastUpdated: Date.now(),
            },
            pageImages: null,
          }
        );
      }
    } catch (error) {
      console.log("❌ Invoice parsing failed:", error);

      // Update the database with the error
      await ctx.runMutation(
        internal.invoiceParsingMutations.updateInvoiceParsing,
        {
          monthKey: args.monthKey,
          storageId: args.storageId,
          userId: args.userId,
          parsedText: {
            value: null,
            error:
              error instanceof Error ? error.message : "Unknown parsing error",
            lastUpdated: Date.now(),
          },
          pageImages: null,
        }
      );
    }
  },
});
