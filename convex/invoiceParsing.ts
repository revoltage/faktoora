"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";

export const parseInvoiceText = internalAction({
  args: {
    monthKey: v.string(),
    storageId: v.id("_storage"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const pdfUrl = await ctx.storage.getUrl(args.storageId);
    if (!pdfUrl) {
      console.error("📄 PDF not found in storage for text parsing");
      return;
    }

    try {
      const response = await fetch(pdfUrl);
      const pdfBlob = await response.blob();
      const pdfBuffer = await pdfBlob.arrayBuffer();

      const parsedText = await extractTextFromPDF(pdfBuffer);

      await ctx.runMutation(internal.invoices.updateInvoiceParsing, {
        monthKey: args.monthKey,
        storageId: args.storageId,
        userId: args.userId,
        parsedText,
      });
    } catch (error) {
      console.error("📝 Error parsing invoice text:", error);
      // Still update with null to mark as attempted
      await ctx.runMutation(internal.invoices.updateInvoiceParsing, {
        monthKey: args.monthKey,
        storageId: args.storageId,
        userId: args.userId,
        parsedText: null,
      });
    }
  },
});

async function extractTextFromPDF(
  pdfBuffer: ArrayBuffer
): Promise<string | null> {
  try {
    const result = await generateText({
      model: anthropic("claude-sonnet-4-5"),
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract all text content from this PDF document. Return the complete text as plain markdown, preserving line breaks and structure. If the document contains no readable text, return 'null'.",
            },
            {
              type: "file",
              data: Buffer.from(pdfBuffer),
              mediaType: "application/pdf",
            },
          ],
        },
      ],
    });

    const content = result.text.trim();
    return content === "null" || !content ? null : content;
  } catch (error) {
    console.error("📄 Error extracting text from PDF:", error);
    return null;
  }
}
