import { useState, useEffect, useCallback } from "react";
import { CalendarClock, Plus, Loader2, ExternalLink, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { listEvents, createEvent, getCachedEvents } from "@/api/calendar";
import type { CalendarEvent } from "@/api/calendar";
import { AgendaView } from "./AgendaView";
import { WeekView } from "./WeekView";
import { MonthView } from "./MonthView";

type ViewMode = "agenda" | "week" | "month";

const VIEW_LABELS: Record<ViewMode, string> = {
  agenda: "Agenda",
  week: "Semaine",
  month: "Mois",
};

export function CalendarWidget() {
  const [view, setView] = useState<ViewMode>("agenda");
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [addingEvent, setAddingEvent] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDate, setNewDate] = useState(new Date().toISOString().slice(0, 10));
  const [newStartTime, setNewStartTime] = useState("09:00");
  const [newEndTime, setNewEndTime] = useState("10:00");
  const [isOfflineData, setIsOfflineData] = useState(false);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    setIsOfflineData(false);
    try {
      const timeMin = new Date().toISOString();
      const timeMax = new Date(Date.now() + 30 * 86400000).toISOString();
      const data = await listEvents(timeMin, timeMax);
      setEvents(data);
    } catch (err: any) {
      // Check if we got cached data
      const cached = getCachedEvents();
      if (cached) {
        setEvents(cached.events);
        setIsOfflineData(true);
      } else {
        const msg = err?.message || "";
        // Show specific API error for debugging, fall back to generic message
        if (msg.includes("503") || msg.includes("configured") || msg.includes("not found")) {
          setError("Calendrier non configuré : " + msg.replace(/^API\s+\S+\s*→\s*/, ""));
        } else if (msg.includes("403") || msg.includes("Unauthorized")) {
          setError("Accès refusé au calendrier (clé API invalide)");
        } else {
          setError("Calendrier inaccessible : " + (msg || "erreur réseau"));
        }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
    // Refresh every 5 minutes
    const interval = setInterval(fetchEvents, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchEvents]);

  async function handleAddEvent() {
    const title = newTitle.trim();
    if (!title) return;
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      await createEvent({
        summary: title,
        start: { dateTime: `${newDate}T${newStartTime}:00`, timeZone: tz },
        end: { dateTime: `${newDate}T${newEndTime}:00`, timeZone: tz },
      });
      setNewTitle("");
      setAddingEvent(false);
      fetchEvents();
    } catch {}
  }

  const todayLabel = new Date().toLocaleDateString("fr-CH", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <section className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-primary/5 to-transparent border-b border-border/50">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <CalendarClock size={14} className="text-primary" />
          </div>
          <div>
            <h2 className="font-display text-xs font-bold text-foreground/80 uppercase tracking-widest">Agenda</h2>
            <span className="text-[10px] font-body text-muted-foreground/50 capitalize">{todayLabel}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <div className="flex items-center bg-secondary/40 rounded-full p-0.5">
            {(Object.keys(VIEW_LABELS) as ViewMode[]).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  "text-[10px] font-body font-medium px-2.5 py-0.5 rounded-full transition-all",
                  view === v
                    ? "bg-primary/10 text-primary font-semibold shadow-sm"
                    : "text-muted-foreground/50 hover:text-muted-foreground",
                )}
              >
                {VIEW_LABELS[v]}
              </button>
            ))}
          </div>

          {/* Add event */}
          <button
            onClick={() => setAddingEvent(a => !a)}
            className="text-muted-foreground/40 hover:text-primary transition-colors"
            title="Ajouter un événement"
          >
            {addingEvent ? <X size={14} /> : <Plus size={14} />}
          </button>

          {/* Open Google Calendar */}
          <a
            href="https://calendar.google.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground/40 hover:text-primary transition-colors"
            title="Ouvrir Google Calendar"
          >
            <ExternalLink size={12} />
          </a>
        </div>
      </div>

      {/* Offline indicator */}
      {isOfflineData && (
        <div className="bg-amber-50/50 text-amber-700 text-[10px] font-body px-4 py-1 text-center border-b border-amber-200/30">
          Données en cache. Dernière mise à jour il y a {Math.round((Date.now() - (getCachedEvents()?.ts || Date.now())) / 60000)} min
        </div>
      )}

      {/* Quick-add form */}
      <AnimatePresence>
        {addingEvent && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-b border-border/30"
          >
            <div className="p-3 space-y-2">
              <input
                type="text"
                placeholder="Titre de l'événement..."
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleAddEvent()}
                className="w-full text-sm font-body bg-secondary/30 border border-border/30 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground/30"
                autoFocus
              />
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={newDate}
                  onChange={e => setNewDate(e.target.value)}
                  className="text-xs font-body bg-secondary/30 border border-border/30 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary/20"
                />
                <input
                  type="time"
                  value={newStartTime}
                  onChange={e => setNewStartTime(e.target.value)}
                  className="text-xs font-body bg-secondary/30 border border-border/30 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary/20 w-20"
                />
                <span className="text-xs text-muted-foreground/40">→</span>
                <input
                  type="time"
                  value={newEndTime}
                  onChange={e => setNewEndTime(e.target.value)}
                  className="text-xs font-body bg-secondary/30 border border-border/30 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary/20 w-20"
                />
                <Button
                  size="sm"
                  className="h-7 px-3 text-xs rounded-lg ml-auto"
                  onClick={handleAddEvent}
                  disabled={!newTitle.trim()}
                >
                  Ajouter
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content */}
      <div className="p-3" style={{ minHeight: 200 }}>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={18} className="animate-spin text-muted-foreground/40" />
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <p className="text-xs text-muted-foreground/50 font-body break-words px-4">{error}</p>
            <button
              onClick={fetchEvents}
              className="text-[10px] text-primary/60 hover:text-primary font-body mt-2 underline underline-offset-2"
            >
              Réessayer
            </button>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={view}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.15 }}
            >
              {view === "agenda" && (
                <AgendaView
                  events={events}
                  onEventClick={ev => ev.htmlLink && window.open(ev.htmlLink, "_blank")}
                />
              )}
              {view === "week" && (
                <WeekView
                  events={events}
                  currentDate={currentDate}
                  onEventClick={ev => ev.htmlLink && window.open(ev.htmlLink, "_blank")}
                />
              )}
              {view === "month" && (
                <MonthView
                  events={events}
                  currentDate={currentDate}
                  onMonthChange={setCurrentDate}
                  onDayClick={date => {
                    setCurrentDate(new Date(date + "T00:00:00"));
                    setView("agenda");
                  }}
                />
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </section>
  );
}
