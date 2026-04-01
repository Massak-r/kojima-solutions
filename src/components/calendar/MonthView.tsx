import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { CalendarEvent } from "@/api/calendar";

interface MonthViewProps {
  events: CalendarEvent[];
  currentDate: Date;
  onMonthChange: (date: Date) => void;
  onDayClick?: (date: string) => void;
}

function getMonthGrid(year: number, month: number): (Date | null)[][] {
  const first = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0).getDate();
  const startDay = (first.getDay() + 6) % 7; // Monday = 0

  const weeks: (Date | null)[][] = [];
  let week: (Date | null)[] = [];

  for (let i = 0; i < startDay; i++) week.push(null);
  for (let d = 1; d <= lastDay; d++) {
    week.push(new Date(year, month, d));
    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
  }
  if (week.length > 0) {
    while (week.length < 7) week.push(null);
    weeks.push(week);
  }
  return weeks;
}

function countEventsOnDay(events: CalendarEvent[], dateStr: string): number {
  return events.filter(ev => {
    const d = (ev.start.dateTime || ev.start.date || "").slice(0, 10);
    return d === dateStr;
  }).length;
}

export function MonthView({ events, currentDate, onMonthChange, onDayClick }: MonthViewProps) {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const weeks = getMonthGrid(year, month);
  const today = new Date().toISOString().slice(0, 10);
  const monthLabel = currentDate.toLocaleDateString("fr-CH", { month: "long", year: "numeric" });

  const DAY_NAMES = ["Lu", "Ma", "Me", "Je", "Ve", "Sa", "Di"];

  function prev() { onMonthChange(new Date(year, month - 1, 1)); }
  function next() { onMonthChange(new Date(year, month + 1, 1)); }

  return (
    <div>
      {/* Month navigation */}
      <div className="flex items-center justify-between px-2 mb-3">
        <button onClick={prev} className="p-1 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-secondary/50">
          <ChevronLeft size={16} />
        </button>
        <span className="text-sm font-display font-bold text-foreground/80 capitalize">
          {monthLabel}
        </span>
        <button onClick={next} className="p-1 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-secondary/50">
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_NAMES.map(d => (
          <div key={d} className="text-center text-[10px] font-body font-semibold text-muted-foreground/50 uppercase">
            {d}
          </div>
        ))}
      </div>

      {/* Weeks */}
      <div className="space-y-0.5">
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7">
            {week.map((day, di) => {
              if (!day) return <div key={di} />;
              const ds = day.toISOString().slice(0, 10);
              const isToday = ds === today;
              const count = countEventsOnDay(events, ds);
              return (
                <button
                  key={di}
                  onClick={() => onDayClick?.(ds)}
                  className={cn(
                    "flex flex-col items-center py-1.5 rounded-lg transition-colors",
                    "hover:bg-secondary/50",
                    isToday && "bg-primary/10 ring-1 ring-primary/30",
                  )}
                >
                  <span className={cn(
                    "text-xs font-body",
                    isToday ? "font-bold text-primary" : "text-foreground/70",
                  )}>
                    {day.getDate()}
                  </span>
                  {/* Event dots */}
                  {count > 0 && (
                    <div className="flex gap-0.5 mt-0.5">
                      {Array.from({ length: Math.min(count, 3) }).map((_, i) => (
                        <div key={i} className="w-1 h-1 rounded-full bg-primary/60" />
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
