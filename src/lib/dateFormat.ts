/**
 * Format a YYYY-MM month key like "2026-03" as a human-readable string
 * (e.g. "March 2026").
 */
export function formatMonthDisplay(monthKey: string): string {
  const [year, month] = monthKey.split("-");
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString("en-US", { year: "numeric", month: "long" });
}

/** Returns the current month as a YYYY-MM string. */
export function currentMonthKey(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

const MONTH_KEY_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/** True if the given string is a valid `YYYY-MM` month key. */
export function isMonthKey(value: string): boolean {
  return MONTH_KEY_RE.test(value);
}

/**
 * Extract the month key from `window.location.pathname`. Falls back to the
 * current month when the path is `/`, empty, or not a valid `YYYY-MM`.
 */
export function monthKeyFromPath(
  pathname: string = window.location.pathname,
): string {
  const candidate = pathname.replace(/^\//, "");
  return isMonthKey(candidate) ? candidate : currentMonthKey();
}
