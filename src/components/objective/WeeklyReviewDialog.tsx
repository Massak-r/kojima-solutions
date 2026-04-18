import { useEffect, useState } from "react";
import { CalendarCheck2, Clock, Flame, Target, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { getGlobalWeekSummary, type GlobalWeekSummary } from "@/api/objectiveSessions";

interface WeeklyReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  objectiveTextById: Record<string, string>;
  onDismiss?: () => void;
}

const DAY_LABELS = ["L", "M", "M", "J", "V", "S", "D"];

function formatDuration(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h === 0) return `${m}min`;
  return `${h}h${m.toString().padStart(2, "0")}`;
}

export function WeeklyReviewDialog({ open, onOpenChange, objectiveTextById, onDismiss }: WeeklyReviewDialogProps) {
  const [data, setData] = useState<GlobalWeekSummary | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    getGlobalWeekSummary()
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [open]);

  function handleClose() {
    onDismiss?.();
    onOpenChange(false);
  }

  const totalSec = data?.totalSec ?? 0;
  const sessionCount = data?.sessionCount ?? 0;
  const byDay = data?.byDay ?? [];
  const topObjectives = (data?.byObjective ?? []).slice(0, 5);
  const peakSec = byDay.length > 0 ? Math.max(...byDay.map(d => d.sec), 1) : 1;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onDismiss?.(); onOpenChange(v); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarCheck2 size={18} className="text-primary" />
            Bilan de la semaine
          </DialogTitle>
          <DialogDescription>
            Une lecture rapide pour clore la semaine — et préparer la prochaine.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={20} className="animate-spin text-muted-foreground" />
          </div>
        ) : !data || totalSec === 0 ? (
          <div className="py-8 text-center">
            <Flame size={28} className="mx-auto text-muted-foreground/30 mb-2" />
            <div className="text-sm font-body text-muted-foreground">Aucune session de focus cette semaine.</div>
            <div className="text-[11px] font-body text-muted-foreground/60 mt-1">
              Démarrez un sprint pour voir un bilan ici la semaine prochaine.
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Top stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-border/40 bg-card/40 p-4">
                <div className="flex items-center gap-1.5 text-[10px] font-display font-bold uppercase tracking-wider text-muted-foreground mb-1">
                  <Clock size={11} className="text-emerald-500" />
                  Temps total
                </div>
                <div className="text-2xl font-mono tabular-nums font-bold text-foreground">
                  {formatDuration(totalSec)}
                </div>
              </div>
              <div className="rounded-2xl border border-border/40 bg-card/40 p-4">
                <div className="flex items-center gap-1.5 text-[10px] font-display font-bold uppercase tracking-wider text-muted-foreground mb-1">
                  <Flame size={11} className="text-amber-500" />
                  Sessions
                </div>
                <div className="text-2xl font-mono tabular-nums font-bold text-foreground">
                  {sessionCount}
                </div>
              </div>
            </div>

            {/* By-day bars */}
            <div className="rounded-2xl border border-border/40 bg-card/40 p-4">
              <div className="text-[10px] font-display font-bold uppercase tracking-wider text-muted-foreground mb-3">
                Par jour
              </div>
              <div className="flex items-end justify-between gap-1 h-20">
                {byDay.map((d, i) => {
                  const pct = peakSec > 0 ? (d.sec / peakSec) * 100 : 0;
                  return (
                    <div key={d.date} className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
                      <div className="w-full flex-1 flex items-end">
                        <div
                          className={cn("w-full rounded-t-md transition-all", d.sec > 0 ? "bg-primary/70" : "bg-muted/40")}
                          style={{ height: `${Math.max(pct, 4)}%` }}
                          title={formatDuration(d.sec)}
                        />
                      </div>
                      <span className="text-[10px] font-display text-muted-foreground/70">{DAY_LABELS[i]}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Top objectives */}
            {topObjectives.length > 0 && (
              <div className="rounded-2xl border border-border/40 bg-card/40 p-4">
                <div className="text-[10px] font-display font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                  <Target size={11} className="text-primary" />
                  Objectifs focalisés
                </div>
                <ul className="space-y-1.5">
                  {topObjectives.map(o => {
                    const title = objectiveTextById[o.objectiveId] ?? "(objectif inconnu)";
                    const pct = totalSec > 0 ? Math.round((o.sec / totalSec) * 100) : 0;
                    return (
                      <li key={`${o.source}-${o.objectiveId}`} className="space-y-0.5">
                        <div className="flex items-center gap-2 text-sm font-body">
                          <span className="flex-1 truncate text-foreground">{title}</span>
                          <span className="text-[10px] font-mono tabular-nums text-muted-foreground shrink-0">
                            {formatDuration(o.sec)}
                          </span>
                        </div>
                        <div className="h-1 rounded-full bg-muted/40 overflow-hidden">
                          <div className="h-full rounded-full bg-primary/70" style={{ width: `${pct}%` }} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button onClick={handleClose} className="gap-1.5">
            <CalendarCheck2 size={13} />
            Bonne fin de semaine
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
