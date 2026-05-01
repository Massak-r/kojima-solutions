import { useCallback } from "react";
import { useAllSubtasks, useUpdateSubtask } from "@/hooks/useSubtasks";
import { useProjects } from "@/contexts/ProjectsContext";
import { useSprintCapContext, type SprintItem } from "@/components/sprint/SprintCapProvider";
import { isSprintFull } from "@/lib/sprintLimits";
import type { SubtaskItem } from "@/api/todoSubtasks";

/**
 * Central hook for flagging an objective subtask into today's sprint.
 * When the cap (across subtasks + project tasks) is reached, opens the
 * shared overload dialog so the user can swap or force.
 *
 * Deflagging is direct (no cap check needed).
 */
export function useFlagSubtask() {
  const { data: allSubtasks = [] } = useAllSubtasks();
  const { projects } = useProjects();
  const updateSubtask = useUpdateSubtask();
  const { requestFlag } = useSprintCapContext();

  const flag = useCallback((subtask: SubtaskItem, extraPatch?: Partial<SubtaskItem>) => {
    if (subtask.flaggedToday) return;

    const subtaskItems: SprintItem[] = allSubtasks
      .filter(s => s.flaggedToday && !s.completed)
      .map(s => ({ kind: "subtask", subtask: s }));

    const taskItems: SprintItem[] = projects.flatMap(p =>
      (p.tasks ?? [])
        .filter(t => t.flaggedToday && t.status !== "completed")
        .map(t => ({ kind: "task" as const, projectId: p.id, task: t })),
    );

    const totalPending = subtaskItems.length + taskItems.length;

    if (isSprintFull(totalPending)) {
      // Apply extraPatch (e.g. clear scheduledFor on drag-to-today) immediately —
      // the visual "leaves the column" regardless of swap outcome.
      if (extraPatch && Object.keys(extraPatch).length > 0) {
        updateSubtask.mutate({ id: subtask.id, patch: extraPatch });
      }
      requestFlag({ kind: "subtask", subtask }, [...subtaskItems, ...taskItems]);
    } else {
      updateSubtask.mutate({ id: subtask.id, patch: { flaggedToday: true, ...extraPatch } });
    }
  }, [allSubtasks, projects, updateSubtask, requestFlag]);

  return { flag };
}
