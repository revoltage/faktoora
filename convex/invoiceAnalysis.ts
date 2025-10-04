"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import { groq } from "@ai-sdk/groq";
import { google } from "@ai-sdk/google";

export const analyzeInvoice = internalAction({
  args: {
    monthKey: v.string(),
    storageId: v.id("_storage"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    try {
      const pdfUrl = await ctx.storage.getUrl(args.storageId);
      if (!pdfUrl) {
        throw new Error("📄 PDF not found in storage");
      }

      const response = await fetch(pdfUrl);
      const pdfBlob = await response.blob();
      const pdfBuffer = await pdfBlob.arrayBuffer();

      // Start all extractions in parallel but handle each individually
      const datePromise = extractInvoiceDate(pdfBuffer).then(
        async (dateResult) => {
          await ctx.runMutation(internal.invoices.updateInvoiceDate, {
            monthKey: args.monthKey,
            storageId: args.storageId,
            userId: args.userId,
            date: dateResult,
          });
          return dateResult;
        }
      );

      const senderPromise = extractInvoiceSender(pdfBuffer).then(
        async (senderResult) => {
          await ctx.runMutation(internal.invoices.updateInvoiceSender, {
            monthKey: args.monthKey,
            storageId: args.storageId,
            userId: args.userId,
            sender: senderResult,
          });
          return senderResult;
        }
      );

      const parsedTextPromise = extractTextFromPDF(pdfBuffer).then(
        async (parsedTextResult) => {
          await ctx.runMutation(internal.invoices.updateInvoiceParsedText, {
            monthKey: args.monthKey,
            storageId: args.storageId,
            userId: args.userId,
            parsedText: parsedTextResult,
          });
          return parsedTextResult;
        }
      );

      const amountPromise = extractInvoiceAmount(pdfBuffer).then(
        async (amountResult) => {
          await ctx.runMutation(internal.invoices.updateInvoiceAmount, {
            monthKey: args.monthKey,
            storageId: args.storageId,
            userId: args.userId,
            amount: amountResult,
          });
          return amountResult;
        }
      );

      // Wait for all to complete (for error handling)
      await Promise.all([datePromise, senderPromise, parsedTextPromise, amountPromise]);
    } catch (error) {
      console.error("🔍 Error in invoice analysis (big error):", error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      await ctx.runMutation(internal.invoices.updateInvoiceAnalysisBigError, {
        monthKey: args.monthKey,
        storageId: args.storageId,
        userId: args.userId,
        analysisBigError: errorMessage,
      });
    }
  },
});

const _CLAUDE = anthropic("claude-sonnet-4-5");
const _OPENAI = openai("gpt-5-mini");
const _KIMI = groq("moonshotai/kimi-k2-instruct-0905");
const _GPTOSS = groq("openai/gpt-oss-120b");
const _LLAMA3 = groq("meta-llama/llama-4-maverick-17b-128e-instruct");
const _GEMINI = google("gemini-2.5-flash");

async function askLLM(
  prompt: string,
  pdfBuffer: ArrayBuffer
): Promise<{
  value: string | null;
  error: string | null;
  lastUpdated: number;
}> {
  const now = Date.now();
  try {
    const result = await generateText({
      model: _GEMINI,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: prompt,
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
    return {
      value: content === "null" || !content ? null : content,
      error: null,
      lastUpdated: now,
    };
  } catch (error) {
    console.error("🤖 Error calling LLM:", error);
    return {
      value: null,
      error: error instanceof Error ? error.message : String(error),
      lastUpdated: now,
    };
  }
}

async function extractInvoiceDate(
  pdfBuffer: ArrayBuffer
): Promise<{
  value: string | null;
  error: string | null;
  lastUpdated: number;
}> {
  return await askLLM(
    "Extract the invoice issue date from this PDF. Return ONLY the date in YYYY-MM-DD format, or 'null' if no date is found. Do not include any other text.",
    pdfBuffer
  );
}

async function extractInvoiceSender(
  pdfBuffer: ArrayBuffer
): Promise<{
  value: string | null;
  error: string | null;
  lastUpdated: number;
}> {
  return await askLLM(
    "Extract the sender/vendor name from this invoice PDF. Return ONLY the company or person name, or 'null' if not found. Do not include any other text.",
    pdfBuffer
  );
}

async function extractTextFromPDF(
  pdfBuffer: ArrayBuffer
): Promise<{
  value: string | null;
  error: string | null;
  lastUpdated: number;
}> {
  return await askLLM(
    "Extract all text content from this PDF document. Return the complete text as plain markdown, preserving line breaks and structure. If the document contains no readable text, return 'null'.",
    pdfBuffer
  );
}

async function extractInvoiceAmount(
  pdfBuffer: ArrayBuffer
): Promise<{
  value: string | null;
  error: string | null;
  lastUpdated: number;
}> {
  return await askLLM(
    "Extract the total invoice amount and currency from this PDF. Return ONLY the amount and currency in the format 'amount|currency' (e.g., '50.80|BGN', '10000|USD', '4.51|EUR'). If no amount is found, return 'null'. Do not include any other text.",
    pdfBuffer
  );
}
