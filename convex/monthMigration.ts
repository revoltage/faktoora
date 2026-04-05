import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internalQuery, query } from "./_generated/server";
import {
  buildBindingLegacyKey,
  buildInvoiceLegacyKey,
  buildScopedLegacyKey,
  buildStatementLegacyKey,
} from "./monthData";
import {
  listNormalizedBindings,
  listNormalizedInvoices,
  listNormalizedStatements,
} from "./normalizedMonthStore";

export const getMigrationOverview = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    return await buildMigrationOverview(ctx, userId);
  },
});

export const getMigrationOverviewInternal = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await buildMigrationOverview(ctx, args.userId);
  },
});

export const getMonthMigrationStatus = query({
  args: { monthKey: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    return await buildMonthMigrationStatus(ctx, userId, args.monthKey);
  },
});

export const getMonthMigrationStatusInternal = internalQuery({
  args: {
    userId: v.id("users"),
    monthKey: v.string(),
  },
  handler: async (ctx, args) => {
    return await buildMonthMigrationStatus(ctx, args.userId, args.monthKey);
  },
});

export const getUserMonthKeysInternal = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await listUserMonthKeys(ctx, args.userId);
  },
});

export const getMigrationReportInternal = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await buildMigrationReport(ctx, args.userId);
  },
});

export const getLatestUserMigrationReportInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    if (users.length === 0) {
      return null;
    }

    const userId = users[users.length - 1]._id;
    return await buildMigrationReport(ctx, userId);
  },
});

export const getMonthDataDiffInternal = internalQuery({
  args: {
    userId: v.id("users"),
    monthKey: v.string(),
  },
  handler: async (ctx, args) => {
    const legacyMonth = await ctx.db
      .query("months")
      .withIndex("by_user_and_month", (q: any) =>
        q.eq("userId", args.userId).eq("monthKey", args.monthKey),
      )
      .unique();

    const [normalizedInvoices, normalizedStatements, normalizedBindings] =
      await Promise.all([
        listNormalizedInvoices(ctx, args.userId, args.monthKey),
        listNormalizedStatements(ctx, args.userId, args.monthKey),
        listNormalizedBindings(ctx, args.userId, args.monthKey),
      ]);

    const normalizedInvoiceKeys = new Set(
      normalizedInvoices.map((invoice) => invoice.legacyKey),
    );
    const normalizedStatementKeys = new Set(
      normalizedStatements.map((statement) => statement.legacyKey),
    );
    const normalizedBindingKeys = new Set(
      normalizedBindings.map((binding) => binding.legacyKey),
    );

    const missingInvoices = (legacyMonth?.incomingInvoices ?? [])
      .filter((invoice: any) => {
        const key = buildScopedLegacyKey({
          kind: "invoice",
          userId: args.userId,
          monthKey: args.monthKey,
          legacyKey: buildInvoiceLegacyKey({
            invoiceId: invoice.invoiceId,
            storageId: invoice.storageId,
            uploadedAt: invoice.uploadedAt,
          }),
        });

        return !normalizedInvoiceKeys.has(key);
      })
      .map((invoice: any) => ({
        fileName: invoice.fileName,
        name: invoice.name ?? null,
        storageId: invoice.storageId,
        uploadedAt: invoice.uploadedAt,
      }));

    const missingStatements = (legacyMonth?.statements ?? [])
      .filter((statement: any) => {
        const key = buildScopedLegacyKey({
          kind: "statement",
          userId: args.userId,
          monthKey: args.monthKey,
          legacyKey: buildStatementLegacyKey({
            storageId: statement.storageId,
            uploadedAt: statement.uploadedAt,
          }),
        });

        return !normalizedStatementKeys.has(key);
      })
      .map((statement: any) => ({
        fileName: statement.fileName,
        storageId: statement.storageId,
        uploadedAt: statement.uploadedAt,
      }));

    const missingBindings = (legacyMonth?.transactionInvoiceBindings ?? [])
      .filter((binding: any) => {
        const key = buildScopedLegacyKey({
          kind: "binding",
          userId: args.userId,
          monthKey: args.monthKey,
          legacyKey: buildBindingLegacyKey({
            transactionId: binding.transactionId,
          }),
        });

        return !normalizedBindingKeys.has(key);
      })
      .map((binding: any) => binding.transactionId);

    return {
      monthKey: args.monthKey,
      missingInvoices,
      missingStatements,
      missingBindings,
    };
  },
});

async function buildMigrationOverview(ctx: any, userId: Id<"users">) {
  const [months, invoices, statements, bindings] = await Promise.all([
    ctx.db
      .query("months")
      .withIndex("by_user_and_month", (q: any) => q.eq("userId", userId))
      .collect(),
    ctx.db
      .query("incomingInvoices")
      .withIndex("by_user_and_month", (q: any) => q.eq("userId", userId))
      .collect(),
    ctx.db
      .query("statements")
      .withIndex("by_user_and_month", (q: any) => q.eq("userId", userId))
      .collect(),
    ctx.db
      .query("transactionInvoiceBindings")
      .withIndex("by_user_and_month", (q: any) => q.eq("userId", userId))
      .collect(),
  ]);

  return {
    legacyMonths: months.length,
    legacyInvoices: months.reduce(
      (count: number, month: any) => count + month.incomingInvoices.length,
      0,
    ),
    legacyStatements: months.reduce(
      (count: number, month: any) => count + month.statements.length,
      0,
    ),
    legacyBindings: months.reduce(
      (count: number, month: any) =>
        count + month.transactionInvoiceBindings.length,
      0,
    ),
    normalizedInvoices: invoices.length,
    normalizedStatements: statements.length,
    normalizedBindings: bindings.length,
  };
}

