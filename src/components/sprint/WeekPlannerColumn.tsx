import { useDroppable } from "@dnd-kit/core";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDayHeader, formatDayLongHeader, isPastDay, isToday, toISODate } from "@/lib/weekDates";
import { WeekPlannerCard } from "./WeekPlannerCard";
import type { SubtaskItem } from "@/api/todoSubtasks";

/** Daily capacity target in minutes (6h). */
export const DAILY_CAPACITY_MIN = 360;

export interface WeekPlannerColumnProps {
  date: Date;
  items: SubtaskItem[];
  recurringItems: SubtaskItem[];
  objectiveTextById: Record<string, string>;
  /** Mobile stack mode: render with accordion header. */
  mobileMode?: boolean;
  defaultExpanded?: boolean;
  onOpen: (sub: SubtaskItem) => void;
}

export function WeekPlannerColumn({
  date, items, recurringItems, objectiveTextById, mobileMode, defaultExpanded, onOpen,
}: WeekPlannerColumnProps) {
  const past = isPastDay(date);
  const today = isToday(date);
  const isoDay = ((date.getDay() + 6) % 7) + 1;
  const isWeekend = isoDay >= 6;
  const dateId = `day:${toISODate(date)}`;
  const droppable = useDroppable({ id: dateId, disabled: past });

  const activeItems = items.filter(s => !s.completed);
  const activeRecurring = recurringItems.filter(s => !s.completed);
  const plannedMin = [...activeItems, ...activeRecurring]
    .reduce((sum, s) => sum + (s.estimatedMinutes ?? 0), 0);
  const pending = activeItems.length + activeRecurring.length;

  const capPct = Math.min(200, Math.round((plannedMin / DAILY_CAPACITY_MIN) * 100));
  const capColor = plannedMin === 0
    ? "bg-muted/40"
    : capPct > 100
      ? "bg-rose-500"
      : capPct >= 80
        ? "bg-amber-500"
        : "bg-emerald-500";

  const header = (
    <div className="flex items-baseline justify-between gap-2 px-0.5">
      <div className="flex items-baseline gap-2">
        <span className={cn(
          "text-sm font-display font-semibold",
          today ? "text-primary" : past ? "text-muted-foreground/40" : isWeekend ? "text-muted-foreground/80" : "text-foreground",
        )}>
          {mobileMode ? formatDayLongHeader(date) : formatDayHeader(date)}
        </span>
        {today && (
          <span className="text-[9px] font-body font-bold text-primary uppercase tracking-wider">
            Aujourd'hui
          </span>
        )}
      </div>
      <span className="text-[10px] font-mono tabular-nums text-muted-foreground/50">
        {pending > 0 ? `${pending} · ${formatMinutesShort(plannedMin)}` : ""}
      </span>
    </div>
  );

  const capacityBar = plannedMin > 0 ? (
    <div className="px-0.5">
      <div className="h-0.5 rounded-full bg-muted/40 overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", capColor)}
          style={{ width: `${Math.min(100, capPct)}%` }}
        />
      </div>
    </div>
  ) : null;

  const body = (
    <div
      ref={droppable.setNodeRef}
      className={cn(
        "flex-1 min-h-[120px] rounded-xl p-2 space-y-1.5 transition-colors border",
        droppable.isOver && !past && "bg-primary/15 border-primary/60 ring-2 ring-primary/30",
        !droppable.isOver && past && "bg-muted/10 border-border/20 opacity-60",
        !droppable.isOver && !past && today && "bg-gradient-to-b from-primary/10 via-primary/5 to-transparent border-primary/30",
        !droppable.isOver && !past && !today && isWeekend && "bg-muted/15 border-border/30",
        !droppable.isOver && !past && !today && !isWeekend && "bg-card/50 border-border/40",
      )}
    >
      {activeItems.length === 0 && activeRecurring.length === 0 && items.length === 0 && recurringItems.length === 0 && (
        <div className="text-center text-[11px] font-body text-muted-foreground/30 italic py-4">
          {past ? "—" : "Glissez une tâche ici"}
        </div>
      )}
      {items.map(sub => (
        <WeekPlannerCard
          key={sub.id}
          sub={sub}
          objectiveText={objectiveTextById[sub.parentId]}
          onOpen={onOpen}
        />
      ))}
      {recurringItems.map(sub => (
        <WeekPlannerCard
          key={`rec:${sub.id}:${dateId}`}
          sub={sub}
          objectiveText={objectiveTextById[sub.parentId]}
          locked
          onOpen={onOpen}
        />
      ))}
    </div>
  );

  if (mobileMode) {
    return (
      <details className="group rounded-xl border border-border/40 bg-card/40 overflow-hidden" open={defaultExpanded}>
        <summary className={cn(
          "px-3 py-2 cursor-pointer select-none list-none flex items-center justify-between gap-2 hover:bg-muted/20",
          today && "bg-primary/5",
          isWeekend && !today && "bg-muted/10",
        )}>
          <div className="flex-1">{header}</div>
          <ChevronDown size={12} className="text-muted-foreground/50 shrink-0 transition-transform group-open:rotate-180" />
        </summary>
        <div className="px-2 pb-2 space-y-1.5">
          {capacityBar}
          {body}
        </div>
      </details>
    );
  }

  return (
    <div className="flex flex-col gap-1.5 min-w-0">
      {header}
      {capacityBar}
      {body}
    </div>
  );
}

function formatMinutesShort(mins: number): string {
  if (mins === 0) return "—";
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h${m.toString().padStart(2, "0")}`;
}
