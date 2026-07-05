# Faktoora — Project Review & Ticket Backlog

Date: 2026-07-05
Reviewed at: `main` (working tree had one unstaged `.gitignore` change)
Method: static inspection of all application code, configs, and scripts. No build/test/deploy commands were run.

---

## Part 1 — Review

### 1.1 What this project is

A single-workspace SPA (React 19 + Vite 6 + Tailwind/shadcn) on a Convex backend, for managing one business's monthly accounting flow: upload Revolut statements (CSV/PDF) and incoming invoices (PDF/images), auto-extract invoice metadata via LLMs, bind transactions to invoices, check VAT presence, and draft a Bulgarian-language handoff email for the accountant. Deployment: Vercel (static SPA) + Convex cloud (`elegant-grasshopper-918`).

### 1.2 What the approach gets right

- **The normalized-store migration was done properly.** Legacy `months` docs (arrays-in-a-document) were replaced by per-entity tables (`incomingInvoices`, `statements`, `transactionInvoiceBindings`) with real indexes. Crucially, the migration has *verification tooling*: `monthMigration.ts` computes count parity + legacy-key parity per month, and `scripts/migrate-normalized-months.sh` exits non-zero if `!allHealthy`. That's more operational rigor than most side projects ever get. All live reads/writes go through the normalized tables; the legacy table is only read by migration checks.
- **Feature flags as cost kill-switches.** Both LLM analysis and classic parsing are gated behind flags that default to OFF, and disabled runs write an explicit "disabled" state into the invoice rather than leaving it in limbo. Good failure legibility.
- **Sensible dedup on upload.** Client computes SHA-256, server matches `fileHash` within the user/month, reuses the source `storageId`, copies analysis/parsing, deletes the redundant blob, and skips re-running the (paid) AI pipeline. Duplicate rows stay visible with a badge and are excluded from month totals. This is exactly the right shape for the problem.
- **Pure, testable domain logic exists.** `refundMatching.ts`, `invoiceMatching.ts`, `parseCsvTransactions`, `dateFormat.ts`, `currency.ts` are all side-effect-free and isolated. Nothing tests them (see below), but the seams are there.
- **Per-field analysis results.** `{value, error, lastUpdated}` per extracted field (date/sender/amount/text) lets the UI show granular progress/errors instead of one opaque "analysis failed". The four extractions run in parallel and each commits its own mutation — partial success is preserved.
- **Pragmatic scope control.** No router dependency for a two-page app (History API month paths), mutations passed as props, no state-management library. Correct instincts for this size.

### 1.3 Where the approach is fragile

**Security posture is the weakest area.**

1. `featureFlags.setFeatureFlag` is a **public mutation with no auth check** (`convex/featureFlags.ts:55-82`). Flags are also **global**, not per-user. Anyone who discovers the deployment URL can enable `invoiceAnalysis` for every user and burn LLM credits, or disable features. The frontend even advertises the mechanism (`window.__setFeatureFlag` + console instructions) in production builds.
2. **Anonymous auth is enabled** (`convex/auth.ts`), which README explicitly flags as a pre-production decision. Combined with (1) and open uploads, an anonymous visitor can store arbitrary blobs and (once flags are on) trigger paid AI calls. There is no cleanup of orphaned anonymous users/data.
3. `getAllFeatureFlags` / `getFeatureFlag` are public unauthenticated reads — minor, but part of the same surface.

**The migration-era scaffolding never got retired.** Every *new* insert still fabricates a `legacyKey` via `buildScopedLegacyKey` (`invoices.ts:150,213,612`), so brand-new documents are permanently coupled to migration bookkeeping. `months`, `monthMigration.ts`, `migrations.ts`, the two unused public migration queries, and `migrateInvoiceNames` all remain. The migration verified clean — the payoff (deleting the old world) hasn't been collected, and it's now the single biggest source of incidental complexity in the backend.

**Type safety was deliberately switched off in the layer that needs it most.** `normalizedMonthStore.ts` types context as `{ db: any }`; `monthMigration.ts` uses `ctx: any`; ESLint has all `no-unsafe-*` rules and `no-explicit-any` off, and the `lint` script doesn't even run ESLint. Strict `tsc` still runs, but `any`-typed `ctx.db` means index names, table names, and doc shapes in the entire store layer are unchecked — precisely the code that owns data integrity.

