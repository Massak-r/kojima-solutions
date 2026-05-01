import { useMemo } from "react";
import { AlertCircle, Clock, ChevronRight, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SubtaskItem } from "@/api/todoSubtasks";
import type { UnifiedObjective } from "@/api/objectiveSource";
import { urgentSubtaskFilter } from "@/lib/sprintLimits";
import { sortObjectives } from "@/lib/objectiveCategories";
import { useFlagSubtask } from "@/hooks/useFlagSubtask";

const MAX_VISIBLE = 10;

function urgencyBadge(s: SubtaskItem, today: string): { label: string; cls: string } | null {
  if (!s.dueDate || s.dueDate >= today) {
    // No date — must be high priority
    if (s.priority === "high") return { label: "PRIORITÉ HAUTE", cls: "bg-violet-100 text-violet-700 border-violet-200" };
    return null;
  }
  if (s.dueDate < today) return { label: "EN RETARD", cls: "bg-red-100 text-red-700 border-red-200" };
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);
  if (s.dueDate === today) return { label: "AUJOURD'HUI", cls: "bg-amber-100 text-amber-700 border-amber-200" };
  if (s.dueDate === tomorrowStr) return { label: "DEMAIN", cls: "bg-orange-100 text-orange-700 border-orange-200" };
  return { label: "BIENTÔT", cls: "bg-slate-100 text-slate-600 border-slate-200" };
}

interface UrgentBacklogProps {
  allSubtasks: SubtaskItem[];
  objectivesById: Record<string, UnifiedObjective>;
  today: string; // "YYYY-MM-DD"
}

export function UrgentBacklog({ allSubtasks, objectivesById, today }: UrgentBacklogProps) {
  const { flag } = useFlagSubtask();

  const urgent = useMemo(() => {
    const candidates = allSubtasks.filter(
      s => urgentSubtaskFilter(s, today) && objectivesById[s.parentId],
    );
    // Reuse sortObjectives logic adapted for SubtaskItem
    return sortObjectives(candidates, today);
  }, [allSubtasks, objectivesById, today]);

  if (urgent.length === 0) return null;

  const visible = urgent.slice(0, MAX_VISIBLE);
  const extra = urgent.length - MAX_VISIBLE;

  return (
    <div className="rounded-2xl border border-amber-200/60 bg-amber-50/30 dark:bg-amber-500/5 dark:border-amber-500/20 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-amber-200/40">
        <AlertCircle size={14} className="text-amber-600 shrink-0" />
        <h2 className="text-xs font-display font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
          À ne pas oublier · {urgent.length} item{urgent.length > 1 ? "s" : ""}
        </h2>
      </div>

      <ul className="divide-y divide-amber-100/60 dark:divide-amber-500/10">
        {visible.map(s => {
          const badge = urgencyBadge(s, today);
          const objTitle = objectivesById[s.parentId]?.text;

          return (
            <li key={s.id} className="flex items-center gap-3 px-4 py-2.5">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-sm font-body font-medium text-foreground break-words">
                    {s.text}
                  </span>
                  {badge && (
                    <span className={cn(
                      "inline-flex items-center gap-0.5 text-[9px] font-body font-bold px-1.5 py-0.5 rounded-full border",
                      badge.cls,
                    )}>
                      {badge.label === "EN RETARD" && <Clock size={8} />}
                      {badge.label}
                    </span>
                  )}
                </div>
                {objTitle && (
                  <div className="flex items-center gap-1 mt-0.5 text-[10px] font-body text-muted-foreground/60">
                    <ChevronRight size={9} />
                    <span className="truncate max-w-[280px]">{objTitle}</span>
                  </div>
                )}
              </div>

              <button
                onClick={() => flag(s)}
                className="shrink-0 text-muted-foreground/30 hover:text-amber-400 transition-colors p-1"
                title="Ajouter au sprint"
              >
                <Star size={14} />
              </button>
            </li>
          );
        })}
      </ul>

      {extra > 0 && (
        <div className="px-4 py-2 text-xs font-body text-muted-foreground/60 border-t border-amber-100/60">
          + {extra} autre{extra > 1 ? "s" : ""}
        </div>
      )}
    </div>
  );
}
