import { useEffect, useState } from "react";
import { TrendingUp, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getWeeksSummary, type WeeksSummary } from "@/api/objectiveSessions";

function fmtH(sec: number): string {
  const h = sec / 3600;
  if (h === 0) return "0";
  if (h < 10) return h.toFixed(1).replace(/\.0$/, "");
  return Math.round(h).toString();
}

// Short "JJ.MM" label from a YYYY-MM-DD week start.
function weekLabel(weekStart: string): string {
  const d = new Date(weekStart);
  if (Number.isNaN(d.getTime())) return weekStart.slice(5);
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Multi-week focus trend (last 8 ISO weeks) — total hours per week + period
 * stats. Complements GlobalWeekSummary (current week only). Returns null when
 * there's no focus history yet, so the card stays quiet (and a failed fetch
 * degrades to hidden rather than erroring).
 */
export function FocusTrends() {
  const [data, setData] = useState<WeeksSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getWeeksSummary(8)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="rounded-2xl border border-border/40 bg-card/40 p-5 flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        <span className="text-xs font-body text-muted-foreground">Chargement des tendances…</span>
      </div>
    );
  }

  const weeks = data?.weeks ?? [];
  const total = weeks.reduce((s, w) => s + w.totalSec, 0);
  if (!data || total === 0) return null;

  const max = Math.max(60, ...weeks.map((w) => w.totalSec));
  const activeWeeks = weeks.filter((w) => w.totalSec > 0).length;
  const avgSec = activeWeeks > 0 ? Math.round(total / activeWeeks) : 0;
  const best = weeks.reduce((b, w) => (w.totalSec > b.totalSec ? w : b), weeks[0]);
  const lastIdx = weeks.length - 1;

  return (
    <div className="rounded-2xl border border-border/40 bg-gradient-to-br from-primary/5 via-card/50 to-card/30 p-5">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp size={15} className="text-primary" />
        <span className="text-xs font-display font-bold text-foreground/70 uppercase tracking-wider">
          Tendance focus · {weeks.length} semaines
        </span>
      </div>

      <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1 mb-4">
        <div>
          <span className="text-2xl sm:text-3xl font-display font-bold text-foreground tabular-nums">{fmtH(total)}h</span>
          <span className="text-xs font-body text-muted-foreground ml-1.5">au total</span>
        </div>
        <div className="text-xs font-body text-muted-foreground">
          Moyenne <strong className="text-foreground/80 tabular-nums">{fmtH(avgSec)}h</strong>/sem. active
        </div>
        <div className="text-xs font-body text-muted-foreground">
          Meilleure <strong className="text-foreground/80 tabular-nums">{fmtH(best.totalSec)}h</strong> ({weekLabel(best.weekStart)})
        </div>
      </div>

      <div className="flex items-end justify-between gap-2 h-24">
        {weeks.map((w, i) => {
          const h = Math.max(w.totalSec === 0 ? 2 : 8, Math.round((w.totalSec / max) * 80));
          const isLast = i === lastIdx;
          return (
            <div key={w.weekStart} className="flex flex-col items-center gap-1 flex-1 min-w-0">
              <span className="text-[9px] font-mono tabular-nums text-muted-foreground/70 h-3">
                {w.totalSec > 0 ? `${fmtH(w.totalSec)}h` : ""}
              </span>
              <div
                className={cn(
                  "w-full rounded-md transition-colors",
                  w.totalSec > 0 ? (isLast ? "bg-primary" : "bg-primary/55") : "bg-muted/40",
                )}
                style={{ height: `${h}px` }}
                title={`Semaine du ${weekLabel(w.weekStart)} · ${fmtH(w.totalSec)}h · ${w.sessionCount} session${w.sessionCount > 1 ? "s" : ""}`}
              />
              <span className={cn("text-[9px] font-mono tabular-nums", isLast ? "text-primary font-bold" : "text-muted-foreground/60")}>
                {weekLabel(w.weekStart)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
