import { v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { internalMutation, internalQuery } from "./_generated/server";

/**
 * One-off repair for deployments still running pre-FKT-006 code. Their
 * documents carry fields the current schema no longer declares, which fails
 * validation on every push, so they can never be upgraded in one step:
 *
 *   - `legacyKey` / `legacyMonthId` / `migratedAt` on the normalized tables,
 *     left behind by the retired `months` migration.
 *   - `statements.transactions[]`, the embedded rows that FKT-006 moved into
 *     the `statementTransactions` table.
 *   - `userSettings.manualTransactions`, the free-text field that FKT-010
 *     replaced with the `manualTransactions` table without a data migration.
 *
 * The last two hold the ONLY copy of real data, so they are migrated before
 * anything is deleted. Runbook, in order:
 *
 *   npx convex run --prod legacyFieldCleanup:inspectLegacyFields
 *   npx convex run --prod legacyFieldCleanup:backfillStatementTransactions
 *   npx convex run --prod legacyFieldCleanup:migrateManualTransactions
 *   npx convex run --prod legacyFieldCleanup:stripLegacyFields   # until clean
 *   npx convex run --prod legacyFieldCleanup:inspectLegacyFields
 *
 * Once a deployment inspects clean, delete this module, `legacyMigrationFields`
 * in `monthData.ts`, and the transitional `manualTransactions` field on
 * `userSettings` in `schema.ts`.
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
      // Only `statements` has this field; elsewhere the clause is inert.
      q.neq(q.field("transactions"), undefined),
    ),
  );
}

/**
 * True only when `statementTransactions` holds at least as many rows as the
 * statement's embedded array. A mere existence check would let a PARTIAL
 * backfill green-light deleting the rows that never made it across.
 */
async function isFullyNormalized(
  ctx: QueryCtx | MutationCtx,
  statement: Doc<"statements">,
) {
  const embedded = statement.transactions?.length ?? 0;
  const normalized = await ctx.db
    .query("statementTransactions")
    .withIndex("by_statement_id", (q) =>
      q.eq("statementId", statement.statementId),
    )
    .collect();
  return normalized.length >= embedded;
}

/**
 * Split the pre-FKT-010 textarea format: one entry per line, `name, amount`
 * with the amount optional. Only a trailing comma-separated number counts as
 * an amount, so names containing commas survive intact.
 */
export function parseLegacyManualTransactions(
  value: string,
): { name: string; amount: string }[] {
  const entries: { name: string; amount: string }[] = [];

  for (const rawLine of value.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;

    const separator = line.lastIndexOf(",");
    if (separator !== -1) {
      const tail = line.slice(separator + 1).trim();
      const head = line.slice(0, separator).trim();
      if (head && tail && !isNaN(parseFloat(tail))) {
        entries.push({ name: head, amount: tail });
        continue;
      }
    }

    entries.push({ name: line, amount: "" });
  }

  return entries;
}

export const inspectLegacyFields = internalQuery({
  args: {},
  handler: async (ctx) => {
    const dirtyByTable: Record<string, number> = {};
    for (const table of LEGACY_TABLES) {
      dirtyByTable[table] = (await findDirty(ctx, table).collect()).length;
    }

    const statements = await ctx.db.query("statements").collect();
    const embedded = statements.filter((s) => s.transactions !== undefined);
    const awaitingBackfill: string[] = [];
    for (const statement of embedded) {
      if (!(await isFullyNormalized(ctx, statement))) {
        awaitingBackfill.push(statement.statementId);
      }
    }

    const settings = await ctx.db.query("userSettings").collect();

    return {
      dirtyByTable,
      statementsWithEmbeddedRows: embedded.length,
      embeddedRowsTotal: embedded.reduce(
        (total, s) => total + (s.transactions?.length ?? 0),
        0,
      ),
      // Statements whose rows exist ONLY in the embedded array. Run
      // `backfillStatementTransactions` before stripping, or they are lost.
      awaitingBackfill,
      statementTransactionsTotal: (
        await ctx.db.query("statementTransactions").collect()
      ).length,
      settingsWithLegacyManualTransactions: settings.filter(
        (s) => s.manualTransactions !== undefined,
      ).length,
      manualTransactionRows: (
        await ctx.db.query("manualTransactions").collect()
      ).length,
    };
  },
});

/**
 * Copy embedded statement rows into `statementTransactions`, mirroring what
 * `invoices.ts` does on upload.
 *
 * Idempotency is by MULTIPLICITY, not presence: a Revolut `EXCHANGE` emits two
 * legs (debit and credit) that share one transaction id, so deduplicating on
 * the id alone would silently drop the second leg. Re-running therefore tops a
 * statement up to its embedded count and inserts nothing once it matches.
 */
export const backfillStatementTransactions = internalMutation({
  args: {},
  handler: async (ctx) => {
    const statements = await ctx.db.query("statements").collect();
    const now = Date.now();
    let statementsBackfilled = 0;
    let rowsInserted = 0;

    for (const statement of statements) {
      const transactions = statement.transactions;
      if (!transactions || transactions.length === 0) continue;

      const existing = await ctx.db
        .query("statementTransactions")
        .withIndex("by_statement_id", (q) =>
          q.eq("statementId", statement.statementId),
        )
        .collect();

      const missingByTransactionId = new Map<string, number>();
      for (const transaction of transactions) {
        const seen = missingByTransactionId.get(transaction.id) ?? 0;
        missingByTransactionId.set(transaction.id, seen + 1);
      }
      for (const row of existing) {
        const remaining = missingByTransactionId.get(row.transactionId);
        if (remaining) {
          missingByTransactionId.set(row.transactionId, remaining - 1);
        }
      }

      let insertedHere = 0;
      for (const transaction of transactions) {
        const remaining = missingByTransactionId.get(transaction.id) ?? 0;
        if (remaining <= 0) continue;
        missingByTransactionId.set(transaction.id, remaining - 1);

        await ctx.db.insert("statementTransactions", {
          userId: statement.userId,
          monthKey: statement.monthKey,
          statementId: statement.statementId,
          transactionId: transaction.id,
          transaction,
          createdAt: now,
        });
        insertedHere += 1;
      }

      rowsInserted += insertedHere;
      if (insertedHere > 0) statementsBackfilled += 1;
    }

    return { statementsBackfilled, rowsInserted };
  },
});

/**
 * Convert `userSettings.manualTransactions` into `manualTransactions` rows.
 * The old field was global rather than month-scoped, so every entry becomes a
 * recurring row. Idempotent: entries whose name already exists are skipped,
 * and the field is only cleared once its entries are present.
 */
export const migrateManualTransactions = internalMutation({
  args: {},
  handler: async (ctx) => {
    const settings = await ctx.db.query("userSettings").collect();
    const now = Date.now();
    let inserted = 0;
    let cleared = 0;

    for (const setting of settings) {
      const legacy = setting.manualTransactions;
      if (legacy === undefined) continue;

      const existing = await ctx.db
        .query("manualTransactions")
        .withIndex("by_user", (q) => q.eq("userId", setting.userId))
        .collect();
      const existingNames = new Set(existing.map((row) => row.name));

      const entries = parseLegacyManualTransactions(legacy);
      for (const entry of entries) {
        if (existingNames.has(entry.name)) continue;
        await ctx.db.insert("manualTransactions", {
          userId: setting.userId,
          name: entry.name,
          amount: entry.amount,
          recurring: true,
          createdAt: now,
          updatedAt: now,
        });
        existingNames.add(entry.name);
        inserted += 1;
      }

      // Only drop the source string once every entry it held is in the table.
      if (entries.every((entry) => existingNames.has(entry.name))) {
        await ctx.db.patch(setting._id, { manualTransactions: undefined });
        cleared += 1;
      }
    }

    return { inserted, cleared };
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
        if (table === "statements") {
          const statement = document as Doc<"statements">;
          if (
            statement.transactions !== undefined &&
            !(await isFullyNormalized(ctx, statement))
          ) {
            skippedStatementIds.push(statement.statementId);
            continue;
          }
        }

        await ctx.db.patch(document._id as Id<LegacyTable>, {
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
