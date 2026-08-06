import { internalMutation, internalQuery } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { v } from "convex/values";

/**
 * One-off cleanup for deployments that received the `months` -> normalized
 * tables migration but never the FKT-006 field cleanup, so their documents
 * still carry `legacyKey` / `legacyMonthId` / `migratedAt` (and, for
 * statements, an embedded `transactions` array). Those extra fields fail
 * schema validation on push.
 *
 * Usage against such a deployment:
 *   npx convex run --prod legacyFieldCleanup:inspectLegacyFields
 *   npx convex run --prod legacyFieldCleanup:stripLegacyFields
 * Repeat `stripLegacyFields` until every count is 0, then delete this module
 * and `legacyMigrationFields` in `monthData.ts`.
 */

const LEGACY_TABLES = [
  "incomingInvoices",
  "statements",
  "transactionInvoiceBindings",
] as const;

type LegacyTable = (typeof LEGACY_TABLES)[number];

function findDirty(ctx: QueryCtx | MutationCtx, table: LegacyTable) {
  return ctx.db.query(table).filter((q) =>
    q.or(
      q.neq(q.field("legacyKey"), undefined),
      q.neq(q.field("legacyMonthId"), undefined),
      q.neq(q.field("migratedAt"), undefined),
      // Only `statements` has this field; on the other tables it is always
      // undefined, so the clause is inert.
      q.neq(q.field("transactions"), undefined),
    ),
  );
}

export const inspectLegacyFields = internalQuery({
  args: {},
  handler: async (ctx) => {
    const dirtyByTable: Record<string, number> = {};
    for (const table of LEGACY_TABLES) {
      dirtyByTable[table] = (await findDirty(ctx, table).collect()).length;
    }

    // A statement's embedded rows may only be dropped once the normalized
    // `statementTransactions` table actually holds them.
    const statements = await ctx.db.query("statements").collect();
    const statementsWithEmbeddedRows = statements.filter(
      (statement) => statement.transactions !== undefined,
    );
    const embeddedRowsNotYetNormalized: string[] = [];
    for (const statement of statementsWithEmbeddedRows) {
      const normalized = await ctx.db
        .query("statementTransactions")
        .withIndex("by_statement_id", (q) =>
          q.eq("statementId", statement.statementId),
        )
        .first();
      if (!normalized) {
        embeddedRowsNotYetNormalized.push(statement.statementId);
      }
    }

    return {
      dirtyByTable,
      statementsWithEmbeddedRows: statementsWithEmbeddedRows.length,
      // Statements whose rows exist ONLY in the embedded array. Stripping
      // these would lose data, so `stripLegacyFields` skips them.
      embeddedRowsNotYetNormalized,
    };
  },
});

export const stripLegacyFields = internalMutation({
  args: { batchSize: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const batchSize = args.batchSize ?? 200;
    const strippedByTable: Record<string, number> = {};
    const skippedStatementIds: string[] = [];

    for (const table of LEGACY_TABLES) {
      const documents = await findDirty(ctx, table).take(batchSize);
      let stripped = 0;

      for (const document of documents) {
        if (table === "statements" && "transactions" in document) {
          const statement = document as typeof document & {
            statementId: string;
          };
          const normalized = await ctx.db
            .query("statementTransactions")
            .withIndex("by_statement_id", (q) =>
              q.eq("statementId", statement.statementId),
            )
            .first();
          if (statement.transactions !== undefined && !normalized) {
            skippedStatementIds.push(statement.statementId);
            continue;
          }
        }

        await ctx.db.patch(document._id, {
          legacyKey: undefined,
          legacyMonthId: undefined,
          migratedAt: undefined,
          ...(table === "statements" ? { transactions: undefined } : {}),
        });
        stripped += 1;
      }

      strippedByTable[table] = stripped;
    }

    return { strippedByTable, skippedStatementIds };
  },
});