**Silent-drift risks in parsing:**
- `parseCsvTransactions` reads the CSV header row and then **ignores it**, mapping by fixed column position (`monthData.ts:206-254`). A Revolut export format change silently shuffles fields (e.g. `amount` ← `paymentCurrency`) rather than failing.
- Manual transactions get IDs `manual_transaction_${index}` (`normalizedMonthStore.ts:475`). Bindings are keyed by transaction ID, so **editing/reordering the manual-transactions textarea silently re-points existing bindings at different lines**.
- LLM amount extraction relies on the model emitting `amount|currency` exactly; any deviation degrades to `null` without distinction from "no amount on invoice".

**Overwrite bug:** `updateInvoiceSender` sets `name: args.sender.value || invoice.name` (`invoices.ts:378`). If the user renames an invoice while analysis is still running, the async sender result clobbers the manual rename.

**Cost shape of the AI pipeline:** every non-duplicate upload fires **4 separate LLM calls** (date, sender, full text, amount) over the same file bytes, plus a classic pdf-parse run whose output overlaps the AI full-text extraction. One structured-output call would extract all four fields at ~¼ the cost and remove the fragile `amount|currency` string protocol.

**Convex-guideline deviations worth knowing about** (the repo ships its own `convex_rules` that call these out):
- Statement docs embed the full transaction array (`statements.transactions`) — bounded by one month of Revolut activity, but a busy month walks toward the 1 MB doc limit and every binding-irrelevant patch rewrites the array.
- `.collect()` everywhere (fine at personal scale, but `getLastUser`/`getLatestUserMigrationReportInternal` collect **all users** and pick `users[len-1]` — the prod migration verifier only ever checks the most recently created user).
- `auth.loggedInUser`, `seed.getLastUser`, `seedFeatureFlags` lack args validators.

**Housekeeping drift:**
- Identity split: package `flex-template` vs UI `Faktoora` vs README `Invoice Manager App`.
- pnpm lockfile, but npm-style scripts and no `packageManager` pin.
- `lint` = `tsc ×2 && convex dev --once && vite build`: not a lint (ESLint configured but never invoked, Prettier installed but unconfigured), requires deployment credentials, and is CI-hostile. No tests, no CI, no hooks.
- Dependency bloat: `openai` (imported nowhere — `@ai-sdk/openai` is the one used), `recharts`, `react-hook-form`, `@hookform/resolvers`, `embla-carousel-react`, `vaul`, `cmdk`, `input-otp`, `react-day-picker`, `react-resizable-panels`, `next-themes`, `date-fns` are imported only by unused shadcn `ui/*` files (or not at all). ~44 ui components shipped, ~11 actually used by app code.
- `index.html` references `/og-preview.png`; the file doesn't exist in `public/`.
- Hard-coded personal data in source: `transactionHelperLinks.ts` (vendor billing URLs, LinkedIn account ID, Gmail user index), Bulgarian email template in `EmailDraft.tsx`, EUR/USD rate frozen at Feb-2026 in `currency.ts` (BGN is pegged, USD drifts).
- Dev-tool remnants: Chef `inject-chef-dev` plugin loads remote JS from `chef.convex.dev` in dev; `setup.mjs` and `seed-mock-data.mjs` are not wired into any script; `TODO.md` item "Handle entirely identical files as duplicates / reuse same storage id / mark as duplicate" is already largely implemented (stale backlog).

**Small UX/correctness nits:** binding failures in `TransactionInvoiceBindingModal.handleBind` only `console.error` (no toast); per-invoice delete (X button) has no confirm while Delete-All does; `updateInvoiceName` throws misleading "Month data not found"; `TransactionList` uses array index in React keys; `deleteAllStatements` also wipes bindings of *manual* transactions.

### 1.4 Verdict on the approach

