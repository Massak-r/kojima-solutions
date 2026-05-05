import { useMemo } from "react";
import { Check, X, Minus, Flame } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSubtaskCompletions } from "@/hooks/useSubtaskCompletions";
import type { Recurrence } from "@/api/todoSubtasks";
import type { ObjectiveSource } from "@/api/objectiveSource";

type CellState = "done" | "skipped" | "not-applicable" | "future";

interface Cell {
  date: string;          // YYYY-MM-DD or "" when not-applicable (no day in month)
  state: CellState;
  label: string;         // tooltip
  shortLabel: string;    // axis caption (weekday letter / date / month)
  isToday: boolean;
}

function dateToISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function startOfDay(d: Date): Date {
  const x = new Date(d); x.setHours(0, 0, 0, 0); return x;
}
function isoDow(d: Date): number {
  return ((d.getDay() + 6) % 7) + 1; // 1=Mon..7=Sun
}

const DAILY_SHORT  = ["L", "M", "M", "J", "V", "S", "D"];

function generateCells(
  recurrence: Recurrence,
  recurrenceDay: number | null,
  createdAtISO: string,
  completions: Set<string>,
): Cell[] {
  const today = startOfDay(new Date());
  const todayISO = dateToISO(today);
  const created  = startOfDay(new Date(createdAtISO));

  function makeCell(date: Date, shortLabel: string, longLabel: string): Cell {
    const iso = dateToISO(date);
    const beforeCreate = date < created;
    const inFuture = date > today;
    const done = completions.has(iso);
    const state: CellState = inFuture ? "future"
                           : beforeCreate ? "not-applicable"
                           : done ? "done"
                           : "skipped";
    return { date: iso, state, label: longLabel, shortLabel, isToday: iso === todayISO };
  }

  if (recurrence === "daily") {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today); d.setDate(d.getDate() - (6 - i));
      return makeCell(
        d,
        DAILY_SHORT[isoDow(d) - 1],
        d.toLocaleDateString("fr-CH", { weekday: "long", day: "numeric", month: "long" }),
      );
    });
  }

  if (recurrence === "weekdays") {
    const collected: Date[] = [];
    const cursor = new Date(today);
    while (collected.length < 5) {
      const w = isoDow(cursor);
      if (w >= 1 && w <= 5) collected.push(new Date(cursor));
      cursor.setDate(cursor.getDate() - 1);
    }
    collected.reverse();
    return collected.map(d => makeCell(
      d,
      DAILY_SHORT[isoDow(d) - 1],
      d.toLocaleDateString("fr-CH", { weekday: "long", day: "numeric", month: "long" }),
    ));
  }

  if (recurrence === "weekly" && recurrenceDay) {
    const collected: Date[] = [];
    const cursor = new Date(today);
    while (collected.length < 5) {
      if (isoDow(cursor) === recurrenceDay) collected.push(new Date(cursor));
      cursor.setDate(cursor.getDate() - 1);
    }
    collected.reverse();
    return collected.map(d => makeCell(
      d,
      `${d.getDate()}/${d.getMonth() + 1}`,
      d.toLocaleDateString("fr-CH", { weekday: "long", day: "numeric", month: "long", year: "numeric" }),
    ));
  }

  if (recurrence === "monthly" && recurrenceDay) {
    const cells: Cell[] = [];
    for (let i = 5; i >= 0; i--) {
      const ref      = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const lastDay  = new Date(ref.getFullYear(), ref.getMonth() + 1, 0).getDate();
      const monthStr = ref.toLocaleDateString("fr-CH", { month: "short" });
      if (recurrenceDay > lastDay) {
        cells.push({
          date: "",
          state: "not-applicable",
          label: `Pas de jour ${recurrenceDay} en ${ref.toLocaleDateString("fr-CH", { month: "long", year: "numeric" })}`,
          shortLabel: monthStr,
          isToday: false,
        });
      } else {
        const d = new Date(ref.getFullYear(), ref.getMonth(), recurrenceDay);
        cells.push(makeCell(
          d,
          monthStr,
          d.toLocaleDateString("fr-CH", { day: "numeric", month: "long", year: "numeric" }),
        ));
      }
    }
    return cells;
  }

  return [];
}

function isTodayEligible(recurrence: Recurrence, recurrenceDay: number | null): boolean {
  const today = new Date();
  const w = isoDow(today);
  if (recurrence === "daily")    return true;
  if (recurrence === "weekdays") return w >= 1 && w <= 5;
  if (recurrence === "weekly"  && recurrenceDay) return w === recurrenceDay;
  if (recurrence === "monthly" && recurrenceDay) return today.getDate() === recurrenceDay;
  return false;
}

