// Swiss European date formatting helpers. Storage stays ISO; display is DD.MM.YYYY.

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

/** Swiss numeric format: 05.11.2026 */
export function formatDateSwiss(value: string | Date | null | undefined, fallback = "-"): string {
  const d = toDate(value);
  if (!d) return fallback;
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}.${month}.${d.getFullYear()}`;
}

/** Swiss long format: 5 mai 2026 (FR) or 5 May 2026 (EN). */
export function formatDateSwissLong(
  value: string | Date | null | undefined,
  lang: "fr" | "en" = "fr",
  fallback = "-",
): string {
  const d = toDate(value);
  if (!d) return fallback;
  return d.toLocaleDateString(lang === "fr" ? "fr-CH" : "en-CH", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