The core product design is sound and appropriately small: normalized per-entity tables, reactive queries, flag-gated paid features, dedup-by-hash, pure domain helpers. The two structural debts are (a) an un-retired migration that still taxes every new write, and (b) a trust model that hasn't caught up with the app being publicly reachable (public flag mutation + anonymous signup + prod debug hooks). The rest is finishable hygiene: type the store layer, test the pure logic, make `lint` mean lint, prune the template fat.

---

## Part 2 — Ticket backlog

Priorities: **P0** security/data-loss · **P1** correctness bugs · **P2** structural debt · **P3** hygiene/UX. Effort: S (<½ day) · M (½–1 day) · L (multi-day).

### P0 — Security

**FKT-001 · Lock down feature flags** — P0 · S
`convex/featureFlags.ts`: `setFeatureFlag` (public mutation) has no auth check; flags are global.
- Convert `setFeatureFlag` to require auth at minimum; preferably restrict to an allowlisted admin user ID (env var) or move it to `internalMutation` + set flags via `npx convex run`.
- Decide: are flags global ops switches (then internal-only) or per-user preferences (then add `userId` to the table)? Current usage (cost control for AI) suggests global + internal-only.
- Accept: unauthenticated/non-admin `setFeatureFlag` calls are rejected; existing reads unchanged.

**FKT-002 · Decide anonymous-auth policy** — P0 · S
`convex/auth.ts` ships `Anonymous` provider; README marks this as a pre-production default. Anonymous users can upload blobs and (flags permitting) trigger LLM spend.
- Either remove the `Anonymous` provider, or keep guest mode but gate `generateUploadUrl`/`addIncomingInvoice`/`addStatement` on non-anonymous accounts, or add per-user quotas.
- Accept: documented decision + code matches it.

**FKT-003 · Strip prod debug hooks** — P0 · S
`src/hooks/useFeatureFlags.ts` exposes `window.__setFeatureFlag`/`__getFeatureFlags` and logs usage instructions in every prod session.
- Wrap the hook body in `if (import.meta.env.DEV)` or delete it once FKT-001 makes it useless.
- Accept: prod bundle sets no window globals, no flag console logs.

### P1 — Correctness

**FKT-004 · Sender analysis clobbers manual rename** — P1 · S
`convex/invoices.ts:364-386` `updateInvoiceSender` writes `name: args.sender.value || invoice.name`.
- Only set `name` from sender if the current name still equals the initial default (`getFileNameWithoutExtension(fileName)`), or track a `nameSource: "auto" | "user"` field.
- Accept: renaming during in-flight analysis survives analysis completion.

**FKT-005 · Stable IDs for manual transactions** — P1 · M
`normalizedMonthStore.ts:459-512` assigns `manual_transaction_${index}`; bindings are keyed by that ID, so textarea edits re-point bindings.
- Derive ID from line content (e.g. hash of `name|amount`) with a dedup suffix for identical lines, or store manual transactions as structured rows instead of a free-text blob (ties into FKT-017).
- Accept: adding/removing a line does not change binding association of other lines; a test proves it.

**FKT-006 · Header-driven CSV mapping** — P1 · M
`monthData.ts:206-254` parses Revolut CSV by fixed column positions while ignoring the header row it already reads.
- Build a header-name → field map; on missing/unknown expected headers, record a visible parse warning on the statement (or refuse with a clear error) instead of silently mis-mapping.
- Accept: a column-reordered fixture parses correctly; a fixture missing `Amount` fails loudly. Unit tests included.

**FKT-007 · Migration verifier checks all users** — P1 · S
`monthMigration.ts:72-83` `getLatestUserMigrationReportInternal` verifies only `users[users.length-1]`; the prod migrate script relies on it.
- Iterate all users (or accept an explicit `userId` arg in the script); aggregate `allHealthy` across users.
- Accept: script fails if *any* user's months are unhealthy. (May be mooted by FKT-010 — do this only if another migration run is ever needed.)

**FKT-008 · Surface binding errors; fix misleading error** — P1 · S
`TransactionInvoiceBindingModal.tsx:57-59` swallows bind failures into `console.error`; `invoices.ts:433` throws "Month data not found" when an *invoice* is missing.
- Add `toast.error` on bind failure; change message to "Invoice not found".
- Accept: failed bind visibly notifies; error text matches the entity.

