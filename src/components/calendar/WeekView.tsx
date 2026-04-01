import { cn } from "@/lib/utils";
import type { CalendarEvent } from "@/api/calendar";

interface WeekViewProps {
  events: CalendarEvent[];
  currentDate: Date;
  onEventClick?: (event: CalendarEvent) => void;
  onSlotClick?: (date: string, hour: number) => void;
}

const HOURS = Array.from({ length: 13 }, (_, i) => i + 8); // 8:00–20:00

function getWeekDays(date: Date): Date[] {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday start
  const mon = new Date(d.setDate(diff));
  return Array.from({ length: 7 }, (_, i) => {
    const dd = new Date(mon);
    dd.setDate(mon.getDate() + i);
    return dd;
  });
}

function eventToPosition(ev: CalendarEvent, dayStr: string): { top: number; height: number } | null {
  const start = ev.start.dateTime;
  const end = ev.end.dateTime;
  if (!start || !end) return null;

  const sd = new Date(start);
  const ed = new Date(end);
  if (sd.toISOString().slice(0, 10) !== dayStr) return null;

  const startMin = sd.getHours() * 60 + sd.getMinutes();
  const endMin = ed.getHours() * 60 + ed.getMinutes();
  const top = ((startMin - 480) / 60) * 48; // 48px per hour, starting at 8:00
  const height = Math.max(((endMin - startMin) / 60) * 48, 20);
  return { top: Math.max(top, 0), height };
}

export function WeekView({ events, currentDate, onEventClick, onSlotClick }: WeekViewProps) {
  const days = getWeekDays(currentDate);
  const today = new Date().toISOString().slice(0, 10);
  const now = new Date();
  const currentMinute = now.getHours() * 60 + now.getMinutes();
  const nowTop = ((currentMinute - 480) / 60) * 48;

  return (
    <div className="overflow-x-auto">
      <div>
        {/* Day headers */}
        <div className="grid grid-cols-[32px_repeat(7,1fr)] sm:grid-cols-[48px_repeat(7,1fr)] border-b border-border/30 mb-1">
          <div />
          {days.map(d => {
            const ds = d.toISOString().slice(0, 10);
            const isToday = ds === today;
            return (
              <div key={ds} className={cn("text-center py-1.5", isToday && "bg-primary/5 rounded-t-lg")}>
                <div className="text-[10px] font-body text-muted-foreground/50 uppercase">
                  {d.toLocaleDateString("fr-CH", { weekday: "short" })}
                </div>
                <div className={cn(
                  "text-sm font-display font-bold",
                  isToday ? "text-primary" : "text-foreground/70",
                )}>
                  {d.getDate()}
                </div>
              </div>
            );
          })}
        </div>

        {/* Time grid */}
        <div className="relative grid grid-cols-[32px_repeat(7,1fr)] sm:grid-cols-[48px_repeat(7,1fr)]" style={{ height: HOURS.length * 48 }}>
          {/* Hour labels */}
          {HOURS.map(h => (
            <div
              key={h}
              className="absolute left-0 w-8 sm:w-12 text-right pr-1 sm:pr-2 text-[8px] sm:text-[10px] font-mono text-muted-foreground/40"
              style={{ top: (h - 8) * 48 - 6 }}
            >
              {h}:00
            </div>
          ))}

          {/* Grid lines */}
          {HOURS.map(h => (
            <div
              key={`line-${h}`}
              className="absolute left-8 sm:left-12 right-0 border-t border-border/15"
              style={{ top: (h - 8) * 48 }}
            />
          ))}

          {/* Day columns */}
          {days.map((d, di) => {
            const ds = d.toISOString().slice(0, 10);
            const isToday = ds === today;
            const dayEvents = events.filter(ev => {
              const evDate = (ev.start.dateTime || ev.start.date || "").slice(0, 10);
              return evDate === ds;
            });

            return (
              <div
                key={ds}
                className={cn(
                  "relative border-l border-border/10",
                  isToday && "bg-primary/[0.02]",
                )}
                style={{ gridColumn: di + 2 }}
                onClick={() => onSlotClick?.(ds, 9)}
              >
                {/* Events */}
                {dayEvents.map(ev => {
                  const pos = eventToPosition(ev, ds);
                  if (!pos) return null;
                  return (
                    <button
                      key={ev.id}
                      className="absolute left-0.5 right-0.5 bg-primary/15 border-l-2 border-primary rounded-r-md px-1 py-0.5 overflow-hidden text-left hover:bg-primary/25 transition-colors z-10"
                      style={{ top: pos.top, height: pos.height }}
                      onClick={e => { e.stopPropagation(); onEventClick?.(ev); }}
                    >
                      <span className="text-[10px] font-body font-medium text-primary leading-tight line-clamp-2">
                        {ev.summary}
                      </span>
                    </button>
                  );
                })}

                {/* Current time indicator */}
                {isToday && nowTop >= 0 && nowTop <= HOURS.length * 48 && (
                  <div
                    className="absolute left-0 right-0 border-t-2 border-red-500 z-20"
                    style={{ top: nowTop }}
                  >
                    <div className="w-2 h-2 bg-red-500 rounded-full -mt-1 -ml-1" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
