import { useMemo } from "react";
import { toast } from "sonner";
import { Play, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useProjects } from "@/contexts/ProjectsContext";
import type { TimelineTask } from "@/types/timeline";

function daysSince(ms: number): number {
  return Math.floor((Date.now() - ms) / 86_400_000);
}

/**
 * "Reprise" — context-reload card at the top of a project's steps. Answers
 * "where was I?" in one glance: next actionable step, progress, and last
 * activity. "Reprendre" flags that step into today's sprint so picking a
 * project back up becomes a committed next action, not a re-scan.
 */
export function ProjectResumeCard({ project }: { project: { id: string; tasks?: TimelineTask[] } }) {
  const { updateProject } = useProjects();
  const tasks = project.tasks ?? [];

  const { nextStep, doneCount, total, lastActiveDays } = useMemo(() => {
    const sorted = [...tasks].sort((a, b) => a.order - b.order);
    const done = sorted.filter((t) => t.status === "completed" || t.completed);
    const openNext = sorted.find((t) => t.status === "open" && !t.completed);
    const anyNext = sorted.find((t) => t.status !== "completed" && !t.completed);
    const stamps = sorted
      .map((t) => t.completedAt)
      .filter((d): d is string => !!d)
      .map((d) => new Date(d).getTime());
    return {
      nextStep: openNext ?? anyNext ?? null,
      doneCount: done.length,
      total: sorted.length,
      lastActiveDays: stamps.length ? daysSince(Math.max(...stamps)) : null,
    };
  }, [tasks]);

  if (total === 0) return null;

  function resume() {
    if (!nextStep) return;
    updateProject(project.id, {
      tasks: tasks.map((t) => (t.id === nextStep.id ? { ...t, flaggedToday: true } : t)),
    });
    toast.success("Étape ajoutée à ton sprint", { description: nextStep.title });
  }

  return (
    <div className="mb-6 no-print rounded-2xl border border-border bg-gradient-to-br from-secondary/40 to-card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-body mb-1">Reprise</p>
          {nextStep ? (
            <>
              <p className="font-display text-base sm:text-lg font-semibold text-foreground leading-snug">
                {nextStep.title}
              </p>
              <p className="text-xs text-muted-foreground font-body mt-1">
                {doneCount}/{total} étapes terminées
                {lastActiveDays != null && ` · dernière activité il y a ${lastActiveDays}j`}
              </p>
            </>
          ) : (
            <p className="font-display text-base font-semibold text-foreground inline-flex items-center gap-1.5">
              <CheckCircle2 size={16} className="text-emerald-600" /> Toutes les étapes sont terminées
            </p>
          )}
        </div>
        {nextStep && (
          <Button onClick={resume} className="gap-1.5 shrink-0">
            <Play size={14} /> Reprendre
          </Button>
        )}
      </div>
    </div>
  );
}
