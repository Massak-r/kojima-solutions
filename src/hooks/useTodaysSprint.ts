import { useMemo } from "react";
import { useAllSubtasks } from "@/hooks/useSubtasks";
import { useObjectives } from "@/hooks/useObjectives";
import { useProjects, type StoredProject } from "@/contexts/ProjectsContext";
import { recurrenceMatchesDate, toISODate } from "@/lib/weekDates";
import { urgentSubtaskFilter, DAILY_SPRINT_CAP } from "@/lib/sprintLimits";
import type { SubtaskItem } from "@/api/todoSubtasks";
import type { TimelineTask } from "@/types/timeline";
import type { UnifiedObjective } from "@/api/objectiveSource";

/**
 * Single source of truth for "what's on today" — flagged sprint items
 * (subtasks across objectives + project tasks), what's already done, and
 * unflagged items that belong to today (recurring-due-today / scheduled /
 * urgent). The "Aujourd'hui" home surface composes this; /sprint keeps its
 * richer deep-work view but shares the same selection semantics.
 */

export interface TodaySubtaskItem {
  kind: "subtask";
  id: string;
  subtask: SubtaskItem;
  objective: UnifiedObjective | null;
}
export interface TodayTaskItem {
  kind: "task";
  id: string;
  task: TimelineTask;
  project: StoredProject;
}
export type TodayItem = TodaySubtaskItem | TodayTaskItem;

/** Why an unflagged item is being suggested for today. */
export type SuggestionReason = "recurring" | "scheduled" | "urgent";

export interface TodaySuggestion extends TodaySubtaskItem {
  reason: SuggestionReason;
}

export interface TodaysSprint {
  flagged: TodayItem[];
  done: TodayItem[];
  suggestions: TodaySuggestion[];
  counts: { pending: number; must: number; nice: number; done: number; cap: number; capReached: boolean };
}

function tierOf(item: TodayItem): "must" | "nice" {
  const t = item.kind === "subtask" ? item.subtask.sprintTier : item.task.sprintTier;
  return t === "must" ? "must" : "nice";
}
function priorityRank(item: TodayItem): number {
  const p = item.kind === "subtask" ? item.subtask.priority : "medium";
  return p === "high" ? 0 : p === "medium" ? 1 : 2;
}

export function useTodaysSprint(): TodaysSprint {
  const { data: allSubtasks = [] } = useAllSubtasks();
  const { data: objectives = [] } = useObjectives();
  const { projects } = useProjects();

  return useMemo(() => {
    const objById = new Map(objectives.map((o) => [o.id, o]));
    const now = new Date();
    const today = toISODate(now);

    const flaggedSub: TodayItem[] = allSubtasks
      .filter((s) => s.flaggedToday && !s.completed)
      .map((s) => ({ kind: "subtask" as const, id: s.id, subtask: s, objective: objById.get(s.parentId) ?? null }));

    const flaggedTask: TodayItem[] = projects.flatMap((p) =>
      (p.tasks ?? [])
        .filter((t) => t.flaggedToday && t.status !== "completed")
        .map((t) => ({ kind: "task" as const, id: t.id, task: t, project: p })),
    );

    const flagged = [...flaggedSub, ...flaggedTask].sort((a, b) => {
      const ta = tierOf(a) === "must" ? 0 : 1;
      const tb = tierOf(b) === "must" ? 0 : 1;
      if (ta !== tb) return ta - tb;
      return priorityRank(a) - priorityRank(b);
    });

    const doneSub: TodayItem[] = allSubtasks
      .filter((s) => s.flaggedToday && s.completed)
      .map((s) => ({ kind: "subtask" as const, id: s.id, subtask: s, objective: objById.get(s.parentId) ?? null }));
    const doneTask: TodayItem[] = projects.flatMap((p) =>
      (p.tasks ?? [])
        .filter((t) => t.flaggedToday && t.status === "completed")
        .map((t) => ({ kind: "task" as const, id: t.id, task: t, project: p })),
    );
    const done = [...doneSub, ...doneTask];

    // Unflagged subtasks that belong to today, tagged with the reason so the UI
    // can explain why each is surfaced. recurring wins over scheduled over urgent.
    const suggestions: TodaySuggestion[] = allSubtasks
      .filter((s) => !s.flaggedToday && !s.completed)
      .flatMap((s) => {
        const reason: SuggestionReason | null =
          recurrenceMatchesDate(s.recurrence, s.recurrenceDay, now) ? "recurring"
          : s.scheduledFor === today ? "scheduled"
          : urgentSubtaskFilter(s, today) ? "urgent"
          : null;
        if (!reason) return [];
        return [{ kind: "subtask" as const, id: s.id, subtask: s, objective: objById.get(s.parentId) ?? null, reason }];
      });

    const must = flagged.filter((i) => tierOf(i) === "must").length;

    return {
      flagged,
      done,
      suggestions,
      counts: {
        pending: flagged.length,
        must,
        nice: flagged.length - must,
        done: done.length,
        cap: DAILY_SPRINT_CAP,
        capReached: flagged.length >= DAILY_SPRINT_CAP,
      },
    };
  }, [allSubtasks, objectives, projects]);
}
