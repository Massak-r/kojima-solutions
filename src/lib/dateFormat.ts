// Swiss European date + time formatting helpers. Storage stays ISO; display
// is normalised through these so the same value never rendered differently
// across pages (DD.MM.YYYY vs 5/11/26 vs "5 nov" — pick one per role).

type DateInput = string | Date | null | undefined;

function toDate(value: DateInput): Date | null {
  if (!value) return null;
  // MariaDB DATETIME comes back as "YYYY-MM-DD HH:MM:SS" which Safari refuses
  // to parse — swap the space for a T so new Date() works cross-browser.
  const raw = value instanceof Date ? value : new Date(typeof value === "string" ? value.replace(" ", "T") : value);
  return isNaN(raw.getTime()) ? null : raw;
}

/** Swiss numeric format: 05.11.2026 — the default for stored ISO dates. */
export function formatDateSwiss(value: DateInput, fallback = "-"): string {
  const d = toDate(value);
  if (!d) return fallback;
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}.${month}.${d.getFullYear()}`;
}

/** Swiss long format: 5 mai 2026 (FR) or 5 May 2026 (EN). */
export function formatDateSwissLong(
  value: DateInput,
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

/** Day + short month, no year: "5 nov" — for compact list rows. */
export function formatDateShort(
  value: DateInput,
  lang: "fr" | "en" = "fr",
  fallback = "-",
): string {
  const d = toDate(value);
  if (!d) return fallback;
  return d.toLocaleDateString(lang === "fr" ? "fr-CH" : "en-CH", {
    day: "numeric",
    month: "short",
  });
}

/** Day + short month + year: "5 nov 2026" — for timestamps with year context. */
export function formatDateShortWithYear(
  value: DateInput,
  lang: "fr" | "en" = "fr",
  fallback = "-",
): string {
  const d = toDate(value);
  if (!d) return fallback;
  return d.toLocaleDateString(lang === "fr" ? "fr-CH" : "en-CH", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Weekday + day + month + year: "lundi 5 mai 2026" — for page headers. */
export function formatDateWithWeekday(
  value: DateInput,
  lang: "fr" | "en" = "fr",
  fallback = "-",
): string {
  const d = toDate(value);
  if (!d) return fallback;
  return d.toLocaleDateString(lang === "fr" ? "fr-CH" : "en-CH", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** 24h time: "14:30". */
export function formatTime(value: DateInput, fallback = "-"): string {
  const d = toDate(value);
  if (!d) return fallback;
  return d.toLocaleTimeString("fr-CH", { hour: "2-digit", minute: "2-digit" });
}

/** Compact date + time: "05 nov, 14:30" — for activity logs / comments. */
export function formatDateTime(
  value: DateInput,
  lang: "fr" | "en" = "fr",
  fallback = "-",
): string {
  const d = toDate(value);
  if (!d) return fallback;
  return d.toLocaleString(lang === "fr" ? "fr-CH" : "en-CH", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
