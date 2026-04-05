import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";
import {
  legacyInvoiceValidator,
  legacyStatementValidator,
  legacyTransactionBindingValidator,
  normalizedInvoiceValidator,
  normalizedStatementValidator,
  normalizedTransactionBindingValidator,
} from "./monthData";

const applicationTables = {
  userSettings: defineTable({
    userId: v.id("users"),
    vatId: v.optional(v.string()),
    aiModel: v.optional(v.string()),
    accEmail: v.optional(v.string()),
    manualTransactions: v.optional(v.string()),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),
  featureFlags: defineTable({
    flagName: v.string(),
    enabled: v.boolean(),
    description: v.optional(v.string()),
    updatedAt: v.number(),
  }).index("by_flag_name", ["flagName"]),
  months: defineTable({
    userId: v.id("users"),
    monthKey: v.string(), // Format: "YYYY-MM"
    incomingInvoices: v.array(legacyInvoiceValidator),
    transactionInvoiceBindings: v.array(legacyTransactionBindingValidator),
    statements: v.array(legacyStatementValidator),
  }).index("by_user_and_month", ["userId", "monthKey"]),
  incomingInvoices: defineTable(normalizedInvoiceValidator)
    .index("by_user_and_month", ["userId", "monthKey"])
    .index("by_user_month_and_invoice_id", ["userId", "monthKey", "invoiceId"])
    .index("by_user_month_and_storage_id", ["userId", "monthKey", "storageId"])
    .index("by_legacy_key", ["legacyKey"]),
  statements: defineTable(normalizedStatementValidator)
    .index("by_user_and_month", ["userId", "monthKey"])
    .index("by_user_month_and_statement_id", [
      "userId",
      "monthKey",
      "statementId",
    ])
    .index("by_user_month_and_storage_id", ["userId", "monthKey", "storageId"])
    .index("by_legacy_key", ["legacyKey"]),
  transactionInvoiceBindings: defineTable(normalizedTransactionBindingValidator)
    .index("by_user_and_month", ["userId", "monthKey"])
    .index("by_user_month_and_transaction_id", [
      "userId",
      "monthKey",
      "transactionId",
    ])
    .index("by_legacy_key", ["legacyKey"]),
};

export default defineSchema({
  ...authTables,
  ...applicationTables,
});