/** Backward streak from the last eligible cell. `not-applicable`/`future` skip without breaking. */
function computeStreak(cells: Cell[]): number {
  let s = 0;
  for (let i = cells.length - 1; i >= 0; i--) {
    const c = cells[i];
    if (c.state === "future" || c.state === "not-applicable") continue;
    if (c.state === "done") { s++; continue; }
    break;
  }
  return s;
}

export function RecurrenceStreak({
  subtaskId,
  source,
  recurrence,
  recurrenceDay,
  createdAt,
  onCompleteToday,
}: {
  subtaskId: string;
  source: ObjectiveSource;
  recurrence: Recurrence;
  recurrenceDay: number | null;
  createdAt: string;
  /** Called when the user clicks today's cell (only fired when today is `skipped` AND eligible). */
  onCompleteToday: () => void;
}) {
  const { data: completionsMap } = useSubtaskCompletions(source);
  const dates       = completionsMap?.[subtaskId] ?? [];
  const completions = useMemo(() => new Set(dates), [dates]);
  const cells       = useMemo(
    () => generateCells(recurrence, recurrenceDay, createdAt, completions),
    [recurrence, recurrenceDay, createdAt, completions],
  );
  const streak       = computeStreak(cells);
  const todayElig    = isTodayEligible(recurrence, recurrenceDay);
  const showCaptions = recurrence === "weekly" || recurrence === "monthly";

  if (cells.length === 0) return null;

  return (
    <div className="mt-3 mb-1 ml-1">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-[10px] font-display font-bold text-foreground/60 uppercase tracking-wider">
          Discipline
        </span>
        {streak > 0 && (
          <span className="inline-flex items-center gap-0.5 text-[10px] font-body font-semibold text-amber-700 dark:text-amber-400">
            <Flame size={10} className="fill-current" />
            {streak} d'affilée
          </span>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        {cells.map((cell, i) => {
          const clickable = cell.isToday && cell.state === "skipped" && todayElig;
          const Icon =
            cell.state === "done" ? Check :
            cell.state === "skipped" ? X :
            cell.state === "not-applicable" ? Minus :
            null; // future renders empty

          const tone =
            cell.state === "done"
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
              : cell.state === "skipped"
              ? "bg-red-50 text-red-600/70 dark:bg-red-500/10 dark:text-red-400/80"
              : cell.state === "not-applicable"
              ? "bg-muted/40 text-muted-foreground/40"
              : "bg-muted/15 text-muted-foreground/30 border border-dashed border-border/40";

          const ring  = cell.isToday ? "ring-2 ring-primary/30 ring-offset-1 ring-offset-background" : "";
          const hover = clickable
            ? "cursor-pointer hover:bg-emerald-200/80 hover:text-emerald-800 dark:hover:bg-emerald-500/30 dark:hover:text-emerald-200"
            : "";

          const cls = cn(
            "w-7 h-7 rounded-md flex items-center justify-center transition-colors select-none",
            tone, ring, hover,
          );

          if (clickable) {
            return (
              <button
                key={i}
                onClick={ev => { ev.stopPropagation(); onCompleteToday(); }}
                title={`${cell.label} — Cliquer pour marquer fait`}
                className={cls}
                aria-label={`Marquer ${cell.shortLabel} comme fait`}
              >
                {Icon && <Icon size={11} />}
              </button>
            );
          }

          return (
            <div
              key={i}
              title={cell.label || cell.shortLabel}
              className={cls}
              aria-label={cell.label}
            >
              {Icon && <Icon size={11} />}
            </div>
          );
        })}
      </div>

      {showCaptions && (
        <div className="flex items-center gap-1.5 mt-1">
          {cells.map((c, i) => (
            <span
              key={i}
              className="w-7 text-center text-[9px] font-mono text-muted-foreground/60 tabular-nums truncate"
            >
              {c.shortLabel}
            </span>
          ))}
        </div>
      )}

      {!showCaptions && (
        <div className="flex items-center gap-1.5 mt-1">
          {cells.map((c, i) => (
            <span
              key={i}
              className={cn(
                "w-7 text-center text-[9px] font-mono tabular-nums",
                c.isToday ? "text-foreground font-bold" : "text-muted-foreground/50",
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
