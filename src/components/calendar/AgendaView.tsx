import { cn } from "@/lib/utils";
import { Clock, MapPin } from "lucide-react";
import type { CalendarEvent } from "@/api/calendar";

interface AgendaViewProps {
  events: CalendarEvent[];
  onEventClick?: (event: CalendarEvent) => void;
}

function formatTime(dt?: string): string {
  if (!dt) return "";
  const d = new Date(dt);
  return d.toLocaleTimeString("fr-CH", { hour: "2-digit", minute: "2-digit" });
}

function getDayLabel(dateStr: string, today: string, tomorrow: string): string {
  if (dateStr === today) return "Aujourd'hui";
  if (dateStr === tomorrow) return "Demain";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("fr-CH", { weekday: "long", day: "numeric", month: "long" });
}

function getEventDate(event: CalendarEvent): string {
  const dt = event.start.dateTime || event.start.date || "";
  return dt.slice(0, 10);
}

function isAllDay(event: CalendarEvent): boolean {
  return !!event.start.date && !event.start.dateTime;
}

export function AgendaView({ events, onEventClick }: AgendaViewProps) {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const tmrw = new Date(now.getTime() + 86400000).toISOString().slice(0, 10);

  // Group events by date
  const grouped = new Map<string, CalendarEvent[]>();
  // Build 7 days of slots (even empty ones)
  for (let i = 0; i < 7; i++) {
    const d = new Date(now.getTime() + i * 86400000);
    const key = d.toISOString().slice(0, 10);
    grouped.set(key, []);
  }
  for (const ev of events) {
    const date = getEventDate(ev);
    if (grouped.has(date)) {
      grouped.get(date)!.push(ev);
    }
  }

  return (
    <div className="space-y-1">
      {Array.from(grouped.entries()).map(([date, dayEvents]) => (
        <div key={date}>
          {/* Day header */}
          <div className="flex items-center gap-2 px-2 py-1.5">
            <span className={cn(
              "text-xs font-display font-bold uppercase tracking-wider",
              date === today ? "text-primary" : "text-muted-foreground/70",
            )}>
              {getDayLabel(date, today, tmrw)}
            </span>
            <div className="flex-1 h-px bg-border/30" />
            {dayEvents.length > 0 && (
              <span className="text-[10px] font-mono text-muted-foreground/50">{dayEvents.length}</span>
            )}
          </div>

          {/* Events */}
          {dayEvents.length > 0 ? (
            <div className="space-y-1 mb-2">
              {dayEvents.map(ev => (
                <button
                  key={ev.id}
                  onClick={() => onEventClick?.(ev)}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-lg transition-colors",
                    "bg-white/40 dark:bg-white/[0.03] border border-border/20",
                    "hover:bg-white/70 hover:border-border/40 hover:shadow-sm",
                    "group",
                  )}
                >
                  <div className="flex items-start gap-2.5">
                    {/* Time */}
                    <div className="shrink-0 w-12 text-right">
                      {isAllDay(ev) ? (
                        <span className="text-[10px] font-body font-semibold text-primary/70 uppercase">Journée</span>
                      ) : (
                        <span className="text-xs font-mono text-muted-foreground tabular-nums">
                          {formatTime(ev.start.dateTime)}
                        </span>
                      )}
                    </div>
                    {/* Divider */}
                    <div className="w-0.5 h-full min-h-[24px] bg-primary/30 rounded-full shrink-0" />
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-body font-medium text-foreground truncate">
                        {ev.summary}
                      </p>
                      {ev.location && (
                        <p className="flex items-center gap-1 text-[10px] text-muted-foreground/60 font-body mt-0.5">
                          <MapPin size={9} className="shrink-0" />
                          <span className="truncate">{ev.location}</span>
                        </p>
                      )}
                    </div>
                    {/* Duration */}
                    {!isAllDay(ev) && ev.end.dateTime && (
                      <span className="text-[10px] text-muted-foreground/40 font-mono shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        → {formatTime(ev.end.dateTime)}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-[10px] text-muted-foreground/30 font-body px-2 pb-1 italic">
              Aucun événement
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
