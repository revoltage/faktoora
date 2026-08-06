/**
 * Format a YYYY-MM month key like "2026-03" as a human-readable string
 * (e.g. "March 2026").
 */
export function formatMonthDisplay(monthKey: string): string {
 const [year, month] = monthKey.split("-");
 const date = new Date(parseInt(year), parseInt(month) - 1);
 return date.toLocaleDateString("en-US", { year: "numeric", month: "long" });
}

/** Returns the `YYYY-MM` month key the given date falls in. */
export function monthKeyOf(date: Date): string {
 return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/** Returns the current month as a YYYY-MM string. */
export function currentMonthKey(now: Date = new Date()): string {
 return monthKeyOf(now);
}

/**
 * Month key of a parsed invoice date (nominally `YYYY-MM-DD`), or `null` when
 * the value cannot be placed in a month. A valid `YYYY-MM` prefix is trusted
 * verbatim so a timezone shift can never move an invoice into a neighbouring
 * month; anything else falls back to `Date` parsing.
 */
export function monthKeyOfInvoiceDate(value: string): string | null {
 const prefix = value.slice(0, 7);
 if (isMonthKey(prefix)) return prefix;

 const parsed = new Date(value);
 return Number.isNaN(parsed.getTime()) ? null : monthKeyOf(parsed);
}

const MONTH_KEY_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/** True if the given string is a valid `YYYY-MM` month key. */
export function isMonthKey(value: string): boolean {
 return MONTH_KEY_RE.test(value);
}

/**
 * Extract the month key from `window.location.pathname`. Falls back to the
 * month before `now` when the path is `/`, empty, or not a valid `YYYY-MM`:
 * the month people reconcile invoices for is the one that just closed.
 */
export function monthKeyFromPath(
 pathname: string = window.location.pathname,
 now: Date = new Date(),
): string {
 const candidate = pathname.replace(/^\//, "");
 return isMonthKey(candidate)
  ? candidate
  : currentMonthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1));
}
