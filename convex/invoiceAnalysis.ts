"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";

export const analyzeInvoice = internalAction({
  args: {
    monthKey: v.string(),
    storageId: v.id("_storage"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const pdfUrl = await ctx.storage.getUrl(args.storageId);
    if (!pdfUrl) {
      console.error("📄 PDF not found in storage");
      return;
    }

    const response = await fetch(pdfUrl);
    const pdfBlob = await response.blob();
    const pdfBuffer = await pdfBlob.arrayBuffer();

    const [dateResult, senderResult] = await Promise.all([
      extractInvoiceDate(pdfBuffer),
      extractInvoiceSender(pdfBuffer),
    ]);

    await ctx.runMutation(internal.invoices.updateInvoiceAnalysis, {
      monthKey: args.monthKey,
      storageId: args.storageId,
      userId: args.userId,
      date: dateResult,
      sender: senderResult,
    });
  },
});

async function extractInvoiceDate(
  pdfBuffer: ArrayBuffer
): Promise<string | null> {
  try {
    const result = await generateText({
      model: anthropic("claude-3-5-sonnet-20241022"),
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract the invoice issue date from this PDF. Return ONLY the date in YYYY-MM-DD format, or 'null' if no date is found. Do not include any other text.",
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
    return content === "null" ? null : content || null;
  } catch (error) {
    console.error("📅 Error extracting invoice date:", error);
    return null;
  }
}

async function extractInvoiceSender(
  pdfBuffer: ArrayBuffer
): Promise<string | null> {
  try {
    const result = await generateText({
      model: anthropic("claude-3-5-sonnet-20241022"),
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract the sender/vendor name from this invoice PDF. Return ONLY the company or person name, or 'null' if not found. Do not include any other text.",
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
    return content === "null" ? null : content || null;
  } catch (error) {
    console.error("🏢 Error extracting invoice sender:", error);
    return null;
  }
}
