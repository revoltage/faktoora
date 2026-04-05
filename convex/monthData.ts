import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

export const analysisResultValidator = v.object({
  value: v.union(v.string(), v.null()),
  error: v.union(v.string(), v.null()),
  lastUpdated: v.union(v.number(), v.null()),
});

export const invoiceAnalysisValidator = v.object({
  date: analysisResultValidator,
  sender: analysisResultValidator,
  parsedText: analysisResultValidator,
  amount: analysisResultValidator,
  analysisBigError: v.union(v.string(), v.null()),
});

export const invoiceParsingValidator = v.object({
  parsedText: analysisResultValidator,
});

export const statementTransactionValidator = v.object({
  id: v.string(),
  dateStarted: v.string(),
  dateCompleted: v.string(),
  type: v.string(),
  state: v.string(),
  description: v.string(),
  reference: v.string(),
  payer: v.string(),
  cardNumber: v.string(),
  cardLabel: v.string(),
  cardState: v.string(),
  origCurrency: v.string(),
  origAmount: v.string(),
  paymentCurrency: v.string(),
  amount: v.string(),
  totalAmount: v.string(),
  exchangeRate: v.string(),
  fee: v.string(),
  feeCurrency: v.string(),
  balance: v.string(),
  account: v.string(),
  beneficiaryAccountNumber: v.string(),
  beneficiarySortCode: v.string(),
  beneficiaryIban: v.string(),
  beneficiaryBic: v.string(),
  mcc: v.string(),
  relatedTransactionId: v.string(),
  spendProgram: v.string(),
});

export const legacyInvoiceValidator = v.object({
  invoiceId: v.optional(v.string()),
  storageId: v.id("_storage"),
  fileName: v.string(),
  name: v.optional(v.string()),
  fileHash: v.optional(v.string()),
  isDuplicate: v.optional(v.boolean()),
  duplicateOfStorageId: v.optional(v.id("_storage")),
  uploadedAt: v.number(),
  analysis: invoiceAnalysisValidator,
  parsing: invoiceParsingValidator,
});

export const legacyTransactionBindingValidator = v.object({
  transactionId: v.string(),
  invoiceStorageId: v.union(
    v.id("_storage"),
    v.literal("NOT_NEEDED"),
    v.null(),
  ),
  boundAt: v.number(),
});

export const legacyStatementValidator = v.object({
  storageId: v.id("_storage"),
  fileName: v.string(),
  fileType: v.union(v.literal("pdf"), v.literal("csv")),
  uploadedAt: v.number(),
  transactions: v.optional(v.array(statementTransactionValidator)),
});

export const normalizedInvoiceValidator = v.object({
  userId: v.id("users"),
  monthKey: v.string(),
  legacyMonthId: v.optional(v.id("months")),
  legacyKey: v.string(),
  invoiceId: v.string(),
  storageId: v.id("_storage"),
  fileName: v.string(),
  name: v.optional(v.string()),
  fileHash: v.optional(v.string()),
  isDuplicate: v.optional(v.boolean()),
  duplicateOfStorageId: v.optional(v.id("_storage")),
  uploadedAt: v.number(),
  analysis: invoiceAnalysisValidator,
  parsing: invoiceParsingValidator,
  migratedAt: v.optional(v.number()),
});

export const normalizedStatementValidator = v.object({
  userId: v.id("users"),
  monthKey: v.string(),
  legacyMonthId: v.optional(v.id("months")),
  legacyKey: v.string(),
  statementId: v.string(),
  storageId: v.id("_storage"),
  fileName: v.string(),
  fileType: v.union(v.literal("pdf"), v.literal("csv")),
  uploadedAt: v.number(),
  transactions: v.optional(v.array(statementTransactionValidator)),
  migratedAt: v.optional(v.number()),
});

export const normalizedTransactionBindingValidator = v.object({
  userId: v.id("users"),
  monthKey: v.string(),
  legacyMonthId: v.optional(v.id("months")),
  legacyKey: v.string(),
  transactionId: v.string(),
  invoiceStorageId: v.union(
    v.id("_storage"),
    v.literal("NOT_NEEDED"),
    v.null(),
  ),
  boundAt: v.number(),
  migratedAt: v.optional(v.number()),
});

export function getFileNameWithoutExtension(fileName: string): string {
  const lastDotIndex = fileName.lastIndexOf(".");
  if (lastDotIndex === -1) {
    return fileName;
  }
  return fileName.substring(0, lastDotIndex);
}

export function generateInvoiceId(): string {
  return `inv_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function generateStatementId(): string {
  return `stmt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function getStableInvoiceId(args: {
  invoiceId?: string;
  storageId: Id<"_storage">;
  uploadedAt: number;
}): string {
  return args.invoiceId ?? `legacy_inv_${args.storageId}_${args.uploadedAt}`;
}

export function getStableStatementId(args: {
  storageId: Id<"_storage">;
  uploadedAt: number;
}): string {
  return `legacy_stmt_${args.storageId}_${args.uploadedAt}`;
}

export function createEmptyAnalysis() {
  return {
    date: { value: null, error: null, lastUpdated: null },
    sender: { value: null, error: null, lastUpdated: null },
    parsedText: { value: null, error: null, lastUpdated: null },
    amount: { value: null, error: null, lastUpdated: null },
    analysisBigError: null,
  };
}

export function createEmptyParsing() {
  return {
    parsedText: { value: null, error: null, lastUpdated: null },
  };
}

export function buildInvoiceLegacyKey(args: {
  invoiceId?: string;
  storageId: Id<"_storage">;
  uploadedAt: number;
}): string {
  return args.invoiceId ?? `${args.storageId}:${args.uploadedAt}`;
}

export function buildStatementLegacyKey(args: {
  storageId: Id<"_storage">;
  uploadedAt: number;
}): string {
  return `${args.storageId}:${args.uploadedAt}`;
}

export function buildBindingLegacyKey(args: { transactionId: string }): string {
  return args.transactionId;
}

export function buildScopedLegacyKey(args: {
  kind: "invoice" | "statement" | "binding";
  userId: Id<"users">;
  monthKey: string;
  legacyKey: string;
}): string {
  return `${args.kind}:${args.userId}:${args.monthKey}:${args.legacyKey}`;
}

export function parseCsvTransactions(csvText: string) {
  const lines = csvText.split("\n").filter((line) => line.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim());
  const transactions = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    const values = parseCsvLine(line);

    if (values.length >= headers.length) {
      transactions.push({
        id: values[2] || "",
        dateStarted: values[0] || "",
        dateCompleted: values[1] || "",
        type: values[3] || "",
        state: values[4] || "",
        description: values[5] || "",
        reference: values[6] || "",
        payer: values[7] || "",
        cardNumber: values[8] || "",
        cardLabel: values[9] || "",
        cardState: values[10] || "",
        origCurrency: values[11] || "",
        origAmount: values[12] || "",
        paymentCurrency: values[13] || "",
        amount: values[14] || "",
        totalAmount: values[15] || "",
        exchangeRate: values[16] || "",
        fee: values[17] || "",
        feeCurrency: values[18] || "",
        balance: values[19] || "",
        account: values[20] || "",
        beneficiaryAccountNumber: values[21] || "",
        beneficiarySortCode: values[22] || "",
        beneficiaryIban: values[23] || "",
        beneficiaryBic: values[24] || "",
        mcc: values[25] || "",
        relatedTransactionId: values[26] || "",
        spendProgram: values[27] || "",
      });
    }
  }

  return transactions;
}

function parseCsvLine(line: string): string[] {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}
