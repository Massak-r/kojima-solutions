import { Star, ChevronRight, CornerDownRight, Hourglass, CalendarPlus, Repeat, FolderKanban } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SubtaskItem } from "@/api/todoSubtasks";
import type { UnifiedObjective } from "@/api/objectiveSource";
import type { SprintItem } from "@/components/sprint/SprintCapProvider";
import type { StoredProject } from "@/contexts/ProjectsContext";
import { EFFORT_CONFIG } from "@/components/todos/SubtaskCard";
import { daysSinceFlagged, STALE_THRESHOLD_DAYS } from "./helpers";

interface SprintBacklogProps {
  items: SprintItem[];
  subtaskById: Record<string, SubtaskItem>;
  objectivesById: Record<string, UnifiedObjective>;
  projectsById: Record<string, StoredProject>;
  backlogPending: number;
  backlogDone: number;
  isOverCap?: boolean;
  onJump: (item: SprintItem) => void;
  onPostpone: (subId: string) => void;
}

export function SprintBacklog({
  items, subtaskById, objectivesById, projectsById, backlogPending, backlogDone, isOverCap, onJump, onPostpone,
}: SprintBacklogProps) {
  const total = items.length;
  const doneCount = items.filter(i => isItemCompleted(i)).length;
  const pct = total === 0 ? 0 : Math.round((doneCount / total) * 100);

  return (
    <section className="rounded-2xl border border-border/40 bg-gradient-to-br from-amber-50/30 via-card/40 to-card/30 dark:from-amber-500/5 p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-3">
        <Star size={14} className="fill-amber-400 text-amber-400" />
        <span className="text-xs font-display font-bold text-foreground/70 uppercase tracking-wider">
          Sprint en cours
        </span>
        <span className={cn(
          "text-[11px] font-mono tabular-nums",
          isOverCap ? "text-red-600 font-semibold" : "text-muted-foreground",
        )}>
          · {backlogPending} à faire {backlogDone > 0 && <>· {backlogDone} terminée{backlogDone > 1 ? "s" : ""}</>}
          {isOverCap && <span className="ml-1 text-red-500">⚠</span>}
        </span>
        {total > 1 && (
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
        {items.map(item => (
          <SprintBacklogRow
            key={itemKey(item)}
            item={item}
            subtaskById={subtaskById}
            objectivesById={objectivesById}
            projectsById={projectsById}
            onJump={onJump}
            onPostpone={onPostpone}
          />
        ))}
      </ul>
    </section>
  );
}

function itemKey(item: SprintItem): string {
  return item.kind === "subtask" ? `s:${item.subtask.id}` : `t:${item.task.id}`;
}

function isItemCompleted(item: SprintItem): boolean {
  return item.kind === "subtask" ? item.subtask.completed : item.task.status === "completed";
}

interface RowProps {
  item: SprintItem;
  subtaskById: Record<string, SubtaskItem>;
  objectivesById: Record<string, UnifiedObjective>;
  projectsById: Record<string, StoredProject>;
  onJump: (item: SprintItem) => void;
  onPostpone: (subId: string) => void;
}

function SprintBacklogRow({ item, subtaskById, objectivesById, projectsById, onJump, onPostpone }: RowProps) {
  const completed = isItemCompleted(item);

  if (item.kind === "subtask") {
    const sub = item.subtask;
    const objective = objectivesById[sub.parentId];
    const parentSub = sub.parentSubtaskId ? subtaskById[sub.parentSubtaskId] : null;
    const effortCfg = sub.effortSize ? EFFORT_CONFIG[sub.effortSize] : null;
    const ageDays = daysSinceFlagged(sub);
    const isStale = !sub.completed && ageDays >= STALE_THRESHOLD_DAYS;

    return (
      <li className="relative group">
        <button
          onClick={() => onJump(item)}
          className={cn(
            "w-full text-left rounded-xl border border-transparent hover:border-border/40 hover:bg-card/60 transition-all flex items-start gap-2.5 px-3 py-2.5 pr-16",
            completed && "opacity-50",
          )}
        >
          <Star
            size={13}
            className={cn("shrink-0 mt-0.5 fill-current", completed ? "text-muted-foreground/40" : "text-amber-400")}
          />
          <div className="flex-1 min-w-0">
            <div className={cn(
              "text-sm font-body font-medium text-foreground break-words",
              completed && "line-through text-muted-foreground",
            )}>
              {sub.text}
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
              {sub.recurrence && (
                <span
                  className="inline-flex items-center gap-0.5 text-[9px] font-body font-bold px-1.5 py-0.5 rounded-full border border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-500/40 dark:bg-sky-500/10 dark:text-sky-400"
                  title={`Récurrente : ${sub.recurrence}`}
                >
                  <Repeat size={9} />
                  {sub.recurrence === "daily" ? "Jour" : sub.recurrence === "weekdays" ? "L-V" : sub.recurrence === "weekly" ? "Hebdo" : "Mois"}
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
        {!sub.completed && (
          <button
            onClick={(e) => { e.stopPropagation(); onPostpone(sub.id); }}
            className="absolute right-9 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-muted-foreground/60 hover:text-sky-600 transition-all p-1 rounded-md hover:bg-sky-50 dark:hover:bg-sky-500/10"
            title="Repousser à demain"
          >
            <CalendarPlus size={13} />
          </button>
        )}
      </li>
    );
  }

  // Project task row
  const project = projectsById[item.projectId];
  const task = item.task;

  return (
    <li className="relative group">
      <button
        onClick={() => onJump(item)}
        className={cn(
          "w-full text-left rounded-xl border border-transparent hover:border-border/40 hover:bg-card/60 transition-all flex items-start gap-2.5 px-3 py-2.5 pr-4",
          completed && "opacity-50",
        )}
      >
        <Star
          size={13}
          className={cn("shrink-0 mt-0.5 fill-current", completed ? "text-muted-foreground/40" : "text-amber-400")}
        />
        <div className="flex-1 min-w-0">
          <div className={cn(
            "text-sm font-body font-medium text-foreground break-words",
            completed && "line-through text-muted-foreground",
          )}>
            {task.title}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-body text-muted-foreground/70 mt-0.5 flex-wrap">
            <span className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-semibold">
              <FolderKanban size={10} />
              {project?.title ?? "(projet inconnu)"}
            </span>
            {task.deadline && (
              <span className="text-muted-foreground/60">
                échéance {new Date(task.deadline).toLocaleDateString("fr-CH")}
              </span>
            )}
          </div>
        </div>
        <ChevronRight size={14} className="text-muted-foreground/30 group-hover:text-primary transition-colors mt-1 shrink-0" />
      </button>
    </li>
  );
}
