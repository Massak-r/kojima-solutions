import type { Recurrence } from "@/api/todoSubtasks";

/** A bucket of time the recurrence checkbox can be "done for". */
export type Period =
  | { kind: "day";     date: string /* YYYY-MM-DD */ }
  | { kind: "isoWeek"; year: number; week: number }
  | { kind: "month";   year: number; month: number /* 1-12 */ };

function dateToISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** ISO 8601 week (Monday-based, week 1 contains the first Thursday). */
export function isoWeekOf(d: Date): { year: number; week: number } {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * 24 * 60 * 60 * 1000));
  return { year: date.getUTCFullYear(), week };
}

/** Monday of the given ISO week, in local time. */
export function startOfIsoWeek(year: number, week: number): Date {
  const jan4 = new Date(year, 0, 4);
  const jan4Dow = (jan4.getDay() + 6) % 7;
  const monday = new Date(year, 0, 4 - jan4Dow + (week - 1) * 7);
  return startOfDay(monday);
}

/** Sunday end-of-day of the given ISO week, in local time. */
export function endOfIsoWeek(year: number, week: number): Date {
  const monday = startOfIsoWeek(year, week);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return sunday;
}

/** The current period for a given recurrence, anchored at `today`. */
export function currentPeriodFor(recurrence: Recurrence, today: Date = new Date()): Period {
  if (recurrence === "daily" || recurrence === "weekdays") {
    return { kind: "day", date: dateToISO(today) };
  }
  if (recurrence === "weekly") {
    const w = isoWeekOf(today);
    return { kind: "isoWeek", year: w.year, week: w.week };
  }
  // monthly
  return { kind: "month", year: today.getFullYear(), month: today.getMonth() + 1 };
}

/** Step backward one period (preserves kind). */
export function previousPeriod(p: Period): Period {
  if (p.kind === "day") {
    const [y, m, d] = p.date.split("-").map(Number);
    const prev = new Date(y, m - 1, d - 1);
    return { kind: "day", date: dateToISO(prev) };
  }
  if (p.kind === "isoWeek") {
    const monday = startOfIsoWeek(p.year, p.week);
    monday.setDate(monday.getDate() - 7);
    const w = isoWeekOf(monday);
    return { kind: "isoWeek", year: w.year, week: w.week };
  }
  let year = p.year;
  let month = p.month - 1;
  if (month < 1) { month = 12; year -= 1; }
  return { kind: "month", year, month };
}

/** Does an ISO completion date belong to this period? */
export function dateBelongsToPeriod(iso: string, period: Period): boolean {
  if (period.kind === "day") return iso === period.date;
  const [y, m, d] = iso.split("-").map(Number);
  if (period.kind === "month") return y === period.year && m === period.month;
  const w = isoWeekOf(new Date(y, m - 1, d));
  return w.year === period.year && w.week === period.week;
}

/** True if any of the completion dates falls inside the period. */
export function isPeriodDone(period: Period, completionDates: Iterable<string>): boolean {
  for (const d of completionDates) {
    if (dateBelongsToPeriod(d, period)) return true;
  }
  return false;
}

export function samePeriod(a: Period, b: Period): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "day"   && b.kind === "day")   return a.date === b.date;
  if (a.kind === "isoWeek" && b.kind === "isoWeek") return a.year === b.year && a.week === b.week;
  if (a.kind === "month" && b.kind === "month") return a.year === b.year && a.month === b.month;
  return false;
}

/** The last calendar moment inside the period (used to check if a period
 *  ended before the task was created → "not applicable"). */
export function periodEnd(p: Period): Date {
  if (p.kind === "day") {
    const [y, m, d] = p.date.split("-").map(Number);
    return new Date(y, m - 1, d, 23, 59, 59);
  }
  if (p.kind === "isoWeek") return endOfIsoWeek(p.year, p.week);
  // last day of month
  return new Date(p.year, p.month, 0, 23, 59, 59);
}

const DAY_INITIALS_FR = ["L", "M", "M", "J", "V", "S", "D"];

/** One-glyph label for the cell axis (under the streak grid). */
export function periodShortLabel(period: Period, lang: "fr" | "en" = "fr"): string {
  if (period.kind === "day") {
    const [y, m, d] = period.date.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    const dow = (date.getDay() + 6) % 7;
    return DAY_INITIALS_FR[dow];
  }
  if (period.kind === "isoWeek") return `S${period.week}`;
  const date = new Date(period.year, period.month - 1, 1);
  return date.toLocaleDateString(lang === "fr" ? "fr-CH" : "en-CH", { month: "short" })
    .replace(/\.$/, "");
}

/** Full tooltip label. */
export function periodLongLabel(period: Period, lang: "fr" | "en" = "fr"): string {
  const loc = lang === "fr" ? "fr-CH" : "en-CH";
  if (period.kind === "day") {
    const [y, m, d] = period.date.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString(loc, { weekday: "long", day: "numeric", month: "long" });
  }
  if (period.kind === "isoWeek") {
    const start = startOfIsoWeek(period.year, period.week);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const startStr = start.toLocaleDateString(loc, { day: "numeric", month: "short" });
    const endStr = end.toLocaleDateString(loc, { day: "numeric", month: "short", year: "numeric" });
    return `Semaine ${period.week} · ${startStr} → ${endStr}`;
  }
  const date = new Date(period.year, period.month - 1, 1);
  return date.toLocaleDateString(loc, { month: "long", year: "numeric" });
}

/** "Fait pour aujourd'hui" / "cette semaine" / "ce mois". */
export function donePeriodLabel(recurrence: Recurrence): string {
  if (recurrence === "daily" || recurrence === "weekdays") return "Fait pour aujourd'hui";
  if (recurrence === "weekly") return "Fait pour cette semaine";
  return "Fait pour ce mois";
}

/** Suffix used after the streak count: "5 d'affilée" / "5 semaines d'affilée" / "5 mois d'affilée". */
export function streakSuffix(recurrence: Recurrence, count: number): string {
  if (recurrence === "weekly")  return count > 1 ? "semaines d'affilée" : "semaine d'affilée";
  if (recurrence === "monthly") return count > 1 ? "mois d'affilée" : "mois d'affilée";
  return "d'affilée";
}

/** Short label of the recurrence type for the title pill. */
export function recurrenceShortLabel(recurrence: Recurrence): string {
  if (recurrence === "daily")    return "Quotidien";
  if (recurrence === "weekdays") return "Lun-Ven";
  if (recurrence === "weekly")   return "Hebdo";
  return "Mensuel";
}
