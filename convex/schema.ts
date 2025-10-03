import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const analysisResult = v.object({
  value: v.union(v.string(), v.null()),
  error: v.union(v.string(), v.null()),
  lastUpdated: v.union(v.number(), v.null()),
});

const applicationTables = {
  months: defineTable({
    userId: v.id("users"),
    monthKey: v.string(), // Format: "YYYY-MM"
    incomingInvoices: v.array(
      v.object({
        storageId: v.id("_storage"),
        fileName: v.string(),
        uploadedAt: v.number(),
        analysis: v.object({
          date: analysisResult,
          sender: analysisResult,
          parsedText: analysisResult,
        }),
        parsing: v.object({}),
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
