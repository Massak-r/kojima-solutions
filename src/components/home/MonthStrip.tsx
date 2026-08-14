import { Link } from "react-router-dom";
import { ChevronRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMonthProgress } from "@/hooks/useMonthProgress";

/**
 * One line on Aujourd'hui: how much of the month is closed.
 *
 * Deliberately a strip, not a card. This screen is where the day starts, and
 * the whole point of the month framing is to *reduce* what lands there — a
 * second panel of obligations would undo it. It shows a finish line and a
 * number, and sends you to the Centre admin for anything more.
 *
 * Stays hidden when the month holds nothing, rather than rendering an empty
 * state nobody asked for.
 */
export function MonthStrip() {
  const { progress, ready } = useMonthProgress();
  const { monthLabel, done, total, remaining, daysLeft, overdue, cleared } = progress;

  if (!ready || total === 0) return null;

  const left = remaining.length;

  return (
    <Link
      to="/documents"
      className={cn(
        "flex items-center gap-3 rounded-2xl border px-4 py-3 transition-colors",
        cleared
          ? "border-emerald-200 bg-emerald-50/60 dark:border-emerald-500/30 dark:bg-emerald-500/10"
          : "border-border bg-card hover:bg-secondary/30",
      )}
    >
      {/* One block per obligation — the finish line, countable at a glance. */}
      <span className="flex items-center gap-[2px] shrink-0 w-24 sm:w-32" aria-hidden="true">
        {Array.from({ length: total }, (_, i) => {
          const isDone = i < done;
          const isLate = !isDone && i - done < overdue;
          return (
            <span
              key={i}
              className={cn(
                "h-1.5 flex-1 min-w-[2px] rounded-full",
                isDone
                  ? cleared ? "bg-emerald-500" : "bg-primary"
                  : isLate ? "bg-destructive/40" : "bg-border",
              )}
            />
          );
        })}
      </span>

      <span className="flex-1 min-w-0 text-sm font-body truncate">
        {cleared ? (
          <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700 dark:text-emerald-300">
            <Check size={14} className="shrink-0" />
            {monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)} est bouclé
          </span>
        ) : (
          <>
            <span className="font-medium text-foreground tabular-nums">{left}</span>
            <span className="text-muted-foreground">
              {" "}à régler en {monthLabel}
            </span>
          </>
        )}
      </span>

      {!cleared && (
        <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
          {daysLeft} j
        </span>
      )}
      <ChevronRight size={14} className="text-muted-foreground/40 shrink-0" />
    </Link>
  );
}
