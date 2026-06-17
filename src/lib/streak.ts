import type { Recurrence } from "@/api/todoSubtasks";
import { currentPeriodFor, previousPeriod, isPeriodDone, periodEnd } from "@/lib/recurrencePeriod";

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/**
 * Consecutive "done" periods walking back from the current one — the streak.
 * The current period being not-yet-done does NOT break it (you still have
 * time today/this week); a past missed period does. Periods before the task
 * existed are ignored. `weekdays` is skipped (its period stepping needs the
 * calendar-aware walk in RecurrenceStreak) — returns 0.
 *
 * Standalone (no JSX) so a compact streak badge can reuse it without pulling
 * in the full RecurrenceStreak chain UI.
 */
export function recurrenceStreakCount(
  recurrence: Recurrence,
  createdAtISO: string,
  completionDates: string[],
): number {
  if (recurrence === "weekdays") return 0;
  const created = startOfDay(new Date(createdAtISO));
  let period = currentPeriodFor(recurrence, startOfDay(new Date()));
  let streak = 0;
  let isCurrent = true;
  for (let i = 0; i < 120; i++) {
    if (periodEnd(period) < created) break;
    if (isPeriodDone(period, completionDates)) {
      streak++;
    } else if (!isCurrent) {
      break;
    }
    period = previousPeriod(period);
    isCurrent = false;
  }
  return streak;
}
