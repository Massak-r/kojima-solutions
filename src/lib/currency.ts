// Swiss number formatting. Single source of truth so amounts render the
// same way (1'500) whether they come from a client proposal, a phase
// budget, or a project module preview. Callers append " CHF" themselves
// when they need it, so this composes cleanly with surrounding labels
// ("Estimation : CHF 1'500" vs "Total : 1'500 CHF").

/**
 * Format a number with the Swiss apostrophe thousands separator.
 * Returns "1'500" — the bare amount, no currency suffix.
 * Use this everywhere CHF amounts surface; the "CHF" symbol is the
 * caller's call (prefix, suffix, separate span, etc.).
 *
 * The native Intl output uses a thin-space for grouping; we normalise to
 * the conventional Swiss apostrophe so all tabular numbers line up.
 */
export function formatChf(value: number | null | undefined, decimals = 0): string {
  const n = typeof value === "number" && !isNaN(value) ? value : 0;
  return new Intl.NumberFormat("fr-CH", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals === 0 ? 2 : decimals,
  }).format(n).replace(/(?<=\d)[\s ](?=\d)/g, "'");
}
