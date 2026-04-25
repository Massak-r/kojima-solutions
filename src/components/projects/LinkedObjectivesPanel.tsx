import { useMemo } from "react";
import { Link as RouterLink } from "react-router-dom";
import { Target, ChevronRight, Loader2, Star, Repeat, Flag } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SubtaskItem, Recurrence } from "@/api/todoSubtasks";
import { useObjectives } from "@/hooks/useObjectives";
import { useAllSubtasks } from "@/hooks/useSubtasks";
import { STATUS_CONFIG } from "@/lib/objectiveConstants";
import { EFFORT_CONFIG } from "@/components/todos/SubtaskCard";

interface LinkedObjectivesPanelProps {
  projectId: string;
}

const RECURRENCE_LABEL: Record<Recurrence, string> = {
  daily:    "Jour",
  weekdays: "L-V",
  weekly:   "Hebdo",
  monthly:  "Mois",
};

export function LinkedObjectivesPanel({ projectId }: LinkedObjectivesPanelProps) {
  const { data: allObjectives = [], isLoading: objLoading } = useObjectives();
  const { data: allSubtasks = [], isLoading: subLoading } = useAllSubtasks();
  const loading = objLoading || subLoading;

  const subtasksMap = useMemo(() => {
    const map: Record<string, SubtaskItem[]> = {};
    for (const s of allSubtasks) {
      (map[s.parentId] ??= []).push(s);
    }
    return map;
  }, [allSubtasks]);

  const sorted = useMemo(() => {
    const linked = allObjectives.filter(
      (o) => o.isObjective && !o.completed && o.linkedProjectId === projectId,
    );
    const priRank: Record<string, number> = { high: 0, medium: 1, low: 2 };
    return linked.sort((a, b) => {
      // Objectives with pending flagged subtasks surface first — that's the active sprint
      const aFlag = (subtasksMap[a.id] || []).some(s => s.flaggedToday && !s.completed) ? 0 : 1;
      const bFlag = (subtasksMap[b.id] || []).some(s => s.flaggedToday && !s.completed) ? 0 : 1;
      if (aFlag !== bFlag) return aFlag - bFlag;
      return (priRank[a.priority] ?? 3) - (priRank[b.priority] ?? 3);
    });
  }, [allObjectives, subtasksMap, projectId]);

  const totalFlagged = useMemo(
    () => sorted.reduce(
      (acc, obj) => acc + (subtasksMap[obj.id] || []).filter(s => s.flaggedToday && !s.completed).length,
      0,
    ),
    [sorted, subtasksMap],
  );

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
        <div className="flex items-center gap-2 min-w-0">
          <Target size={14} className="text-primary shrink-0" />
          <h2 className="font-display text-xs font-bold text-muted-foreground uppercase tracking-widest truncate">
            Objectifs liés · {sorted.length}
          </h2>
          {totalFlagged > 0 && (
            <span className="inline-flex items-center gap-0.5 text-[9px] font-body font-semibold bg-amber-100 text-amber-800 border border-amber-200 rounded-full px-1.5 py-0.5 shrink-0">
              <Star size={8} className="fill-amber-500 text-amber-500" />
              {totalFlagged} aujourd'hui
            </span>
          )}
        </div>
        <RouterLink
          to="/sprint"
          className="text-xs font-body text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors shrink-0"
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
          const flaggedSubs = subs
            .filter(s => s.flaggedToday && !s.completed)
            .sort((a, b) => a.order - b.order);
          const statusCfg = STATUS_CONFIG[obj.status];
          const category = obj.source === "personal" ? null : obj.category ?? null;
          const goal = obj.description?.trim() || obj.definitionOfDone?.trim() || null;
          const hasExpandedContent = flaggedSubs.length > 0 || !!goal;

          return (
            <div key={`${obj.source}:${obj.id}`}>
              <RouterLink
                to={`/objective/${obj.source}/${obj.id}`}
                state={{ from: `/project/${projectId}/brief` }}
                className="group flex items-center gap-3 px-5 py-3 hover:bg-secondary/30 transition-colors"
              >
                <Target size={13} className="text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-body text-sm font-medium text-foreground truncate">
                      {obj.text}
                    </span>
                    {flaggedSubs.length > 0 && (
                      <span className="inline-flex items-center gap-0.5 text-[9px] font-body font-semibold bg-amber-100 text-amber-800 border border-amber-200 rounded-full px-1.5 py-0.5 shrink-0">
                        <Star size={8} className="fill-amber-500 text-amber-500" />
                        {flaggedSubs.length}
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

              {hasExpandedContent && (
                <div className="px-5 pb-3 pt-0 space-y-2">
                  {goal && (
                    <div className="flex items-start gap-1.5 text-[11px] font-body text-muted-foreground italic leading-snug">
                      <Flag size={11} className="shrink-0 mt-0.5 text-primary/60" />
                      <span className="line-clamp-3">{goal}</span>
                    </div>
                  )}

                  {flaggedSubs.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <Star size={10} className="fill-amber-400 text-amber-400" />
                        <span className="text-[9px] font-display font-bold uppercase tracking-wider text-foreground/50">
                          Sprint du jour · {flaggedSubs.length}
                        </span>
                      </div>
                      <ul className="space-y-1">
                        {flaggedSubs.map(sub => {
                          const effortCfg = sub.effortSize ? EFFORT_CONFIG[sub.effortSize] : null;
                          return (
                            <li
                              key={sub.id}
                              className="flex items-start gap-2 text-xs font-body text-foreground/85 bg-amber-50/50 dark:bg-amber-500/5 border border-amber-200/50 dark:border-amber-500/20 rounded-lg px-2.5 py-1.5"
                            >
                              <Star size={11} className="shrink-0 mt-0.5 fill-amber-400 text-amber-400" />
                              <span className="flex-1 min-w-0 break-words">{sub.text}</span>
                              <div className="flex items-center gap-1 shrink-0">
                                {sub.priority === "high" && (
                                  <span
                                    className="inline-flex items-center text-[9px] font-body font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300"
                                    title="Priorité haute"
                                  >
                                    !
                                  </span>
                                )}
                                {effortCfg && (
                                  <span
                                    className={cn(
                                      "inline-flex items-center text-[9px] font-body font-bold px-1.5 py-0.5 rounded-full border",
                                      effortCfg.bg, effortCfg.text, effortCfg.border,
                                    )}
                                    title={effortCfg.label}
                                  >
                                    {effortCfg.short}
                                  </span>
                                )}
                                {sub.recurrence && (
                                  <span
                                    className="inline-flex items-center gap-0.5 text-[9px] font-body font-bold px-1.5 py-0.5 rounded-full border border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-500/40 dark:bg-sky-500/10 dark:text-sky-400"
                                    title={`Récurrente : ${sub.recurrence}`}
                                  >
                                    <Repeat size={9} />
                                    {RECURRENCE_LABEL[sub.recurrence]}
                                  </span>
                                )}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