**FKT-009 · Statement re-upload dedup** — P1 · S
`addStatement` has no duplicate detection; re-uploading the same CSV stacks statement docs and orphan-prone blobs (merged view hides it because transactions dedup by ID).
- Reuse the invoice pattern: hash CSV content (or compare fileName+size), mark/skip duplicates.
- Accept: uploading the same CSV twice yields one statement doc or a visibly-marked duplicate, not silent double storage.

### P2 — Structural debt

**FKT-010 · Retire the legacy months pipeline** — P2 · L
Migration verified; the old world still taxes every write.
- Sequence: (1) run final verification (`migrate:normalized:prod`), export/backup `months`; (2) stop writing `legacyKey` on new inserts — make the field optional-legacy; (3) delete `months` table from schema, `monthMigration.ts`, `migrations.ts`, `migrateInvoiceNames`, the `by_legacy_key` indexes, `buildScopedLegacyKey`/`buildInvoiceLegacyKey`/`buildStatementLegacyKey`/`buildBindingLegacyKey`, `upsert*FromLegacy`, `backfillNormalizedMonth`, the two migrate npm scripts and shell script; (4) drop `legacy*` validators from `monthData.ts` and `legacyMonthId`/`migratedAt` from normalized validators.
- Accept: no `legacy` identifier remains outside git history; `tsc` and `convex dev --once` pass; app behavior unchanged.

**FKT-011 · Type the store layer** — P2 · M
`normalizedMonthStore.ts` `DbCtx = { db: any }`; `monthMigration.ts` `ctx: any`; repo's own convex rules forbid `any` ctx.
- Use `QueryCtx`/`MutationCtx` from `_generated/server` (reads accept `QueryCtx`, writes require `MutationCtx`); delete the `(q: any)` index-callback annotations that follow.
- Accept: zero `any` in `convex/` outside `_generated`; table/index typos become compile errors.

**FKT-012 · Consolidate AI extraction into one structured call** — P2 · M
`invoiceAnalysis.ts` runs 4 LLM calls per invoice with string-protocol outputs (`amount|currency`, literal "null").
- Replace with a single `generateObject`-style call (AI SDK structured output with zod schema: `{date, sender, amount: {value, currency}, fullText}`), keep per-field `{value,error,lastUpdated}` persistence, keep partial-failure semantics via nullable schema fields.
- Optional: skip the AI `fullText` extraction when classic pdf-parse already yielded text (VAT check reads both anyway).
- Accept: one provider call per invoice; amount stored structured (or the `|` format produced by code, not the model); disabled-flag behavior unchanged.

**FKT-013 · Real lint/format/test scripts + CI** — P2 · M
`lint` is typecheck+codegen+build in a trenchcoat; ESLint/Prettier configured-but-dead; no CI.
- Scripts: `typecheck` (tsc ×2), `lint` (eslint), `format`/`format:check` (prettier), `test` (vitest), keep `build`. Move `convex dev --once` out of anything CI needs (or use `convex codegen`-only path with a deploy-key-gated job).
- GitHub Actions: pnpm install → typecheck → lint → test → build.
- Accept: CI green on main; `pnpm lint` runs ESLint and passes (fix or explicitly downgrade findings).

**FKT-014 · Test harness for pure domain logic** — P2 · M
Zero tests despite pure functions carrying the money math.
- `vitest` (+ `convex-test` later if wanted). First targets: `parseCsvTransactions`/`parseCsvLine` (quoted fields, format drift per FKT-006), `refundMatching` (multi-match picks latest-before-refund; no double-claim), `invoiceMatching.calculateMatchScore` (weights, thresholds), `currency.parseInvoiceAmount`/`toEur`, `dateFormat.isMonthKey/monthKeyFromPath`, `EmailDraft.createEmailContent` grouping (extract it from the component to make it importable).
- Accept: suite runs in CI; the FKT-005/006 regressions have covering tests.

**FKT-015 · Pin the toolchain identity** — P2 · S
- `package.json`: `"name": "faktoora"`, add `"packageManager": "pnpm@<version>"`, add `engines.node`.
- Align README wording (npm vs pnpm) and app naming (Faktoora everywhere).
- Accept: fresh clone + `pnpm i && pnpm dev` documented and working; no `flex-template` remains.

