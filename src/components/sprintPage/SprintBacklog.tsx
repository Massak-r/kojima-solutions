import { Star, ChevronRight, CornerDownRight, Hourglass, CalendarPlus, Repeat } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SubtaskItem } from "@/api/todoSubtasks";
import type { ObjectiveSource, UnifiedObjective } from "@/api/objectiveSource";
import { EFFORT_CONFIG } from "@/components/todos/SubtaskCard";
import { daysSinceFlagged, STALE_THRESHOLD_DAYS } from "./helpers";

interface SprintBacklogProps {
  items: SubtaskItem[];
  subtaskById: Record<string, SubtaskItem>;
  objectivesById: Record<string, UnifiedObjective>;
  backlogPending: number;
  backlogDone: number;
  onJump: (source: ObjectiveSource, objectiveId: string) => void;
  onPostpone: (subId: string) => void;
}

export function SprintBacklog({
  items, subtaskById, objectivesById, backlogPending, backlogDone, onJump, onPostpone,
}: SprintBacklogProps) {
  const pct = items.length === 0 ? 0 : Math.round((backlogDone / items.length) * 100);

  return (
    <section className="rounded-2xl border border-border/40 bg-gradient-to-br from-amber-50/30 via-card/40 to-card/30 dark:from-amber-500/5 p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-3">
        <Star size={14} className="fill-amber-400 text-amber-400" />
        <span className="text-xs font-display font-bold text-foreground/70 uppercase tracking-wider">
          Sprint en cours
        </span>
        <span className="text-[11px] font-mono tabular-nums text-muted-foreground">
          · {backlogPending} à faire {backlogDone > 0 && <>· {backlogDone} terminée{backlogDone > 1 ? "s" : ""}</>}
        </span>
        {items.length > 1 && (
          <div className="ml-auto flex items-center gap-2 min-w-[100px] max-w-[160px]">
            <div className="flex-1 h-1.5 rounded-full bg-muted/40 overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all", pct === 100 ? "bg-emerald-500" : "bg-amber-400")}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-[10px] font-mono tabular-nums text-muted-foreground shrink-0">{pct}%</span>
          </div>
        )}
      </div>

      <ul className="space-y-1">
        {items.map(item => {
          const objective = objectivesById[item.parentId];
          const parentSub = item.parentSubtaskId ? subtaskById[item.parentSubtaskId] : null;
          const src: ObjectiveSource = item.source === "personal" ? "personal" : "admin";
          const effortCfg = item.effortSize ? EFFORT_CONFIG[item.effortSize] : null;
          const ageDays = daysSinceFlagged(item);
          const isStale = !item.completed && ageDays >= STALE_THRESHOLD_DAYS;
          return (
            <li key={item.id} className="relative group">
              <button
                onClick={() => onJump(src, item.parentId)}
                className={cn(
                  "w-full text-left rounded-xl border border-transparent hover:border-border/40 hover:bg-card/60 transition-all flex items-start gap-2.5 px-3 py-2.5 pr-16",
                  item.completed && "opacity-50",
                )}
              >
                <Star
                  size={13}
                  className={cn("shrink-0 mt-0.5 fill-current", item.completed ? "text-muted-foreground/40" : "text-amber-400")}
                />
                <div className="flex-1 min-w-0">
                  <div className={cn(
                    "text-sm font-body font-medium text-foreground break-words",
                    item.completed && "line-through text-muted-foreground",
                  )}>
                    {item.text}
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] font-body text-muted-foreground/70 mt-0.5 flex-wrap">
                    <span className="truncate max-w-[240px]">{objective?.text ?? "(objectif inconnu)"}</span>
                    {parentSub && (
                      <>
                        <CornerDownRight size={10} className="text-muted-foreground/40" />
                        <span className="truncate max-w-[200px]">{parentSub.text}</span>
                      </>
                    )}
                    {effortCfg && (
                      <span className={cn(
                        "inline-flex items-center gap-0.5 text-[9px] font-body font-bold px-1.5 py-0.5 rounded-full border",
                        effortCfg.bg, effortCfg.text, effortCfg.border,
                      )}>
                        {effortCfg.short}
                      </span>
                    )}
                    {item.recurrence && (
                      <span
                        className="inline-flex items-center gap-0.5 text-[9px] font-body font-bold px-1.5 py-0.5 rounded-full border border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-500/40 dark:bg-sky-500/10 dark:text-sky-400"
                        title={`Récurrente : ${item.recurrence}`}
                      >
                        <Repeat size={9} />
                        {item.recurrence === "daily" ? "Jour" : item.recurrence === "weekdays" ? "L-V" : item.recurrence === "weekly" ? "Hebdo" : "Mois"}
                      </span>
                    )}
                    {isStale && (
                      <span
                        className="inline-flex items-center gap-0.5 text-[9px] font-body font-bold px-1.5 py-0.5 rounded-full border border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-400"
                        title={`Flaggée depuis ${ageDays} jour${ageDays > 1 ? "s" : ""} — à faire ou à retirer du sprint`}
                      >
                        <Hourglass size={9} />
                        {ageDays}j
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight size={14} className="text-muted-foreground/30 group-hover:text-primary transition-colors mt-1 shrink-0" />
              </button>
              {!item.completed && (
                <button
                  onClick={(e) => { e.stopPropagation(); onPostpone(item.id); }}
                  className="absolute right-9 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-muted-foreground/60 hover:text-sky-600 transition-all p-1 rounded-md hover:bg-sky-50 dark:hover:bg-sky-500/10"
                  title="Repousser à demain"
                >
                  <CalendarPlus size={13} />
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