async function buildMonthMigrationStatus(
  ctx: any,
  userId: Id<"users">,
  monthKey: string,
) {
  const legacyMonth = await ctx.db
    .query("months")
    .withIndex("by_user_and_month", (q: any) =>
      q.eq("userId", userId).eq("monthKey", monthKey),
    )
    .unique();

  const [invoices, statements, bindings] = await Promise.all([
    listNormalizedInvoices(ctx, userId, monthKey),
    listNormalizedStatements(ctx, userId, monthKey),
    listNormalizedBindings(ctx, userId, monthKey),
  ]);

  const legacyInvoiceKeys = (legacyMonth?.incomingInvoices ?? [])
    .map((invoice: any) =>
      buildScopedLegacyKey({
        kind: "invoice",
        userId,
        monthKey,
        legacyKey: buildInvoiceLegacyKey({
          invoiceId: invoice.invoiceId,
          storageId: invoice.storageId,
          uploadedAt: invoice.uploadedAt,
        }),
      }),
    )
    .sort();

  const normalizedInvoiceKeys = invoices
    .map((invoice) => invoice.legacyKey)
    .sort();

  const legacyStatementKeys = (legacyMonth?.statements ?? [])
    .map((statement: any) =>
      buildScopedLegacyKey({
        kind: "statement",
        userId,
        monthKey,
        legacyKey: buildStatementLegacyKey({
          storageId: statement.storageId,
          uploadedAt: statement.uploadedAt,
        }),
      }),
    )
    .sort();

  const normalizedStatementKeys = statements
    .map((statement) => statement.legacyKey)
    .sort();

  const legacyBindingKeys = (legacyMonth?.transactionInvoiceBindings ?? [])
    .map((binding: any) =>
      buildScopedLegacyKey({
        kind: "binding",
        userId,
        monthKey,
        legacyKey: buildBindingLegacyKey({
          transactionId: binding.transactionId,
        }),
      }),
    )
    .sort();

  const normalizedBindingKeys = bindings
    .map((binding) => binding.legacyKey)
    .sort();

  return {
    monthKey,
    legacyCounts: {
      invoices: legacyMonth?.incomingInvoices.length ?? 0,
      statements: legacyMonth?.statements.length ?? 0,
      bindings: legacyMonth?.transactionInvoiceBindings.length ?? 0,
    },
    normalizedCounts: {
      invoices: invoices.length,
      statements: statements.length,
      bindings: bindings.length,
    },
    keyParity: {
      invoices: arraysEqual(legacyInvoiceKeys, normalizedInvoiceKeys),
      statements: arraysEqual(legacyStatementKeys, normalizedStatementKeys),
      bindings: arraysEqual(legacyBindingKeys, normalizedBindingKeys),
    },
  };
}

async function buildMigrationReport(ctx: any, userId: Id<"users">) {
  const monthKeys = await listUserMonthKeys(ctx, userId);
  const [overview, months] = await Promise.all([
    buildMigrationOverview(ctx, userId),
    Promise.all(
      monthKeys.map(async (monthKey) =>
        buildMonthMigrationStatus(ctx, userId, monthKey),
      ),
    ),
  ]);

  return {
    userId,
    monthKeys,
    overview,
    months,
    allHealthy: months.every(
      (month) =>
        month.keyParity.invoices &&
        month.keyParity.statements &&
        month.keyParity.bindings &&
        month.legacyCounts.invoices === month.normalizedCounts.invoices &&
        month.legacyCounts.statements === month.normalizedCounts.statements &&
        month.legacyCounts.bindings === month.normalizedCounts.bindings,
    ),
  };
}

async function listUserMonthKeys(ctx: any, userId: Id<"users">) {
  const [
    legacyMonths,
    normalizedInvoices,
    normalizedStatements,
    normalizedBindings,
  ] = await Promise.all([
    ctx.db
      .query("months")
      .withIndex("by_user_and_month", (q: any) => q.eq("userId", userId))
      .collect(),
    ctx.db
      .query("incomingInvoices")
      .withIndex("by_user_and_month", (q: any) => q.eq("userId", userId))
      .collect(),
    ctx.db
      .query("statements")
      .withIndex("by_user_and_month", (q: any) => q.eq("userId", userId))
      .collect(),
    ctx.db
      .query("transactionInvoiceBindings")
      .withIndex("by_user_and_month", (q: any) => q.eq("userId", userId))
      .collect(),
  ]);

  const monthKeys = new Set<string>();

  for (const month of legacyMonths) {
    monthKeys.add(month.monthKey);
  }

  for (const invoice of normalizedInvoices) {
    monthKeys.add(invoice.monthKey);
  }

  for (const statement of normalizedStatements) {
    monthKeys.add(statement.monthKey);
  }

  for (const binding of normalizedBindings) {
    monthKeys.add(binding.monthKey);
  }

  return [...monthKeys].sort();
}

function arraysEqual(left: string[], right: string[]) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}
