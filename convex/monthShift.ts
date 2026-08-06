import { v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { internalMutation, internalQuery } from "./_generated/server";

/**
 * One-off repair for month-shifted bookkeeping data.
 *
 * Landing on `/` used to default the invoice month to the CURRENT month, but
 * the month people reconcile is the one that just closed, so every session
 * filed its uploads one month late. Fixed in the client by `90f0c2a`; this
 * module repairs the data the old default already misfiled.
 *
 * Nothing here reconstructs anything: every month-scoped table carries a flat
 * `monthKey`, and all cross-links (`transactionId`, `invoiceStorageId`) are
 * month-local, so a shift is a relabel of one field. Storage blobs, document
 * ids and audit timestamps (`uploadedAt` / `boundAt` / `createdAt`) are left
 * alone -- the latter record when the work was done, which is accurate.
 *
 * The affected months are NOT hardcoded. `inspectMonthShift` reports, per
 * month, the bank's own `dateCompleted` values; a month whose transactions are
 * dated one month back is shifted, one whose dates agree with its key is not.
 * Runbook, in order:
 *
 *   npx convex export --prod --include-file-storage --path <backup>.zip
 *   npx convex run --prod monthShift:inspectMonthShift
 *   npx convex run --prod monthShift:shiftMonthsBack '{"userId":"…","months":[…],"apply":false}'
 *   npx convex run --prod monthShift:shiftMonthsBack '{"userId":"…","months":[…],"apply":true}'
 *   npx convex run --prod monthShift:flagMergedDuplicates '{"userId":"…","monthKey":"…","apply":true}'
 *   npx convex run --prod monthShift:inspectMonthShift
 *
 * A shift is its own inverse: re-running with the shifted months moves them
 * forward again, so the snapshot import is only needed if this module itself
 * misbehaves. Delete this module once a deployment inspects clean.
 */

const MONTH_TABLES = [
 "incomingInvoices",
 "statements",
 "statementTransactions",
 "transactionInvoiceBindings",
 "manualTransactions",
] as const;

type MonthTable = (typeof MONTH_TABLES)[number];

/**
 * The month before `monthKey`. Deriving the target rather than accepting it
 * removes the operator's ability to typo a destination.
 */
export function previousMonthKey(monthKey: string): string {
 const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(monthKey);
 if (!match) {
  throw new Error(`Not a YYYY-MM month key: ${monthKey}`);
 }

 const year = Number(match[1]);
 const month = Number(match[2]);
 return month === 1
  ? `${year - 1}-12`
  : `${year}-${String(month - 1).padStart(2, "0")}`;
}

/**
 * Keys that must stay unique within a month, so a merge into an occupied month
 * can be refused before it happens.
 *
 * `statementTransactions` is deliberately absent: a Revolut EXCHANGE emits a
 * debit and a credit leg sharing one transaction id, so same-month duplicates
 * are legal there (47 such pairs already exist in prod). Its rows move as a
 * set keyed by `statementId`, which is unique per upload.
 *
 * `incomingInvoices.fileHash` is absent for the same reason: re-uploading a
 * file is a first-class case the app models with `isDuplicate`, not a conflict.
 */
function identityKeys(table: MonthTable, doc: Doc<MonthTable>): string[] {
 switch (table) {
  case "incomingInvoices": {
   const invoice = doc as Doc<"incomingInvoices">;
   return [`invoiceId:${invoice.invoiceId}`, `storageId:${invoice.storageId}`];
  }
  case "statements": {
   const statement = doc as Doc<"statements">;
   return [
    `statementId:${statement.statementId}`,
    `storageId:${statement.storageId}`,
    ...(statement.fileHash ? [`fileHash:${statement.fileHash}`] : []),
   ];
  }
  case "transactionInvoiceBindings": {
   const binding = doc as Doc<"transactionInvoiceBindings">;
   return [`transactionId:${binding.transactionId}`];
  }
  default:
   return [];
 }
}

function monthQuery(
 ctx: QueryCtx | MutationCtx,
 table: MonthTable,
 userId: Id<"users">,
 monthKey: string,
) {
 return ctx.db
  .query(table)
  .withIndex("by_user_and_month", (q) =>
   q.eq("userId", userId).eq("monthKey", monthKey),
  );
}

function monthKeyOfTransaction(row: Doc<"statementTransactions">): string {
 const raw = row.transaction.dateCompleted || row.transaction.dateStarted;
 return raw ? raw.slice(0, 7) : "unknown";
}

/**
 * Read-only. Per month: what is filed there, and what the bank says it is.
 *
 * `transactionDates` is the oracle. Read it as DOMINANCE, not exclusivity: a
 * statement legitimately carries a few completions that settled either side of
 * the month boundary. A month with no CSV statement has no oracle at all and
 * must be judged by `statementFiles`, whose Revolut names embed the period.
 */
export const inspectMonthShift = internalQuery({
 args: {},
 handler: async (ctx) => {
  const statements = await ctx.db.query("statements").collect();
  const invoices = await ctx.db.query("incomingInvoices").collect();
  const transactions = await ctx.db.query("statementTransactions").collect();
  const bindings = await ctx.db
   .query("transactionInvoiceBindings")
   .collect();
  const manual = await ctx.db.query("manualTransactions").collect();

  const keys = new Map<string, Set<string>>();
  for (const doc of [
   ...statements,
   ...invoices,
   ...transactions,
   ...bindings,
  ]) {
   const seen = keys.get(doc.userId) ?? new Set<string>();
   seen.add(doc.monthKey);
   keys.set(doc.userId, seen);
  }

  const months = [];
  for (const [userId, monthKeys] of keys) {
   for (const monthKey of [...monthKeys].sort()) {
    const inMonth = <T extends { userId: Id<"users">; monthKey?: string }>(
     docs: T[],
    ) => docs.filter((d) => d.userId === userId && d.monthKey === monthKey);

    const transactionDates: Record<string, number> = {};
    for (const row of inMonth(transactions)) {
     const bucket = monthKeyOfTransaction(row);
     transactionDates[bucket] = (transactionDates[bucket] ?? 0) + 1;
    }

    months.push({
     userId,
     monthKey,
     expectedIfShifted: previousMonthKey(monthKey),
     transactionDates,
     counts: {
      statements: inMonth(statements).length,
      invoices: inMonth(invoices).length,
      transactions: inMonth(transactions).length,
      bindings: inMonth(bindings).length,
      manualTransactions: inMonth(manual).length,
     },
     statementFiles: inMonth(statements).map((s) => s.fileName),
    });
   }
  }

  return { months };
 },
});

/**
 * Relabel every month-scoped document from each month in `months` to the month
 * before it. `apply: false` reports the same plan without writing.
 *
 * Two properties make this safe to run against real books:
 *
 *   - Sources for every shift are collected BEFORE any patch, so the result
 *     does not depend on evaluation order or on reads seeing earlier writes.
 *   - Convex mutations are transactions, so a refusal anywhere leaves the
 *     whole set of months untouched; there is no half-shifted state to unpick.
 *
 * Months are processed ascending so a month never lands on one that is itself
 * still awaiting its shift.
 */
export const shiftMonthsBack = internalMutation({
 args: {
  userId: v.id("users"),
  months: v.array(v.string()),
  apply: v.boolean(),
 },
 handler: async (ctx, args) => {
  const sources = [...new Set(args.months)].sort();
  const shifts = sources.map((from) => ({
   from,
   to: previousMonthKey(from),
  }));

  const planned = [];
  for (const { from, to } of shifts) {
   const docs = {} as Record<MonthTable, Doc<MonthTable>[]>;
   for (const table of MONTH_TABLES) {
    docs[table] = await monthQuery(ctx, table, args.userId, from).collect();
   }
   planned.push({ from, to, docs });
  }

  // Refuse a merge that would collide with a document already sitting in the
  // target month. Documents leaving that month in this same run do not count
  // as occupants -- they are moving out.
  for (const { from, to, docs } of planned) {
   for (const table of MONTH_TABLES) {
    const staying = (
     await monthQuery(ctx, table, args.userId, to).collect()
    ).filter((doc) => !sources.includes(doc.monthKey ?? ""));

    const occupied = new Set(
     staying.flatMap((doc) => identityKeys(table, doc)),
    );
    for (const doc of docs[table]) {
     for (const key of identityKeys(table, doc)) {
      if (occupied.has(key)) {
       throw new Error(
        `Refusing ${from} -> ${to}: ${table} already holds ${key} in ${to}`,
       );
      }
     }
    }
   }
  }

  const moved: Record<string, Record<string, number>> = {};
  for (const { from, to, docs } of planned) {
   const perTable: Record<string, number> = {};
   for (const table of MONTH_TABLES) {
    const batch = docs[table];
    perTable[table] = batch.length;
    if (!args.apply) continue;
    for (const doc of batch) {
     await ctx.db.patch(doc._id, { monthKey: to });
    }
   }
   moved[`${from} -> ${to}`] = perTable;
  }

  return { applied: args.apply, moved };
 },
});

/**
 * Flag same-file invoices that a merge brought into one month.
 *
 * The upload path marks the LATER copy as the duplicate, because at upload
 * time the earlier one is necessarily the one in use. That rule inverts here:
 * a merge can carry in a copy that is already BOUND to a transaction while the
 * copy that was sitting in the month is an unbound leftover. The bound copy is
 * the one in use, so it stays canonical regardless of upload order.
 *
 * Nothing is deleted and `storageId` is never rewritten: a binding references
 * it, and the blob is shared. The flagged copy simply becomes visible as a
 * duplicate in the UI, where it can be removed by hand.
 */
export const flagMergedDuplicates = internalMutation({
 args: {
  userId: v.id("users"),
  monthKey: v.string(),
  apply: v.boolean(),
 },
 handler: async (ctx, args) => {
  // Literal table names here, so both rows keep their exact document type.
  const invoices = await ctx.db
   .query("incomingInvoices")
   .withIndex("by_user_and_month", (q) =>
    q.eq("userId", args.userId).eq("monthKey", args.monthKey),
   )
   .collect();
  const bindings = await ctx.db
   .query("transactionInvoiceBindings")
   .withIndex("by_user_and_month", (q) =>
    q.eq("userId", args.userId).eq("monthKey", args.monthKey),
   )
   .collect();

  const boundStorageIds = new Set(
   bindings
    .map((binding) => binding.invoiceStorageId)
    .filter(
     (storageId): storageId is Id<"_storage"> =>
      storageId !== null && storageId !== "NOT_NEEDED",
    ),
  );

  const byHash = new Map<string, Doc<"incomingInvoices">[]>();
  for (const invoice of invoices) {
   if (!invoice.fileHash) continue;
   byHash.set(invoice.fileHash, [
    ...(byHash.get(invoice.fileHash) ?? []),
    invoice,
   ]);
  }

  const flagged = [];
  for (const [fileHash, copies] of byHash) {
   if (copies.length < 2) continue;

   const rank = (invoice: Doc<"incomingInvoices">) =>
    boundStorageIds.has(invoice.storageId) ? 0 : 1;
   const ordered = [...copies].sort(
    (a, b) => rank(a) - rank(b) || a.uploadedAt - b.uploadedAt,
   );
   const [canonical, ...rest] = ordered;

   for (const duplicate of rest) {
    if (
     duplicate.isDuplicate &&
     duplicate.duplicateOfStorageId === canonical.storageId
    ) {
     continue;
    }
    flagged.push({
     fileHash,
     fileName: duplicate.fileName,
     duplicateOf: canonical.fileName,
     bound: boundStorageIds.has(duplicate.storageId),
    });
    if (args.apply) {
     await ctx.db.patch(duplicate._id, {
      isDuplicate: true,
      duplicateOfStorageId: canonical.storageId,
     });
    }
   }
  }

  return { applied: args.apply, flagged };
 },
});
