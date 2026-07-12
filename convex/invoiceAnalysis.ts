"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { generateObject } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import { groq } from "@ai-sdk/groq";
import { google } from "@ai-sdk/google";
import { FEATURE_FLAGS } from "./featureFlags";
import { detectFileType } from "./lib/fileType";
import { z } from "zod";

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
        { flagName: FEATURE_FLAGS.invoiceAnalysis },
      );

      if (!isInvoiceAnalysisEnabled) {
        console.log(
          "🚫 Invoice analysis feature flag is disabled, setting analysis to disabled state",
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
        },
      );
      const modelKey =
        (userSettings?.aiModel as keyof typeof AI_MODELS) || "gemini";
      console.log(`🤖 Using AI model: ${modelKey} for user ${args.userId}`);

      const response = await fetch(fileUrl);
      const fileBlob = await response.blob();
      const fileBuffer = await fileBlob.arrayBuffer();

      const fileType = detectFileType(fileBuffer);
      console.log(`📎 Detected file type: ${fileType}`);

      const analysis = await extractInvoiceAnalysis(fileBuffer, modelKey);

      // One mutation = one transaction: the extraction commits atomically,
      // and a successful run clears any analysisBigError from a prior failure.
      await ctx.runMutation(internal.invoices.updateInvoiceAnalysis, {
        monthKey: args.monthKey,
        storageId: args.storageId,
        userId: args.userId,
        date: analysis.date,
        sender: analysis.sender,
        parsedText: analysis.parsedText,
        amount: analysis.amount,
        analysisBigError: null,
      });
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
  gemini: google("gemini-3.5-flash"),
} as const;

type AnalysisResult = {
  value: string | null;
  error: string | null;
  lastUpdated: number;
};

type InvoiceAnalysisExtraction = {
  date: AnalysisResult;
  sender: AnalysisResult;
  parsedText: AnalysisResult;
  amount: AnalysisResult;
};

const invoiceAnalysisSchema = z.object({
  date: z
    .string()
    .nullable()
    .describe("Invoice issue date in YYYY-MM-DD format, or null if absent."),
  sender: z
    .string()
    .nullable()
    .describe("Sender/vendor company or person name, or null if absent."),
  parsedText: z
    .string()
    .nullable()
    .describe(
      "Complete readable document text as plain markdown with line breaks preserved, or null if unreadable.",
    ),
  amount: z.object({
    value: z
      .string()
      .nullable()
      .describe(
        "Total invoice amount only, without currency, e.g. '50.80' or '10000'.",
      ),
    currency: z
      .string()
      .nullable()
      .describe("ISO 4217 currency code, e.g. BGN, USD, EUR, or null."),
  }),
});

async function extractInvoiceAnalysis(
  fileBuffer: ArrayBuffer,
  modelKey: keyof typeof AI_MODELS = "gemini",
): Promise<InvoiceAnalysisExtraction> {
  const now = Date.now();
  try {
    const mediaType = detectFileType(fileBuffer);

    const result = await generateObject({
      model: AI_MODELS[modelKey],
      schema: invoiceAnalysisSchema,
      schemaName: "invoice_analysis",
      schemaDescription:
        "Structured fields extracted from an invoice document.",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: [
                "Analyze this invoice document once and extract all requested fields.",
                "Return null for any field that is not present or not readable.",
                "The date must be YYYY-MM-DD.",
                "The sender must be only the company or person name.",
                "The parsedText field must contain the complete readable document text as plain markdown, preserving line breaks and structure.",
                "For amount, return the total invoice amount and ISO 4217 currency as separate fields. Do not combine them.",
              ].join(" "),
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

    const analysis = result.object;
    return {
      date: toAnalysisResult(analysis.date, now),
      sender: toAnalysisResult(analysis.sender, now),
      parsedText: toAnalysisResult(analysis.parsedText, now),
      amount: toAnalysisResult(formatAmountProtocol(analysis.amount), now),
    };
  } catch (error) {
    console.error("🤖 Error calling LLM:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    const failedResult = {
      value: null,
      error: errorMessage,
      lastUpdated: now,
    };

    return {
      date: failedResult,
      sender: failedResult,
      parsedText: failedResult,
      amount: failedResult,
    };
  }
}

function toAnalysisResult(
  value: string | null | undefined,
  lastUpdated: number,
): AnalysisResult {
  const normalized = value?.trim() || null;
  return {
    value: normalized,
    error: null,
    lastUpdated,
  };
}

function formatAmountProtocol(
  amount: z.infer<typeof invoiceAnalysisSchema>["amount"],
): string | null {
  const value = amount.value?.trim();
  const currency = amount.currency?.trim().toUpperCase();

  if (!value || !currency) {
    return null;
  }

  return `${value}|${currency}`;
}
