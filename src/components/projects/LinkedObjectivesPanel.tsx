import { useEffect, useMemo, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { Target, ChevronRight, Loader2, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { listObjectives } from "@/api/objectives";
import type { ObjectiveItem } from "@/api/objectives";
import { listPersonalTodos } from "@/api/personalTodos";
import type { PersonalTodoItem } from "@/api/personalTodos";
import { listSubtasks } from "@/api/todoSubtasks";
import type { SubtaskItem } from "@/api/todoSubtasks";
import type { ObjectiveSource } from "@/api/objectiveSource";
import { STATUS_CONFIG } from "@/lib/objectiveConstants";

type LinkedObjective = (ObjectiveItem | PersonalTodoItem) & { source: ObjectiveSource };

interface LinkedObjectivesPanelProps {
  projectId: string;
}

export function LinkedObjectivesPanel({ projectId }: LinkedObjectivesPanelProps) {
  const [objectives, setObjectives] = useState<LinkedObjective[]>([]);
  const [subtasksMap, setSubtasksMap] = useState<Record<string, SubtaskItem[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      listObjectives(),
      listPersonalTodos(),
      listSubtasks(undefined, "admin"),
      listSubtasks(undefined, "personal"),
    ])
      .then(([adminObjs, personalObjs, adminSubs, personalSubs]) => {
        if (cancelled) return;
        const tagged: LinkedObjective[] = [
          ...adminObjs.map(o => ({ ...o, source: "admin" as const })),
          ...personalObjs.map(o => ({ ...o, source: "personal" as const })),
        ];
        const linked = tagged.filter(o =>
          o.isObjective && !o.completed && o.linkedProjectId === projectId
        );
        setObjectives(linked);

        const map: Record<string, SubtaskItem[]> = {};
        for (const s of [...adminSubs, ...personalSubs]) {
          (map[s.parentId] ??= []).push(s);
        }
        setSubtasksMap(map);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [projectId]);

  const sorted = useMemo(() => {
    const priRank: Record<string, number> = { high: 0, medium: 1, low: 2 };
    return [...objectives].sort((a, b) => (priRank[a.priority] ?? 3) - (priRank[b.priority] ?? 3));
  }, [objectives]);

  if (loading) {
    return (
      <section className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border">
          <Target size={14} className="text-primary" />
          <h2 className="font-display text-xs font-bold text-muted-foreground uppercase tracking-widest">
            Objectifs liés
          </h2>
        </div>
        <div className="flex justify-center py-8">
          <Loader2 size={18} className="animate-spin text-muted-foreground" />
        </div>
      </section>
    );
  }

  if (sorted.length === 0) {
    return null;
  }

  return (
    <section className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-5 py-3.5 border-b border-border">
        <div className="flex items-center gap-2">
          <Target size={14} className="text-primary" />
          <h2 className="font-display text-xs font-bold text-muted-foreground uppercase tracking-widest">
            Objectifs liés · {sorted.length}
          </h2>
        </div>
        <RouterLink
          to="/sprint"
          className="text-xs font-body text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
        >
          Sprint <ChevronRight size={11} />
        </RouterLink>
      </div>
      <div className="divide-y divide-border/40">
        {sorted.map(obj => {
          const subs = subtasksMap[obj.id] || [];
          const total = subs.length;
          const done = subs.filter(s => s.completed).length;
          const pct = total === 0 ? 0 : Math.round((done / total) * 100);
          const flagged = subs.filter(s => s.flaggedToday && !s.completed).length;
          const statusCfg = STATUS_CONFIG[obj.status];
          const category = "category" in obj ? obj.category : null;

          return (
            <RouterLink
              key={`${obj.source}:${obj.id}`}
              to={`/objective/${obj.source}/${obj.id}`}
              state={{ from: `/project/${projectId}/brief` }}
              className="flex items-center gap-3 px-5 py-3 hover:bg-secondary/30 transition-colors group"
            >
              <Target size={13} className="text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-body text-sm font-medium text-foreground truncate">
                    {obj.text}
                  </span>
                  {flagged > 0 && (
                    <span className="inline-flex items-center gap-0.5 text-[9px] font-body font-semibold bg-amber-100 text-amber-800 border border-amber-200 rounded-full px-1.5 py-0.5 shrink-0">
                      <Star size={8} className="fill-amber-500 text-amber-500" />
                      {flagged}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-[10px] font-body text-muted-foreground">
                  {category && <span className="truncate max-w-[140px]">{category}</span>}
                  {obj.source === "personal" && <span className="text-violet-500">Perso</span>}
                  {total > 0 && (
                    <>
                      <div className="h-1 w-20 bg-border rounded-full overflow-hidden">
                        <div
                          className={cn("h-full rounded-full transition-all", pct === 100 ? "bg-emerald-500" : "bg-primary")}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="tabular-nums">{done}/{total}</span>
                    </>
                  )}
                </div>
              </div>
              <span className={cn("text-[9px] font-body font-bold px-2 py-0.5 rounded-full shrink-0", statusCfg.bg, statusCfg.text)}>
                {statusCfg.label}
              </span>
              <ChevronRight size={13} className="text-muted-foreground/30 group-hover:text-muted-foreground transition-colors shrink-0" />
            </RouterLink>
          );
        })}
      </div>
    </section>
  );
}
