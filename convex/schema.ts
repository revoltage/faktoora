import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";
import {
  statementTransactionValidator,
  normalizedInvoiceValidator,
  normalizedStatementValidator,
  normalizedTransactionBindingValidator,
} from "./monthData";

const applicationTables = {
  userSettings: defineTable({
    userId: v.id("users"),
    vatId: v.optional(v.string()),
    aiModel: v.optional(v.string()),
    currencyRates: v.optional(v.string()),
    currencyRateDate: v.optional(v.string()),
    accEmail: v.optional(v.string()),
    invoiceHelperLinks: v.optional(v.string()),
    // Pre-FKT-010 free-text manual transactions. Transitional: migrated by
    // `legacyFieldCleanup:migrateManualTransactions`, then removed here.
    manualTransactions: v.optional(v.string()),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),
  featureFlags: defineTable({
    flagName: v.string(),
    enabled: v.boolean(),
    description: v.optional(v.string()),
    updatedAt: v.number(),
  }).index("by_flag_name", ["flagName"]),
  manualTransactions: defineTable({
    userId: v.id("users"),
    monthKey: v.optional(v.string()),
    name: v.string(),
    amount: v.string(),
    currency: v.optional(v.string()),
    recurring: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_month", ["userId", "monthKey"])
    .index("by_user_and_recurring", ["userId", "recurring"]),
  incomingInvoices: defineTable(normalizedInvoiceValidator)
    .index("by_user_and_month", ["userId", "monthKey"])
    .index("by_user_month_and_invoice_id", ["userId", "monthKey", "invoiceId"])
    .index("by_user_month_and_storage_id", ["userId", "monthKey", "storageId"]),
  statements: defineTable(normalizedStatementValidator)
    .index("by_user_and_month", ["userId", "monthKey"])
    .index("by_user_month_and_statement_id", [
      "userId",
      "monthKey",
      "statementId",
    ])
    .index("by_user_month_and_storage_id", ["userId", "monthKey", "storageId"])
    .index("by_user_month_and_file_hash", ["userId", "monthKey", "fileHash"]),
  statementTransactions: defineTable({
    userId: v.id("users"),
    monthKey: v.string(),
    statementId: v.string(),
    transactionId: v.string(),
    transaction: statementTransactionValidator,
    createdAt: v.number(),
  })
    .index("by_user_and_month", ["userId", "monthKey"])
    .index("by_statement_id", ["statementId"])
    .index("by_user_month_and_transaction_id", [
      "userId",
      "monthKey",
      "transactionId",
    ]),
  transactionInvoiceBindings: defineTable(normalizedTransactionBindingValidator)
    .index("by_user_and_month", ["userId", "monthKey"])
    .index("by_user_month_and_transaction_id", [
      "userId",
      "monthKey",
      "transactionId",
    ]),
};

export default defineSchema({
  ...authTables,
  ...applicationTables,
});
