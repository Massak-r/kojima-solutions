import { Target, Square, ChevronRight, Clock, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SubtaskItem } from "@/api/todoSubtasks";
import type { ObjectiveSource, UnifiedObjective } from "@/api/objectiveSource";
import { useFocusSession, formatElapsed } from "@/components/objective/useFocusSession";

interface RunningSessionBannerProps {
  source: ObjectiveSource;
  objective: UnifiedObjective;
  subtasks: SubtaskItem[];
  onOpen: () => void;
}

export function RunningSessionBanner({ source, objective, subtasks, onOpen }: RunningSessionBannerProps) {
  const session = useFocusSession({ source, objectiveId: objective.id });
  const focused = subtasks.find(s => s.flaggedToday && !s.completed);

  return (
    <div className="rounded-2xl border-2 border-emerald-500/60 bg-gradient-to-br from-emerald-500/10 via-primary/5 to-transparent p-5 shadow-[0_0_0_1px_rgba(16,185,129,0.2)]">
      <div className="flex items-center gap-2 mb-3">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-display font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
            En cours
          </span>
        </div>
        <div className="ml-auto flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-mono tabular-nums text-sm font-bold">
          <Clock size={14} />
          {formatElapsed(session.elapsedSec)}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Target size={14} className="text-primary shrink-0" />
            <span className="text-sm font-body font-semibold text-foreground/70 truncate">{objective.text}</span>
          </div>
          {focused ? (
            <div className="text-base sm:text-lg font-display font-semibold text-foreground break-words flex items-center gap-1.5">
              <Star size={14} className="fill-amber-400 text-amber-400 shrink-0" />
              {focused.text}
            </div>
          ) : (
            <div className="text-sm font-body text-muted-foreground italic">Aucune étape focalisée</div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            variant="outline"
            onClick={() => session.stop()}
            className="h-9 px-4 rounded-full border-emerald-500/50 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10"
          >
            <Square size={13} className="mr-1.5" />
            Stop
          </Button>
          <Button size="sm" onClick={onOpen} className="h-9 px-4 rounded-full">
            Ouvrir
            <ChevronRight size={14} className="ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}