**FKT-016 · Dependency & template prune** — P2 · M
- Remove: `openai` (unused; `@ai-sdk/openai` is the real one), and the shadcn-only deps if their ui files go: `recharts`, `react-hook-form`, `@hookform/resolvers`, `embla-carousel-react`, `vaul`, `cmdk`, `input-otp`, `react-day-picker`, `react-resizable-panels`, `next-themes`, `date-fns` (verify each with a final grep).
- Delete unused `src/components/ui/*` (keep: button, card, badge, dialog, alert-dialog, input, label, select, textarea, separator, tabs + their internal deps); delete `ui/sonner.tsx` (App imports `sonner` directly) and `use-mobile`/`sidebar` if unused.
- Remove Chef leftovers if no longer developing in Chef: `inject-chef-dev` plugin in `vite.config.ts`, `setup.mjs`.
- Accept: build passes; bundle has no references to removed packages; lockfile shrinks.

**FKT-017 · Manual transactions as structured data** — P2 · M
One free-text blob in `userSettings.manualTransactions`, re-parsed on every merged-transactions query; TODO already wants "always hard-coded transaction".
- New table `manualTransactions { userId, monthKey?, name, amount, currency?, recurring: boolean }`; CRUD in settings UI; merge into `getMergedTransactionsFromNormalized` with stable `_id`-based transaction IDs (fixes FKT-005 properly); support recurring entries applied to every month.
- Accept: existing blob migrated or manually re-entered; bindings stable across edits; recurring entry shows in each month.

### P3 — Hygiene / UX

**FKT-018 · Currency rates configurable** — P3 · S
`currency.ts` hard-codes USD@1.18 (BGN peg is fine). Store rates in `userSettings` or fetch monthly (ECB) with the hard-coded values as fallback; show the rate date in the MonthSummary tooltip.

**FKT-019 · Move helper links to user data** — P3 · S
`transactionHelperLinks.ts` hard-codes personal vendor URLs (LinkedIn account ID, Gmail `u/0`) in the repo. Move to a `userSettings`-backed list (keyword → URL) with the current list as seed; keep the Gmail-search fallback.

**FKT-020 · Delete-flow polish** — P3 · S
Add confirm (or undo-toast) to the per-invoice X delete (`InvoiceList.tsx:529-544`); warn in the Delete-All-Statements dialog that all bindings for the month (incl. manual) are removed; stop using array index in `TransactionList` row keys.

**FKT-021 · Fix or drop `og-preview.png`** — P3 · S
`index.html` references `/og-preview.png`; file absent from `public/`. Add the asset or remove the tag.

**FKT-022 · Add args validators to remaining functions** — P3 · S
`auth.loggedInUser`, `seed.getLastUser`, `seed.seedFeatureFlags` lack `args: {}` validators (repo's convex rules require them). Mechanical fix.

**FKT-023 · Statement transactions out of the statement doc** — P3 · M
`statements.transactions` array rides the 1 MB doc limit and rewrites wholesale on any patch. If months grow (or FKT-017 lands), move rows to a `statementTransactions` table keyed by `statementId`. Defer until a real month approaches the limit — measure first (`statement.transactions.length` and doc size in dashboard).

**FKT-024 · Orphaned-data cleanup for anonymous users** — P3 · M
If guest mode survives FKT-002: cron to delete anonymous users (and their invoices/statements/bindings/storage) after N days of inactivity. Skip entirely if anonymous auth is removed.

**FKT-025 · Refresh TODO.md** — P3 · S
Remove the already-implemented duplicate-handling items; fold the remaining ones (image parsing/OCR, invoice item-list analysis, UI moves) into this backlog or delete the file.

### Suggested order

1. FKT-001..003 (one sitting — closes the exposure)
2. FKT-004, 008 (small bug fixes)
3. FKT-013 + 014 (harness first so everything after ships with tests)
4. FKT-005, 006, 009 (parsing/binding correctness, now testable)
5. FKT-010 + 011 (the big cleanup, followed by typing the survivors)
6. FKT-012, 015, 016, 017
7. P3 batch opportunistically.
