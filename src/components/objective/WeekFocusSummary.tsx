import { useEffect, useState } from "react";
import { Clock, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getWeekSummary, type WeekSummary } from "@/api/objectiveSessions";
import type { ObjectiveSource } from "@/api/objectiveSource";

interface WeekFocusSummaryProps {
  source: ObjectiveSource;
  objectiveId: string;
  compact?: boolean;
  /** bumping this value forces a re-fetch (e.g. after a session ends) */
  refreshKey?: number;
}

function formatDuration(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h === 0) return `${m}min`;
  return `${h}h ${m.toString().padStart(2, "0")}min`;
}

const DAY_LABELS = ["L", "M", "M", "J", "V", "S", "D"];

export function WeekFocusSummary({ source, objectiveId, compact, refreshKey = 0 }: WeekFocusSummaryProps) {
  const [data,    setData]    = useState<WeekSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getWeekSummary(source, objectiveId)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [source, objectiveId, refreshKey]);

  if (loading) {
    return (
      <div className="rounded-xl border border-border/40 bg-card/40 p-4 flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        <span className="text-xs font-body text-muted-foreground">Chargement des sessions...</span>
      </div>
    );
  }

  if (!data) return null;

  const max = Math.max(60, ...data.byDay.map(d => d.sec)); // min 60s so even tiny sessions show a bar
  const todayIdx = (() => {
    const now = new Date();
    const weekStart = new Date(data.weekStart);
    const diff = Math.floor((now.getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24));
    return diff >= 0 && diff < 7 ? diff : -1;
  })();

  return (
    <div className={cn(
      "rounded-2xl border border-border/40 bg-gradient-to-br from-card/60 to-card/30 p-4 sm:p-5",
      compact && "p-3",
    )}>
      <div className="flex items-center gap-2 mb-3">
        <Clock size={14} className="text-primary" />
        <span className="text-xs font-display font-bold text-foreground/70 uppercase tracking-wider">Focus cette semaine</span>
      </div>
      <div className="flex items-end gap-3">
        <div className="text-2xl sm:text-3xl font-display font-bold text-foreground tabular-nums">
          {formatDuration(data.totalSec)}
        </div>
        <div className="text-xs font-body text-muted-foreground pb-1.5">
          · {data.sessionCount} session{data.sessionCount > 1 ? "s" : ""}
        </div>
      </div>

      <div className="flex items-end justify-between gap-1.5 mt-4 h-14">
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
  );
}
