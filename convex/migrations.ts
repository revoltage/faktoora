import { Migrations } from "@convex-dev/migrations";
import { components, internal } from "./_generated/api.js";
import type { DataModel } from "./_generated/dataModel.js";
import { backfillNormalizedMonth } from "./normalizedMonthStore";

export const migrations = new Migrations<DataModel>(components.migrations);

export const backfillMonthsToNormalized = migrations.define({
  table: "months",
  batchSize: 10,
  migrateOne: async (ctx, month) => {
    await backfillNormalizedMonth(ctx, month, Date.now());
  },
});

export const run = migrations.runner();

export const runAll = migrations.runner([
  internal.migrations.backfillMonthsToNormalized,
]);
