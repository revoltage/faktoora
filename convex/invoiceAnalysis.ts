"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import { groq } from "@ai-sdk/groq";
import { google } from "@ai-sdk/google";
import { FEATURE_FLAGS } from "./featureFlags";

export const analyzeInvoice = internalAction({
  args: {
    monthKey: v.string(),
    storageId: v.id("_storage"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    try {
      // Check if invoice analysis feature flag is enabled
      const isInvoiceAnalysisEnabled = await ctx.runQuery(
        internal.featureFlags.getFeatureFlagInternal,
        { flagName: FEATURE_FLAGS.invoiceAnalysis }
      );

      if (!isInvoiceAnalysisEnabled) {
        console.log(
          "🚫 Invoice analysis feature flag is disabled, setting analysis to disabled state"
        );

        // Set all analysis fields to show disabled state
        const disabledAnalysisResult = {
          value: null,
          error: "Analysis disabled",
          lastUpdated: Date.now(),
        };

        await ctx.runMutation(internal.invoices.updateInvoiceAnalysis, {
          monthKey: args.monthKey,
          storageId: args.storageId,
          userId: args.userId,
          date: disabledAnalysisResult,
          sender: disabledAnalysisResult,
          parsedText: disabledAnalysisResult,
          amount: disabledAnalysisResult,
          analysisBigError: "Feature flag disabled",
        });

        return;
      }

      const fileUrl = await ctx.storage.getUrl(args.storageId);
      if (!fileUrl) {
        throw new Error("📄 File not found in storage");
      }

      // Get user's AI model preference
      const userSettings = await ctx.runQuery(
        internal.userSettings.getUserSettingsInternal,
        {
          userId: args.userId,
        }
      );
      const modelKey =
        (userSettings?.aiModel as keyof typeof AI_MODELS) || "gemini";
      console.log(`🤖 Using AI model: ${modelKey} for user ${args.userId}`);

      const response = await fetch(fileUrl);
      const fileBlob = await response.blob();
      const fileBuffer = await fileBlob.arrayBuffer();
      
      const fileType = detectFileType(fileBuffer);
      console.log(`📎 Detected file type: ${fileType}`);

      // Start all extractions in parallel but handle each individually
      const datePromise = extractInvoiceDate(fileBuffer, modelKey).then(
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

      const senderPromise = extractInvoiceSender(fileBuffer, modelKey).then(
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

      const parsedTextPromise = extractTextFromPDF(fileBuffer, modelKey).then(
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

      const amountPromise = extractInvoiceAmount(fileBuffer, modelKey).then(
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
      await Promise.all([
        datePromise,
        senderPromise,
        parsedTextPromise,
        amountPromise,
      ]);
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

const AI_MODELS = {
  claude: anthropic("claude-sonnet-4-5"),
  openai: openai("gpt-5-mini"),
  kimi: groq("moonshotai/kimi-k2-instruct-0905"),
  gptoss: groq("openai/gpt-oss-120b"),
  llama3: groq("meta-llama/llama-4-maverick-17b-128e-instruct"),
  gemini: google("gemini-2.5-flash"),
} as const;

function detectFileType(buffer: ArrayBuffer): string {
  const arr = new Uint8Array(buffer).subarray(0, 12);
  
  // PDF: %PDF
  if (arr[0] === 0x25 && arr[1] === 0x50 && arr[2] === 0x44 && arr[3] === 0x46) {
    return "application/pdf";
  }
  
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (arr[0] === 0x89 && arr[1] === 0x50 && arr[2] === 0x4E && arr[3] === 0x47) {
    return "image/png";
  }
  
  // JPEG: FF D8 FF
  if (arr[0] === 0xFF && arr[1] === 0xD8 && arr[2] === 0xFF) {
    return "image/jpeg";
  }
  
  // WEBP: RIFF ... WEBP
  if (
    arr[0] === 0x52 && arr[1] === 0x49 && arr[2] === 0x46 && arr[3] === 0x46 &&
    arr[8] === 0x57 && arr[9] === 0x45 && arr[10] === 0x42 && arr[11] === 0x50
  ) {
    return "image/webp";
  }
  
  // Default to PDF if unknown
  return "application/pdf";
}

async function askLLM(
  prompt: string,
  fileBuffer: ArrayBuffer,
  modelKey: keyof typeof AI_MODELS = "gemini"
): Promise<{
  value: string | null;
  error: string | null;
  lastUpdated: number;
}> {
  const now = Date.now();
  try {
    const mediaType = detectFileType(fileBuffer);
    
    const result = await generateText({
      model: AI_MODELS[modelKey],
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
              data: Buffer.from(fileBuffer),
              mediaType,
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
  fileBuffer: ArrayBuffer,
  modelKey: keyof typeof AI_MODELS = "gemini"
): Promise<{
  value: string | null;
  error: string | null;
  lastUpdated: number;
}> {
  return await askLLM(
    "Extract the invoice issue date from this document. Return ONLY the date in YYYY-MM-DD format, or 'null' if no date is found. Do not include any other text.",
    fileBuffer,
    modelKey
  );
}

async function extractInvoiceSender(
  fileBuffer: ArrayBuffer,
  modelKey: keyof typeof AI_MODELS = "gemini"
): Promise<{
  value: string | null;
  error: string | null;
  lastUpdated: number;
}> {
  return await askLLM(
    "Extract the sender/vendor name from this invoice document. Return ONLY the company or person name, or 'null' if not found. Do not include any other text.",
    fileBuffer,
    modelKey
  );
}

async function extractTextFromPDF(
  fileBuffer: ArrayBuffer,
  modelKey: keyof typeof AI_MODELS = "gemini"
): Promise<{
  value: string | null;
  error: string | null;
  lastUpdated: number;
}> {
  return await askLLM(
    "Extract all text content from this document. Return the complete text as plain markdown, preserving line breaks and structure. If the document contains no readable text, return 'null'.",
    fileBuffer,
    modelKey
  );
}

async function extractInvoiceAmount(
  fileBuffer: ArrayBuffer,
  modelKey: keyof typeof AI_MODELS = "gemini"
): Promise<{
  value: string | null;
  error: string | null;
  lastUpdated: number;
}> {
  return await askLLM(
    "Extract the total invoice amount and currency from this document. Return ONLY the amount and currency in the format 'amount|currency' (e.g., '50.80|BGN', '10000|USD', '4.51|EUR'). If no amount is found, return 'null'. Do not include any other text.",
    fileBuffer,
    modelKey
  );
}
