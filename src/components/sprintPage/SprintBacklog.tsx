import { Star, ChevronRight, CornerDownRight, Hourglass, CalendarPlus, Repeat, FolderKanban, Flame, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMemo } from "react";
import type { SubtaskItem, Recurrence } from "@/api/todoSubtasks";
import type { UnifiedObjective } from "@/api/objectiveSource";
import type { SprintItem } from "@/components/sprint/SprintCapProvider";
import type { StoredProject } from "@/contexts/ProjectsContext";
import { EFFORT_CONFIG } from "@/components/todos/SubtaskCard";
import { daysSinceFlagged, STALE_THRESHOLD_DAYS } from "./helpers";
import { recurrenceShortLabel } from "@/lib/recurrencePeriod";

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
  onToggleTier: (item: SprintItem) => void;
}

export function SprintBacklog({
  items, subtaskById, objectivesById, projectsById,
  backlogPending, backlogDone, isOverCap, onJump, onPostpone, onToggleTier,
}: SprintBacklogProps) {
  const mustItems = items.filter(i => itemTier(i) === "must" && !isItemCompleted(i));
  const niceItems = items.filter(i => itemTier(i) === "nice" && !isItemCompleted(i));
  const doneItems = items.filter(i => isItemCompleted(i));

  // Recurring-task progress bar in the header. Group by recurrence type so the
  // user can see at a glance "today's quotidiennes done", "this week's hebdo
  // done", etc. The `completed` flag is period-scoped (backend resets it on
  // period change), so counting completed == done for the current period.
  const recurringByKind = useMemo(() => {
    const buckets: Record<Recurrence, { done: number; total: number }> = {
      daily:    { done: 0, total: 0 },
      weekdays: { done: 0, total: 0 },
      weekly:   { done: 0, total: 0 },
      monthly:  { done: 0, total: 0 },
    };
    for (const item of items) {
      if (item.kind !== "subtask") continue;
      const r = item.subtask.recurrence;
      if (!r) continue;
      buckets[r].total += 1;
      if (item.subtask.completed) buckets[r].done += 1;
    }
    return buckets;
  }, [items]);

  const recurringEntries = (Object.entries(recurringByKind) as [Recurrence, { done: number; total: number }][])
    .filter(([, v]) => v.total > 0);

  return (
    <section className="rounded-2xl border border-border/40 bg-gradient-to-br from-amber-50/30 via-card/40 to-card/30 dark:from-amber-500/5 p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <Star size={14} className="fill-amber-400 text-amber-400" />
        <span className="text-xs font-display font-bold text-foreground/70 uppercase tracking-wider">
          Sprint en cours
        </span>
        <span className={cn(
          "text-[11px] font-mono tabular-nums",
          isOverCap ? "text-red-600 font-semibold" : "text-muted-foreground",
        )}>
          · {mustItems.length} <span className="text-red-600">must</span>
          {" · "}{niceItems.length} <span className="text-sky-600">nice</span>
          {doneItems.length > 0 && <> · {doneItems.length} done</>}
          {isOverCap && <span className="ml-1 text-red-500">⚠</span>}
        </span>
      </div>

      {recurringEntries.length > 0 && (
        <div className="flex items-center gap-1.5 mb-3 flex-wrap text-[11px] font-body">
          <Repeat size={11} className="text-violet-500 shrink-0" />
          <span className="text-muted-foreground/80 font-display font-bold uppercase tracking-wider text-[10px]">
            Récurrentes
          </span>
          {recurringEntries.map(([kind, { done, total }]) => {
            const complete = done === total;
            return (
              <span
                key={kind}
                className={cn(
                  "px-1.5 py-0.5 rounded-full border tabular-nums",
                  complete
                    ? "bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                    : "bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/25",
                )}
                title={`${done} / ${total} ${recurrenceShortLabel(kind)} ${complete ? "— toutes faites" : "à faire"}`}
              >
                {recurrenceShortLabel(kind)} {done}/{total}
              </span>
            );
          })}
        </div>
      )}

      {/* Must-have zone */}
      <TierZone
        kind="must"
        items={mustItems}
        subtaskById={subtaskById}
        objectivesById={objectivesById}
        projectsById={projectsById}
        onJump={onJump}
        onPostpone={onPostpone}
        onToggleTier={onToggleTier}
      />

      {/* Nice-to-have zone */}
      <TierZone
        kind="nice"
        items={niceItems}
        subtaskById={subtaskById}
        objectivesById={objectivesById}
        projectsById={projectsById}
        onJump={onJump}
        onPostpone={onPostpone}
        onToggleTier={onToggleTier}
      />

      {/* Done zone (completed items, collapsed style) */}
      {doneItems.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border/30">
          <div className="text-[10px] font-display font-bold text-muted-foreground/40 uppercase tracking-wider mb-1.5 ml-1">
            Terminé · {doneItems.length}
          </div>
          <ul className="space-y-1">
            {doneItems.map(item => (
              <SprintBacklogRow
                key={itemKey(item)}
                item={item}
                subtaskById={subtaskById}
                objectivesById={objectivesById}
                projectsById={projectsById}
                onJump={onJump}
                onPostpone={onPostpone}
                onToggleTier={onToggleTier}
              />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

interface TierZoneProps {
  kind: "must" | "nice";
  items: SprintItem[];
  subtaskById: Record<string, SubtaskItem>;
  objectivesById: Record<string, UnifiedObjective>;
  projectsById: Record<string, StoredProject>;
  onJump: (item: SprintItem) => void;
  onPostpone: (subId: string) => void;
  onToggleTier: (item: SprintItem) => void;
}

function TierZone({ kind, items, subtaskById, objectivesById, projectsById, onJump, onPostpone, onToggleTier }: TierZoneProps) {
  if (items.length === 0 && kind === "nice") return null; // no nice = nothing to show
  const isMust = kind === "must";

  return (
    <div className={cn(
      "rounded-xl mb-2 last:mb-0",
      isMust
        ? "bg-red-50/40 dark:bg-red-500/5 border border-red-200/40 dark:border-red-500/15"
        : "bg-sky-50/30 dark:bg-sky-500/5 border border-sky-200/30 dark:border-sky-500/15",
    )}>
      <div className="flex items-center gap-1.5 px-3 py-1.5">
        {isMust ? (
          <Flame size={11} className="text-red-500" />
        ) : (
          <Sparkles size={11} className="text-sky-500" />
        )}
        <span className={cn(
          "text-[10px] font-display font-bold uppercase tracking-wider",
          isMust ? "text-red-700 dark:text-red-400" : "text-sky-700 dark:text-sky-400",
        )}>
          {isMust ? "Must-have" : "Nice-to-have"}
        </span>
        <span className="text-[10px] font-mono text-muted-foreground/50">· {items.length}</span>
      </div>

      {items.length === 0 ? (
        <div className="px-3 pb-2.5 text-[11px] font-body italic text-muted-foreground/50">
          Pas de must-have aujourd'hui — jour léger ?
        </div>
      ) : (
        <ul className="space-y-0.5 pb-1.5 px-1">
          {items.map(item => (
            <SprintBacklogRow
              key={itemKey(item)}
              item={item}
              subtaskById={subtaskById}
              objectivesById={objectivesById}
              projectsById={projectsById}
              onJump={onJump}
              onPostpone={onPostpone}
              onToggleTier={onToggleTier}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function itemKey(item: SprintItem): string {
  return item.kind === "subtask" ? `s:${item.subtask.id}` : `t:${item.task.id}`;
}

function itemTier(item: SprintItem): "must" | "nice" {
  if (item.kind === "subtask") return item.subtask.sprintTier ?? "nice";
  return item.task.sprintTier ?? "nice";
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
  onToggleTier: (item: SprintItem) => void;
}

function SprintBacklogRow({ item, subtaskById, objectivesById, projectsById, onJump, onPostpone, onToggleTier }: RowProps) {
  const completed = isItemCompleted(item);
  const tier = itemTier(item);
  const TierIcon = tier === "must" ? Flame : Sparkles;
  const tierTitle = tier === "must" ? "Passer en nice-to-have" : "Passer en must-have";

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
            "w-full text-left rounded-lg border border-transparent hover:border-border/40 hover:bg-card/60 transition-all flex items-start gap-2.5 px-2.5 py-2 pr-20",
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

        {!completed && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); onToggleTier(item); }}
              className={cn(
                "absolute right-9 top-1/2 -translate-y-1/2 transition-all p-1 rounded-md",
                tier === "must"
                  ? "text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
                  : "text-muted-foreground/40 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10",
              )}
              title={tierTitle}
            >
              <TierIcon size={13} className={tier === "must" ? "fill-current" : ""} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onPostpone(sub.id); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-muted-foreground/60 hover:text-sky-600 transition-all p-1 rounded-md hover:bg-sky-50 dark:hover:bg-sky-500/10"
              title="Repousser à demain"
            >
              <CalendarPlus size={13} />
            </button>
          </>
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
          "w-full text-left rounded-lg border border-transparent hover:border-border/40 hover:bg-card/60 transition-all flex items-start gap-2.5 px-2.5 py-2 pr-12",
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

      {!completed && (
        <button
          onClick={(e) => { e.stopPropagation(); onToggleTier(item); }}
          className={cn(
            "absolute right-2 top-1/2 -translate-y-1/2 transition-all p-1 rounded-md",
            tier === "must"
              ? "text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
              : "text-muted-foreground/40 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10",
          )}
          title={tierTitle}
        >
          <TierIcon size={13} className={tier === "must" ? "fill-current" : ""} />
        </button>
      )}
    </li>
  );
}
