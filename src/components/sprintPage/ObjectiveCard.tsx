import { Target, Play, ChevronRight, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SubtaskItem } from "@/api/todoSubtasks";
import type { UnifiedObjective } from "@/api/objectiveSource";
import { STATUS_CONFIG, PRIORITY_BORDER } from "@/lib/objectiveConstants";

interface ObjectiveCardProps {
  objective: UnifiedObjective;
  subtasks: SubtaskItem[];
  onOpen: () => void;
}

export function ObjectiveCard({ objective, subtasks, onOpen }: ObjectiveCardProps) {
  const category = objective.source === "admin" ? objective.category : undefined;
  const flagged   = subtasks.find(s => s.flaggedToday && !s.completed);
  const pending   = subtasks.filter(s => !s.completed);
  const completed = subtasks.filter(s => s.completed);
  const total     = subtasks.length;
  const pct       = total === 0 ? 0 : Math.round((completed.length / total) * 100);
  const statusCfg = STATUS_CONFIG[objective.status];
  const nextAction = flagged ?? pending[0] ?? null;

  return (
    <button
      onClick={onOpen}
      className={cn(
        "text-left rounded-2xl border border-l-4 bg-card/50 hover:bg-card/80 p-4 flex flex-col gap-3 transition-all group",
        PRIORITY_BORDER[objective.priority],
        flagged && "ring-1 ring-amber-300/40 bg-amber-50/10",
      )}
    >
      <div className="flex items-start gap-2">
        <Target size={14} className="text-primary shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-display font-semibold text-foreground break-words line-clamp-2">
            {objective.text}
          </div>
          {category && (
            <div className="text-[10px] font-body text-muted-foreground/70 mt-0.5">{category}</div>
          )}
        </div>
        <ChevronRight size={15} className="text-muted-foreground/30 group-hover:text-primary shrink-0 mt-1 transition-colors" />
      </div>

      {nextAction ? (
        <div className="flex items-center gap-1.5 text-xs font-body text-foreground/70 bg-muted/30 rounded-lg px-2.5 py-1.5">
          {flagged ? (
            <Star size={11} className="fill-amber-400 text-amber-400 shrink-0" />
          ) : (
            <Play size={10} className="text-muted-foreground/60 shrink-0" />
          )}
          <span className="truncate">{nextAction.text}</span>
        </div>
      ) : pending.length === 0 && completed.length > 0 ? (
        <div className="text-[11px] font-body text-emerald-600 dark:text-emerald-500">Toutes les étapes sont terminées ✓</div>
      ) : (
        <div className="text-[11px] font-body text-muted-foreground/50 italic">Aucune étape</div>
      )}

      <div className="flex items-center gap-2 mt-auto">
        {total > 0 && (
          <>
            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all", pct === 100 ? "bg-emerald-500" : "bg-primary")}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-[10px] font-mono text-muted-foreground tabular-nums">
              {completed.length}/{total}
            </span>
          </>
        )}
        {objective.status !== "not_started" && (
          <span className={cn("text-[9px] font-body font-bold px-2 py-0.5 rounded-full", statusCfg.bg, statusCfg.text)}>
            {statusCfg.label}
          </span>
        )}
      </div>
    </button>
  );
}
