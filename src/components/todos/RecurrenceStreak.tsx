import { useMemo } from "react";
import { Check, X, Minus, Flame, CircleDashed } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSubtaskCompletions } from "@/hooks/useSubtaskCompletions";
import type { Recurrence } from "@/api/todoSubtasks";
import type { ObjectiveSource } from "@/api/objectiveSource";
import {
  type Period,
  currentPeriodFor,
  previousPeriod,
  isPeriodDone,
  samePeriod,
  periodEnd,
  periodShortLabel,
  periodLongLabel,
  donePeriodLabel,
  streakSuffix,
} from "@/lib/recurrencePeriod";

type CellState = "done" | "pending" | "skipped" | "not-applicable";

interface Cell {
  period: Period;
  state: CellState;
  shortLabel: string;
  longLabel: string;
  isCurrent: boolean;
}

const CELL_COUNT: Record<Recurrence, number> = {
  daily:    7,
  weekdays: 5,
  weekly:   5,
  monthly:  6,
};

function startOfDay(d: Date): Date {
  const x = new Date(d); x.setHours(0, 0, 0, 0); return x;
}

function isoDow(d: Date): number {
  return ((d.getDay() + 6) % 7) + 1;
}

function generateCells(
  recurrence: Recurrence,
  createdAtISO: string,
  completionDates: string[],
): Cell[] {
  const today = startOfDay(new Date());
  const created = startOfDay(new Date(createdAtISO));
  const currentPeriod = currentPeriodFor(recurrence, today);

  // Build the period sequence (oldest → newest, current period last).
  const periods: Period[] = [currentPeriod];
  let cursor: Period = currentPeriod;

  if (recurrence === "weekdays") {
    // Step back one DAY at a time but only keep weekdays.
    const seen: string[] = [(cursor as { date: string }).date];
    const stepDate = new Date(today);
    while (seen.length < CELL_COUNT.weekdays) {
      stepDate.setDate(stepDate.getDate() - 1);
      const w = isoDow(stepDate);
      if (w >= 1 && w <= 5) {
        const iso = `${stepDate.getFullYear()}-${String(stepDate.getMonth() + 1).padStart(2, "0")}-${String(stepDate.getDate()).padStart(2, "0")}`;
        seen.push(iso);
      }
    }
    seen.reverse();
    return seen.map((date) => makeCell(
      { kind: "day", date },
      currentPeriod,
      created,
      completionDates,
    ));
  }

  const count = CELL_COUNT[recurrence] ?? 5;
  while (periods.length < count) {
    cursor = previousPeriod(cursor);
    periods.unshift(cursor);
  }

  return periods.map((p) => makeCell(p, currentPeriod, created, completionDates));
}

function makeCell(
  p: Period,
  currentPeriod: Period,
  created: Date,
  completionDates: string[],
): Cell {
  const isCurrent = samePeriod(p, currentPeriod);
  const beforeCreate = periodEnd(p) < created;
  const done = isPeriodDone(p, completionDates);
  const state: CellState = beforeCreate ? "not-applicable"
                         : done ? "done"
                         : isCurrent ? "pending"
                         : "skipped";
  return {
    period: p,
    state,
    shortLabel: periodShortLabel(p),
    longLabel: periodLongLabel(p),
    isCurrent,
  };
}

/** Count consecutive "done" periods walking backward from the most recent
 *  eligible cell. `not-applicable` periods skip without breaking the streak. */
function computeStreak(cells: Cell[]): number {
  let s = 0;
  for (let i = cells.length - 1; i >= 0; i--) {
    const c = cells[i];
    if (c.state === "not-applicable") continue;
    if (c.state === "done") { s++; continue; }
    // Pending current cell isn't broken — it's just not yet done.
    if (c.state === "pending" && c.isCurrent) continue;
    break;
  }
  return s;
}

