import { useEffect } from "react";
import { Target, Square, ChevronRight, Star, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SubtaskItem } from "@/api/todoSubtasks";
import type { ObjectiveSource, UnifiedObjective } from "@/api/objectiveSource";
import { useFocusSession, formatElapsed } from "@/components/objective/useFocusSession";

interface RadicalFocusViewProps {
  source: ObjectiveSource;
  objective: UnifiedObjective;
  subtasks: SubtaskItem[];
  onComplete: (subId: string) => void;
  onShowDashboard: () => void;
  onOpenWorkspace: () => void;
}

export function RadicalFocusView({
  source, objective, subtasks, onComplete, onShowDashboard, onOpenWorkspace,
}: RadicalFocusViewProps) {
  const session = useFocusSession({ source, objectiveId: objective.id });
  const focused = subtasks.find(s => s.flaggedToday && !s.completed);
  const remainingFlagged = subtasks.filter(s => s.flaggedToday && !s.completed).length;

  // Esc exits radical focus mode back to the full dashboard
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      e.preventDefault();
      onShowDashboard();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onShowDashboard]);

  return (
    <section className="relative rounded-3xl border-2 border-emerald-500/40 bg-gradient-to-br from-emerald-500/5 via-card/40 to-card/30 p-8 sm:p-12 min-h-[60vh] flex flex-col items-center justify-center text-center">
      <button
        onClick={onShowDashboard}
        className="absolute top-4 left-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-body font-medium bg-background/60 backdrop-blur-sm border border-border/60 text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
        aria-label="Quitter le mode focus radical (Esc)"
        title="Quitter (Esc)"
      >
        <ArrowLeft size={13} />
        <span className="hidden sm:inline">Retour</span>
        <kbd className="ml-1 px-1 py-px text-[9px] font-mono font-semibold rounded bg-muted/60 text-muted-foreground border border-border/40 hidden sm:inline-block">Esc</kbd>
      </button>
      <div className="flex items-center gap-2 mb-6">
        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        <span className="text-[10px] font-display font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
          En cours
        </span>
      </div>

      <div className="font-mono tabular-nums text-5xl sm:text-6xl font-bold text-foreground mb-3">
        {formatElapsed(session.elapsedSec)}
      </div>

      <button
        onClick={onOpenWorkspace}
        className="text-xs font-body text-muted-foreground hover:text-foreground transition-colors mb-8 flex items-center gap-1"
      >
        <Target size={11} />
        {objective.text}
        <ChevronRight size={11} />
      </button>

      {focused ? (
        <div className="max-w-xl mb-10">
          <div className="flex items-center justify-center gap-1.5 mb-2">
            <Star size={14} className="fill-amber-400 text-amber-400" />
            <span className="text-[10px] font-display font-bold uppercase tracking-wider text-foreground/50">
              Action en cours
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-display font-semibold text-foreground break-words leading-tight">
            {focused.text}
          </h2>
        </div>
      ) : (
        <div className="text-sm font-body text-muted-foreground italic mb-10 max-w-xs">
          Aucune étape focalisée. Ouvrez l'objectif pour en marquer une, ou stoppez la session.
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-center gap-2.5 mb-6">
        {focused && (
          <Button
            size="lg"
            onClick={() => onComplete(focused.id)}
            className="rounded-full px-6 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Star size={14} className="fill-white" />
            J'ai fini, je continue
          </Button>
        )}
        <Button
          size="lg"
          variant="outline"
          onClick={() => session.stop()}
          className="rounded-full px-6 gap-1.5 border-emerald-500/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10"
        >
          <Square size={14} />
          J'ai fini, je stoppe
        </Button>
      </div>

      {remainingFlagged > 1 && (
        <div className="text-[11px] font-mono tabular-nums text-muted-foreground mb-3">
          · {remainingFlagged - (focused ? 1 : 0)} autre{(remainingFlagged - (focused ? 1 : 0)) > 1 ? "s" : ""} flaggée{(remainingFlagged - (focused ? 1 : 0)) > 1 ? "s" : ""} après celle-ci
        </div>
      )}

      <button
        onClick={onShowDashboard}
        className="text-[11px] font-body text-muted-foreground/60 hover:text-foreground underline-offset-2 hover:underline transition-colors mt-2"
      >
        Voir le tableau complet
      </button>
    </section>
  );
}
