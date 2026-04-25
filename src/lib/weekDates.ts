import { startOfWeek, addDays, format, isSameDay, isBefore, startOfDay } from "date-fns";
import { fr } from "date-fns/locale";

/** Monday-start week beginning for the given date. */
export function getWeekStart(date: Date): Date {
  return startOfWeek(date, { weekStartsOn: 1 });
}

/** 7 consecutive days starting from weekStart (Mon → Sun). */
export function getWeekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

/** YYYY-MM-DD in local time (matches how scheduled_for is stored). */
export function toISODate(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

/** "20 – 26 avr. 2026" (ranges that cross months/years show both sides). */
export function formatWeekRange(weekStart: Date): string {
  const end = addDays(weekStart, 6);
  const sameMonth = weekStart.getMonth() === end.getMonth();
  const sameYear = weekStart.getFullYear() === end.getFullYear();
  if (sameMonth) {
    return `${format(weekStart, "d", { locale: fr })} – ${format(end, "d MMM yyyy", { locale: fr })}`;
  }
  if (sameYear) {
    return `${format(weekStart, "d MMM", { locale: fr })} – ${format(end, "d MMM yyyy", { locale: fr })}`;
  }
  return `${format(weekStart, "d MMM yyyy", { locale: fr })} – ${format(end, "d MMM yyyy", { locale: fr })}`;
}

/** "Lun. 20" for column header. */
export function formatDayHeader(date: Date): string {
  const short = format(date, "EEE", { locale: fr }).replace(".", "");
  const capped = short.charAt(0).toUpperCase() + short.slice(1);
  return `${capped} ${format(date, "d")}`;
}

/** "Lundi 20 avril" for mobile accordion header. */
export function formatDayLongHeader(date: Date): string {
  const long = format(date, "EEEE d MMMM", { locale: fr });
  return long.charAt(0).toUpperCase() + long.slice(1);
}

/** True if `date` is strictly before today (local). */
export function isPastDay(date: Date): boolean {
  return isBefore(startOfDay(date), startOfDay(new Date()));
}

export function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}

/**
 * Recurring task match: does a subtask with given recurrence appear on this weekday?
 * Mirrors the server-side logic in public/api/todo_subtasks.php.
 */
export function recurrenceMatchesDate(
  recurrence: "daily" | "weekdays" | "weekly" | "monthly" | null | undefined,
  recurrenceDay: number | null | undefined,
  date: Date,
): boolean {
  if (!recurrence) return false;
  if (recurrence === "daily") return true;
  const isoDay = ((date.getDay() + 6) % 7) + 1; // ISO: Mon=1..Sun=7
  if (recurrence === "weekdays") return isoDay >= 1 && isoDay <= 5;
  if (recurrence === "weekly") return recurrenceDay != null && isoDay === recurrenceDay;
  if (recurrence === "monthly") return recurrenceDay != null && date.getDate() === recurrenceDay;
  return false;
}