export function RecurrenceStreak({
  subtaskId,
  source,
  recurrence,
  createdAt,
  onToggleCurrent,
}: {
  subtaskId: string;
  source: ObjectiveSource;
  recurrence: Recurrence;
  /** Kept for the type signature; recurrence_day is now informational only. */
  recurrenceDay?: number | null;
  createdAt: string;
  /** Called when the user clicks the current-period cell (toggles done/pending). */
  onToggleCurrent: () => void;
}) {
  const { data: completionsMap } = useSubtaskCompletions(source);

  const cells = useMemo(
    () => generateCells(recurrence, createdAt, completionsMap?.[subtaskId] ?? []),
    [recurrence, createdAt, completionsMap, subtaskId],
  );
  const streak = computeStreak(cells);
  const showCaptions = recurrence === "weekly" || recurrence === "monthly";

  if (cells.length === 0) return null;

  return (
    <div className="mt-3 mb-1 ml-1">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-[10px] font-display font-bold text-foreground/60 uppercase tracking-wider">
          {donePeriodLabel(recurrence)}
        </span>
        {streak > 0 && (
          <span className="inline-flex items-center gap-0.5 text-[10px] font-body font-semibold text-amber-700 dark:text-amber-400">
            <Flame size={10} className="fill-current" />
            {streak} {streakSuffix(recurrence, streak)}
          </span>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        {cells.map((cell, i) => {
          // Only the current-period cell is clickable. Past periods are immutable.
          const clickable = cell.isCurrent && (cell.state === "done" || cell.state === "pending");
          const Icon =
            cell.state === "done" ? Check :
            cell.state === "pending" ? CircleDashed :
            cell.state === "skipped" ? X :
            Minus;

          const tone =
            cell.state === "done"
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
              : cell.state === "pending"
              ? "bg-muted/30 text-muted-foreground/80 border border-dashed border-primary/40"
              : cell.state === "skipped"
              ? "bg-red-50 text-red-600/70 dark:bg-red-500/10 dark:text-red-400/80"
              : "bg-muted/40 text-muted-foreground/40";

          const ring = cell.isCurrent ? "ring-2 ring-primary/30 ring-offset-1 ring-offset-background" : "";
          const hover = clickable
            ? "cursor-pointer hover:bg-emerald-200/80 hover:text-emerald-800 dark:hover:bg-emerald-500/30 dark:hover:text-emerald-200"
            : "";

          const cls = cn(
            "w-7 h-7 rounded-md flex items-center justify-center transition-colors select-none",
            tone, ring, hover,
          );

          const tooltip = clickable
            ? cell.state === "done"
              ? `${cell.longLabel} — Cliquer pour décocher`
              : `${cell.longLabel} — Cliquer pour marquer fait`
            : cell.longLabel;

          if (clickable) {
            return (
              <button
                key={i}
                onClick={ev => { ev.stopPropagation(); onToggleCurrent(); }}
                title={tooltip}
                className={cls}
                aria-label={tooltip}
              >
                <Icon size={11} />
              </button>
            );
          }

          return (
            <div
              key={i}
              title={tooltip}
              className={cls}
              aria-label={tooltip}
            >
              <Icon size={11} />
            </div>
          );
        })}
      </div>

      {showCaptions ? (
        <div className="flex items-center gap-1.5 mt-1">
          {cells.map((c, i) => (
            <span
              key={i}
              className={cn(
                "w-7 text-center text-[9px] font-mono tabular-nums truncate",
                c.isCurrent ? "text-foreground font-bold" : "text-muted-foreground/60",
              )}
            >
              {c.shortLabel}
            </span>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-1.5 mt-1">
          {cells.map((c, i) => (
            <span
              key={i}
              className={cn(
                "w-7 text-center text-[9px] font-mono tabular-nums",
                c.isCurrent ? "text-foreground font-bold" : "text-muted-foreground/50",
              )}
            >
              {c.shortLabel}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
