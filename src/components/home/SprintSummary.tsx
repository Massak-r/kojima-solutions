import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Target, Flame, Sparkles, CheckCircle2, ChevronRight } from "lucide-react";
import { useAllSubtasks } from "@/hooks/useSubtasks";
import { useProjects } from "@/contexts/ProjectsContext";

/**
 * Compact summary card linking to /sprint.
 * Shows "X must · Y nice · Z done" across both subtasks and project tasks.
 */
export function SprintSummary() {
  const navigate = useNavigate();
  const { data: allSubtasks = [] } = useAllSubtasks();
  const { projects } = useProjects();

  const counts = useMemo(() => {
    let must = 0, nice = 0, done = 0;
    for (const s of allSubtasks) {
      if (!s.flaggedToday) continue;
      if (s.completed) { done++; continue; }
      if (s.sprintTier === "must") must++;
      else nice++;
    }
    for (const p of projects) {
      for (const t of p.tasks ?? []) {
        if (!t.flaggedToday) continue;
        if (t.status === "completed") { done++; continue; }
        if (t.sprintTier === "must") must++;
        else nice++;
      }
    }
    return { must, nice, done };
  }, [allSubtasks, projects]);

  const total = counts.must + counts.nice + counts.done;

  return (
    <button
      onClick={() => navigate("/sprint")}
      className="w-full text-left rounded-2xl border border-border/40 bg-gradient-to-br from-amber-50/30 via-card/40 to-card/30 dark:from-amber-500/5 px-5 py-4 flex items-center gap-4 hover:border-border transition-all group"
    >
      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
        <Target size={18} className="text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-display text-sm font-semibold text-foreground">
          Aujourd'hui
        </div>
        {total === 0 ? (
          <div className="text-xs font-body text-muted-foreground mt-0.5">
            Sprint vide — clique pour t'engager sur la journée.
          </div>
        ) : (
          <div className="flex items-center gap-3 mt-1 text-xs font-body">
            <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400 font-semibold">
              <Flame size={11} />
              {counts.must} must
            </span>
            <span className="inline-flex items-center gap-1 text-sky-600 dark:text-sky-400 font-semibold">
              <Sparkles size={11} />
              {counts.nice} nice
            </span>
            {counts.done > 0 && (
              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                <CheckCircle2 size={11} />
                {counts.done} done
              </span>
            )}
          </div>
        )}
      </div>
      <ChevronRight size={16} className="text-muted-foreground/40 group-hover:text-foreground transition-colors shrink-0" />
    </button>
  );
}
