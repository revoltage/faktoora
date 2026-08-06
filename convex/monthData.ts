import { v } from "convex/values";

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

// Documents migrated from the retired `months` pipeline still carry these
// bookkeeping fields in deployments that never received the FKT-006 cleanup.
// They are transitional: run `legacyFieldCleanup:stripLegacyFields` against
// such a deployment, then delete these three lines and that module.
const legacyMigrationFields = {
  legacyKey: v.optional(v.string()),
  legacyMonthId: v.optional(v.string()),
  migratedAt: v.optional(v.number()),
};

export const normalizedInvoiceValidator = v.object({
  userId: v.id("users"),
  monthKey: v.string(),
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
  ...legacyMigrationFields,
});

export const normalizedStatementValidator = v.object({
  userId: v.id("users"),
  monthKey: v.string(),
  statementId: v.string(),
  storageId: v.id("_storage"),
  fileName: v.string(),
  fileType: v.union(v.literal("pdf"), v.literal("csv")),
  fileHash: v.optional(v.string()),
  isDuplicate: v.optional(v.boolean()),
  duplicateOfStorageId: v.optional(v.id("_storage")),
  uploadedAt: v.number(),
  // Pre-FKT-006 statements embedded their rows instead of using
  // `statementTransactions`. Transitional, same as `legacyMigrationFields`.
  transactions: v.optional(v.array(statementTransactionValidator)),
  ...legacyMigrationFields,
});

export const normalizedTransactionBindingValidator = v.object({
  userId: v.id("users"),
  monthKey: v.string(),
  transactionId: v.string(),
  invoiceStorageId: v.union(
    v.id("_storage"),
    v.literal("NOT_NEEDED"),
    v.null(),
  ),
  boundAt: v.number(),
  ...legacyMigrationFields,
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

const statementTransactionColumns = [
  ["Started Date", "dateStarted"],
  ["Completed Date", "dateCompleted"],
  ["ID", "id"],
  ["Type", "type"],
  ["State", "state"],
  ["Description", "description"],
  ["Reference", "reference"],
  ["Payer", "payer"],
  ["Card Number", "cardNumber"],
  ["Card Label", "cardLabel"],
  ["Card State", "cardState"],
  ["Orig Currency", "origCurrency"],
  ["Orig Amount", "origAmount"],
  ["Payment Currency", "paymentCurrency"],
  ["Amount", "amount"],
  ["Total Amount", "totalAmount"],
  ["Exchange Rate", "exchangeRate"],
  ["Fee", "fee"],
  ["Fee Currency", "feeCurrency"],
  ["Balance", "balance"],
  ["Account", "account"],
  ["Beneficiary Account Number", "beneficiaryAccountNumber"],
  ["Beneficiary Sort Code", "beneficiarySortCode"],
  ["Beneficiary IBAN", "beneficiaryIban"],
  ["Beneficiary BIC", "beneficiaryBic"],
  ["MCC", "mcc"],
  ["Related Transaction ID", "relatedTransactionId"],
  ["Spend Program", "spendProgram"],
] as const;

type StatementTransactionField =
  (typeof statementTransactionColumns)[number][1];

export function parseCsvTransactions(csvText: string) {
  const lines = csvText.split("\n").filter((line) => line.trim());
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]);
  const columnIndexes = new Map<string, number>();
  for (let i = 0; i < headers.length; i++) {
    columnIndexes.set(headers[i].trim().toLowerCase(), i);
  }

  const missingHeaders = statementTransactionColumns
    .filter(([header]) => !columnIndexes.has(header.trim().toLowerCase()))
    .map(([header]) => header);

  if (missingHeaders.length > 0) {
    throw new Error(
      `Revolut CSV is missing required column${missingHeaders.length === 1 ? "" : "s"}: ${missingHeaders.join(", ")}`,
    );
  }

  const transactions = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    const values = parseCsvLine(line);
    const transaction = {} as Record<StatementTransactionField, string>;
    for (const [header, field] of statementTransactionColumns) {
      const columnIndex = columnIndexes.get(header.trim().toLowerCase())!;
      transaction[field] = values[columnIndex] || "";
    }
    transactions.push(transaction);
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
