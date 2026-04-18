import { useEffect, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { Target, Star, Clock, ChevronRight, Loader2 } from "lucide-react";
import { listObjectives } from "@/api/objectives";
import { listPersonalTodos } from "@/api/personalTodos";
import { listSubtasks } from "@/api/todoSubtasks";
import { getGlobalWeekSummary } from "@/api/objectiveSessions";

function formatDuration(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h === 0) return `${m}min`;
  return `${h}h${m.toString().padStart(2, "0")}`;
}

export function ObjectiveHealthCard() {
  const [activeCount, setActiveCount] = useState(0);
  const [flaggedCount, setFlaggedCount] = useState(0);
  const [weekSec, setWeekSec] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      listObjectives(),
      listPersonalTodos(),
      listSubtasks(undefined, "admin"),
      listSubtasks(undefined, "personal"),
      getGlobalWeekSummary().catch(() => null),
    ])
      .then(([adminObjs, personalObjs, adminSubs, personalSubs, week]) => {
        if (cancelled) return;
        const allObjs = [...adminObjs, ...personalObjs];
        const active = allObjs.filter(o => o.isObjective && !o.completed).length;
        const allSubs = [...adminSubs, ...personalSubs];
        const flagged = allSubs.filter(s => s.flaggedToday && !s.completed).length;
        setActiveCount(active);
        setFlaggedCount(flagged);
        setWeekSec(week?.totalSec ?? 0);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return (
    <RouterLink
      to="/sprint"
      className="block bg-card border border-border rounded-2xl px-4 py-3 hover:bg-secondary/30 transition-colors group"
    >
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <Target size={14} className="text-primary" />
          </div>
          <div>
            <div className="font-display text-xs font-bold text-foreground/80 uppercase tracking-wider leading-tight">
              Sprint
            </div>
            <div className="text-[10px] font-body text-muted-foreground leading-tight">
              Une action à la fois
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 size={14} className="animate-spin" />
            <span className="text-xs font-body">Chargement…</span>
          </div>
        ) : (
          <div className="flex items-center gap-x-5 gap-y-1 flex-wrap text-sm font-body">
            <Stat
              icon={<Clock size={12} className="text-emerald-500" />}
              label="Cette semaine"
              value={weekSec === 0 ? "—" : formatDuration(weekSec)}
            />
            <Stat
              icon={<Star size={12} className="fill-amber-400 text-amber-400" />}
              label="À faire"
              value={flaggedCount}
              dim={flaggedCount === 0}
            />
            <Stat
              icon={<Target size={12} className="text-primary" />}
              label="Objectifs actifs"
              value={activeCount}
              dim={activeCount === 0}
            />
          </div>
        )}

        <ChevronRight size={14} className="text-muted-foreground/40 group-hover:text-muted-foreground ml-auto transition-colors" />
      </div>
    </RouterLink>
  );
}

function Stat({
  icon, label, value, dim,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  dim?: boolean;
}) {
  return (
    <div className={`flex items-center gap-1.5 ${dim ? "opacity-50" : ""}`}>
      {icon}
      <span className="text-[10px] font-body text-muted-foreground uppercase tracking-wider">{label}</span>
      <span className="text-sm font-mono tabular-nums font-semibold text-foreground">{value}</span>
    </div>
  );
}
