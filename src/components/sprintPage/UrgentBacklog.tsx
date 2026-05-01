import { useMemo } from "react";
import { AlertCircle, Clock, ChevronRight, Star, Repeat, FolderKanban } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SubtaskItem } from "@/api/todoSubtasks";
import type { UnifiedObjective } from "@/api/objectiveSource";
import type { TimelineTask } from "@/types/timeline";
import type { StoredProject } from "@/contexts/ProjectsContext";
import { urgentSubtaskFilter } from "@/lib/sprintLimits";
import { sortObjectives } from "@/lib/objectiveCategories";
import { useFlagSubtask } from "@/hooks/useFlagSubtask";
import { useFlagProjectTask } from "@/hooks/useFlagProjectTask";

const MAX_VISIBLE = 10;

const RECURRENCE_LABEL: Record<string, string> = {
  daily: "Quotidien", weekdays: "Lun-Ven", weekly: "Hebdo", monthly: "Mensuel",
};

type UrgentItem =
  | { kind: "subtask"; subtask: SubtaskItem; sortKey: string }
  | { kind: "task"; projectId: string; task: TimelineTask; sortKey: string };

function badgeForSubtask(s: SubtaskItem, today: string, tomorrowStr: string): { label: string; cls: string; icon?: "clock" | "repeat" } | null {
  const recurLabel = s.recurrence ? RECURRENCE_LABEL[s.recurrence] ?? "Récurrent" : null;

  if (!s.dueDate || s.dueDate >= today) {
    if (s.dueDate === today) return { label: "AUJOURD'HUI", cls: "bg-amber-100 text-amber-700 border-amber-200" };
    if (s.priority === "high") return { label: "PRIORITÉ HAUTE", cls: "bg-violet-100 text-violet-700 border-violet-200" };
    if (recurLabel) return { label: recurLabel.toUpperCase(), cls: "bg-sky-100 text-sky-700 border-sky-200", icon: "repeat" };
    return null;
  }
  if (s.dueDate < today) return { label: "EN RETARD", cls: "bg-red-100 text-red-700 border-red-200", icon: "clock" };
  if (s.dueDate === tomorrowStr) return { label: "DEMAIN", cls: "bg-orange-100 text-orange-700 border-orange-200" };
  return { label: "BIENTÔT", cls: "bg-slate-100 text-slate-600 border-slate-200" };
}

function badgeForTask(t: TimelineTask, today: string, tomorrowStr: string): { label: string; cls: string; icon?: "clock" } | null {
  if (!t.deadline) return null;
  if (t.deadline < today) return { label: "EN RETARD", cls: "bg-red-100 text-red-700 border-red-200", icon: "clock" };
  if (t.deadline === today) return { label: "AUJOURD'HUI", cls: "bg-amber-100 text-amber-700 border-amber-200" };
  if (t.deadline === tomorrowStr) return { label: "DEMAIN", cls: "bg-orange-100 text-orange-700 border-orange-200" };
  return { label: "BIENTÔT", cls: "bg-slate-100 text-slate-600 border-slate-200" };
}

function isProjectTaskUrgent(t: TimelineTask, today: string): boolean {
  if (t.flaggedToday) return false;
  if (t.status !== "open") return false;
  if (!t.deadline) return false;
  const inThreeDays = new Date(today);
  inThreeDays.setDate(inThreeDays.getDate() + 3);
  const due = new Date(t.deadline);
  return due <= inThreeDays;
}

interface UrgentBacklogProps {
  allSubtasks: SubtaskItem[];
  objectivesById: Record<string, UnifiedObjective>;
  projects: StoredProject[];
  today: string; // "YYYY-MM-DD"
}

export function UrgentBacklog({ allSubtasks, objectivesById, projects, today }: UrgentBacklogProps) {
  const { flag: flagSubtask } = useFlagSubtask();
  const { flag: flagTask } = useFlagProjectTask();

  const tomorrowStr = useMemo(() => {
    const t = new Date(today);
    t.setDate(t.getDate() + 1);
    return t.toISOString().slice(0, 10);
  }, [today]);

  const urgent = useMemo<UrgentItem[]>(() => {
    const subs = allSubtasks.filter(s => urgentSubtaskFilter(s, today) && objectivesById[s.parentId]);
    const sortedSubs = sortObjectives(subs, today);

    const tasks: { projectId: string; task: TimelineTask }[] = [];
    for (const p of projects) {
      for (const t of p.tasks ?? []) {
        if (isProjectTaskUrgent(t, today)) tasks.push({ projectId: p.id, task: t });
      }
    }
    // Sort tasks: overdue first → deadline asc
    tasks.sort((a, b) => {
      const da = a.task.deadline ?? "9999-99-99";
      const db = b.task.deadline ?? "9999-99-99";
      return da.localeCompare(db);
    });

    const items: UrgentItem[] = [
      ...sortedSubs.map((s): UrgentItem => ({ kind: "subtask", subtask: s, sortKey: s.dueDate ?? "9999-99-99" })),
      ...tasks.map(({ projectId, task }): UrgentItem => ({ kind: "task", projectId, task, sortKey: task.deadline ?? "9999-99-99" })),
    ];
    // Stable mix sort: overdue everywhere first, then by date asc, subtasks before tasks within same date
    items.sort((a, b) => {
      const aOver = a.sortKey < today ? 0 : 1;
      const bOver = b.sortKey < today ? 0 : 1;
      if (aOver !== bOver) return aOver - bOver;
      if (a.sortKey !== b.sortKey) return a.sortKey.localeCompare(b.sortKey);
      return a.kind === "subtask" ? -1 : 1;
    });
    return items;
  }, [allSubtasks, objectivesById, projects, today]);

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
        {visible.map(item => {
          if (item.kind === "subtask") {
            const s = item.subtask;
            const badge = badgeForSubtask(s, today, tomorrowStr);
            const objTitle = objectivesById[s.parentId]?.text;
            return (
              <li key={`s:${s.id}`} className="flex items-center gap-3 px-4 py-2.5">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm font-body font-medium text-foreground break-words">{s.text}</span>
                    {badge && (
                      <span className={cn(
                        "inline-flex items-center gap-0.5 text-[9px] font-body font-bold px-1.5 py-0.5 rounded-full border",
                        badge.cls,
                      )}>
                        {badge.icon === "clock" && <Clock size={8} />}
                        {badge.icon === "repeat" && <Repeat size={8} />}
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
                  onClick={() => flagSubtask(s)}
                  className="shrink-0 text-muted-foreground/30 hover:text-amber-400 transition-colors p-1"
                  title="Ajouter au sprint"
                >
                  <Star size={14} />
                </button>
              </li>
            );
          }

          // Project task row
          const t = item.task;
          const badge = badgeForTask(t, today, tomorrowStr);
          const project = projects.find(p => p.id === item.projectId);
          return (
            <li key={`t:${t.id}`} className="flex items-center gap-3 px-4 py-2.5">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-sm font-body font-medium text-foreground break-words">{t.title}</span>
                  {badge && (
                    <span className={cn(
                      "inline-flex items-center gap-0.5 text-[9px] font-body font-bold px-1.5 py-0.5 rounded-full border",
                      badge.cls,
                    )}>
                      {badge.icon === "clock" && <Clock size={8} />}
                      {badge.label}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 mt-0.5 text-[10px] font-body text-indigo-600 dark:text-indigo-400">
                  <FolderKanban size={9} />
                  <span className="truncate max-w-[280px]">Projet · {project?.title ?? "?"}</span>
                </div>
              </div>
              <button
                onClick={() => flagTask(item.projectId, t)}
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
