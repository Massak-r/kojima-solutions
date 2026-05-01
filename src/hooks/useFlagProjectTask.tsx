import { useCallback } from "react";
import { useProjects } from "@/contexts/ProjectsContext";
import { useAllSubtasks } from "@/hooks/useSubtasks";
import { useSprintCapContext, type SprintItem } from "@/components/sprint/SprintCapProvider";
import { isSprintFull } from "@/lib/sprintLimits";
import type { TimelineTask } from "@/types/timeline";

/**
 * Mirror of useFlagSubtask but for project TimelineTasks.
 * Workflow: only `status === "open"` tasks can be flagged.
 *
 * The cap is shared cross-system — uses the same SprintCapProvider as subtasks.
 */
export function useFlagProjectTask() {
  const { projects, updateProjectTask } = useProjects();
  const { data: allSubtasks = [] } = useAllSubtasks();
  const { requestFlag } = useSprintCapContext();

  const flag = useCallback((projectId: string, task: TimelineTask) => {
    if (task.flaggedToday) return;
    if (task.status && task.status !== "open") return;

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
      requestFlag(
        { kind: "task", projectId, task },
        [...subtaskItems, ...taskItems],
      );
    } else {
      // Reset tier to "nice" on every flag — fresh start, user can promote to must later.
      updateProjectTask(projectId, task.id, { flaggedToday: true, sprintTier: "nice" });
    }
  }, [projects, allSubtasks, updateProjectTask, requestFlag]);

  const unflag = useCallback((projectId: string, taskId: string) => {
    updateProjectTask(projectId, taskId, { flaggedToday: false });
  }, [updateProjectTask]);

  return { flag, unflag };
}
