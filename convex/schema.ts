import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const applicationTables = {
  months: defineTable({
    userId: v.id("users"),
    monthKey: v.string(), // Format: "YYYY-MM"
    incomingInvoices: v.array(
      v.object({
        storageId: v.id("_storage"),
        fileName: v.string(),
        uploadedAt: v.number(),
        analysis: v.optional(v.object({
          date: v.union(v.string(), v.null()),
          sender: v.union(v.string(), v.null()),
        })),
      })
    ),
    statements: v.array(
      v.object({
        storageId: v.id("_storage"),
        fileName: v.string(),
        fileType: v.union(v.literal("pdf"), v.literal("csv")),
        uploadedAt: v.number(),
      })
    ),
  })
    .index("by_user_and_month", ["userId", "monthKey"]),
};

export default defineSchema({
  ...authTables,
  ...applicationTables,
});
