import { useEffect, useState } from "react";
import { Clock, Flame, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { getGlobalWeekSummary, type GlobalWeekSummary as Summary } from "@/api/objectiveSessions";

interface GlobalWeekSummaryProps {
  /** lookup for objective titles by id — pass in from the page */
  objectivesById: Record<string, { text: string }>;
}

function formatDuration(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h === 0) return `${m}min`;
  return `${h}h ${m.toString().padStart(2, "0")}`;
}

const DAY_LABELS = ["L", "M", "M", "J", "V", "S", "D"];

export function GlobalWeekSummary({ objectivesById }: GlobalWeekSummaryProps) {
  const navigate = useNavigate();
  const [data,    setData]    = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getGlobalWeekSummary()
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="rounded-2xl border border-border/40 bg-card/40 p-5 flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        <span className="text-xs font-body text-muted-foreground">Chargement des stats…</span>
      </div>
    );
  }

  if (!data || data.totalSec === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/40 bg-card/30 p-5 text-center">
        <Flame size={20} className="mx-auto text-muted-foreground/30 mb-1" />
        <div className="text-xs font-body text-muted-foreground">Aucune session de focus cette semaine.</div>
        <div className="text-[10px] font-body text-muted-foreground/50 mt-0.5">Démarrez un sprint pour voir vos stats ici.</div>
      </div>
    );
  }

  const max = Math.max(60, ...data.byDay.map(d => d.sec));
  const todayIdx = (() => {
    const now = new Date();
    const weekStart = new Date(data.weekStart);
    const diff = Math.floor((now.getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24));
    return diff >= 0 && diff < 7 ? diff : -1;
  })();

  const topObjectives = data.byObjective.slice(0, 4);

  return (
    <div className="rounded-2xl border border-border/40 bg-gradient-to-br from-primary/5 via-card/50 to-card/30 p-5">
      <div className="flex items-center gap-2 mb-4">
        <Flame size={15} className="text-primary" />
        <span className="text-xs font-display font-bold text-foreground/70 uppercase tracking-wider">
          Focus cette semaine
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-5 items-start">
        {/* Left: total + bar chart */}
        <div>
          <div className="flex items-baseline gap-2">
            <div className="text-3xl sm:text-4xl font-display font-bold text-foreground tabular-nums">
              {formatDuration(data.totalSec)}
            </div>
            <div className="text-xs font-body text-muted-foreground">
              · {data.sessionCount} session{data.sessionCount > 1 ? "s" : ""}
            </div>
          </div>

          <div className="flex items-end justify-between gap-1.5 mt-4 h-14 max-w-md">
            {data.byDay.map((d, i) => {
              const h = max > 0 ? Math.max(d.sec === 0 ? 2 : 6, Math.round((d.sec / max) * 48)) : 2;
              const isToday = i === todayIdx;
              return (
                <div key={d.date} className="flex flex-col items-center gap-1 flex-1 min-w-0">
                  <div
                    className={cn(
                      "w-full rounded-md transition-colors",
                      d.sec > 0
                        ? isToday ? "bg-primary" : "bg-primary/60"
                        : "bg-muted/40",
                    )}
                    style={{ height: `${h}px` }}
                    title={`${DAY_LABELS[i]} · ${formatDuration(d.sec)}`}
                  />
                  <div className={cn(
                    "text-[10px] font-mono tabular-nums",
                    isToday ? "text-primary font-bold" : "text-muted-foreground/60",
                  )}>
                    {DAY_LABELS[i]}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: top objectives */}
        {topObjectives.length > 0 && (
          <div className="min-w-[200px] md:min-w-[240px]">
            <div className="text-[10px] font-display font-bold uppercase tracking-wider text-muted-foreground mb-2">
              Objectifs focalisés
            </div>
            <div className="space-y-1">
              {topObjectives.map(o => {
                const obj = objectivesById[o.objectiveId];
                const title = obj?.text ?? "(objectif inconnu)";
                const pct = data.totalSec > 0 ? Math.round((o.sec / data.totalSec) * 100) : 0;
                return (
                  <button
                    key={`${o.source}-${o.objectiveId}`}
                    onClick={() => navigate(`/objective/${o.source}/${o.objectiveId}`, { state: { from: "/sprint" } })}
                    className="w-full text-left rounded-lg px-2.5 py-1.5 hover:bg-card/80 transition-colors group"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-body font-medium text-foreground truncate group-hover:text-primary transition-colors flex-1 min-w-0">
                        {title}
                      </span>
                      <span className="text-[10px] font-mono tabular-nums text-muted-foreground shrink-0">
                        {formatDuration(o.sec)}
                      </span>
                    </div>
                    <div className="h-1 rounded-full bg-muted/40 overflow-hidden mt-1">
                      <div
                        className="h-full rounded-full bg-primary/70"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
