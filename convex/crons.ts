import { cronJobs } from "convex/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { internalMutation } from "./_generated/server";

const DEFAULT_ANONYMOUS_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_CLEANUP_LIMIT = 25;

async function deleteStorageIfPresent(
  ctx: MutationCtx,
  storageId: Id<"_storage">,
  deletedStorageIds: Set<Id<"_storage">>,
) {
  if (deletedStorageIds.has(storageId)) {
    return;
  }

  deletedStorageIds.add(storageId);
  try {
    await ctx.storage.delete(storageId);
  } catch (error) {
    console.warn("Anonymous cleanup could not delete storage object", error);
  }
}

export const cleanupAnonymousUsers = internalMutation({
  args: {
    olderThanMs: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const cutoff = Date.now() - (args.olderThanMs ?? DEFAULT_ANONYMOUS_TTL_MS);
    const users = await ctx.db
      .query("users")
      .take(args.limit ?? DEFAULT_CLEANUP_LIMIT);
    let deletedUsers = 0;

    for (const user of users) {
      if (!user.isAnonymous || user._creationTime >= cutoff) {
        continue;
      }

      const userId = user._id;
      const [
        invoices,
        statements,
        bindings,
        statementTransactions,
        manualTransactions,
        settings,
      ] = await Promise.all([
        ctx.db
          .query("incomingInvoices")
          .withIndex("by_user_and_month", (q) => q.eq("userId", userId))
          .collect(),
        ctx.db
          .query("statements")
          .withIndex("by_user_and_month", (q) => q.eq("userId", userId))
          .collect(),
        ctx.db
          .query("transactionInvoiceBindings")
          .withIndex("by_user_and_month", (q) => q.eq("userId", userId))
          .collect(),
        ctx.db
          .query("statementTransactions")
          .withIndex("by_user_and_month", (q) => q.eq("userId", userId))
          .collect(),
        ctx.db
          .query("manualTransactions")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .collect(),
        ctx.db
          .query("userSettings")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .collect(),
      ]);

      const deletedStorageIds = new Set<Id<"_storage">>();
      for (const invoice of invoices) {
        await deleteStorageIfPresent(ctx, invoice.storageId, deletedStorageIds);
      }
      for (const statement of statements) {
        await deleteStorageIfPresent(
          ctx,
          statement.storageId,
          deletedStorageIds,
        );
      }

      for (const row of statementTransactions) {
        await ctx.db.delete(row._id);
      }
      for (const binding of bindings) {
        await ctx.db.delete(binding._id);
      }
      for (const invoice of invoices) {
        await ctx.db.delete(invoice._id);
      }
      for (const statement of statements) {
        await ctx.db.delete(statement._id);
      }
      for (const transaction of manualTransactions) {
        await ctx.db.delete(transaction._id);
      }
      for (const setting of settings) {
        await ctx.db.delete(setting._id);
      }
      await ctx.db.delete(userId);
      deletedUsers += 1;
    }

    return { deletedUsers };
  },
});

const crons = cronJobs();

crons.interval(
  "cleanup anonymous users",
  { hours: 24 },
  internal.crons.cleanupAnonymousUsers,
  {},
);

export default crons;
