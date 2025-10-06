import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const analysisResult = v.object({
  value: v.union(v.any(), v.null()),
  error: v.union(v.string(), v.null()),
  lastUpdated: v.union(v.number(), v.null()),
});

const paidItem = v.object({
  description: v.string(),
  amount: v.string(),
});

const paidItemsAnalysisResult = v.object({
  value: v.union(v.array(paidItem), v.null()),
  error: v.union(v.string(), v.null()),
  lastUpdated: v.union(v.number(), v.null()),
});


const applicationTables = {
  userSettings: defineTable({
    userId: v.id("users"),
    vatId: v.optional(v.string()),
    aiModel: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"]),
  featureFlags: defineTable({
    flagName: v.string(),
    enabled: v.boolean(),
    description: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index("by_flag_name", ["flagName"]),
  months: defineTable({
    userId: v.id("users"),
    monthKey: v.string(), // Format: "YYYY-MM"
    incomingInvoices: v.array(
      v.object({
        storageId: v.id("_storage"),
        fileName: v.string(),
        name: v.optional(v.string()),
        uploadedAt: v.number(),
        analysis: v.object({
          date: analysisResult,
          sender: analysisResult,
          parsedText: analysisResult,
          amount: analysisResult,
          paidItems: paidItemsAnalysisResult,
          analysisBigError: v.union(v.string(), v.null()),
        }),
        parsing: v.object({
          parsedText: analysisResult,
        }),
      })
    ),
    transactionInvoiceBindings: v.array(
      v.object({
        transactionId: v.string(),
        invoiceStorageId: v.union(v.id("_storage"), v.null()),
        boundAt: v.number(),
      })
    ),
    statements: v.array(
      v.object({
        storageId: v.id("_storage"),
        fileName: v.string(),
        fileType: v.union(v.literal("pdf"), v.literal("csv")),
        uploadedAt: v.number(),
        transactions: v.optional(v.array(
          v.object({
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
          })
        )),
      })
    ),
  })
    .index("by_user_and_month", ["userId", "monthKey"]),
};

export default defineSchema({
  ...authTables,
  ...applicationTables,
});
