import { useCallback } from "react";
import { useAllSubtasks, useUpdateSubtask } from "@/hooks/useSubtasks";
import { useSprintCapContext } from "@/components/sprint/SprintCapProvider";
import { countSprintPending, isSprintFull } from "@/lib/sprintLimits";
import type { SubtaskItem } from "@/api/todoSubtasks";

/**
 * Central hook for flagging a subtask into today's sprint.
 * When the sprint is already at cap, opens the overload dialog instead of flagging directly.
 * Deflagging (flaggedToday: false) always bypasses this hook — use useUpdateSubtask directly.
 *
 * extraPatch: additional fields to set alongside flaggedToday (e.g. scheduledFor: null in WeekPlanner).
 * Applied immediately on direct flag; NOT applied when the dialog swap path runs.
 */
export function useFlagSubtask() {
  const { data: allSubtasks = [] } = useAllSubtasks();
  const updateSubtask = useUpdateSubtask();
  const { requestFlag } = useSprintCapContext();

  const flag = useCallback((subtask: SubtaskItem, extraPatch?: Partial<SubtaskItem>) => {
    if (subtask.flaggedToday) return; // already flagged, nothing to do

    const pending = countSprintPending(allSubtasks);
    if (isSprintFull(pending)) {
      const currentSprint = allSubtasks.filter(s => s.flaggedToday && !s.completed);
      // Apply extraPatch (e.g. clear scheduledFor) immediately so the item leaves its column,
      // regardless of what the user picks in the dialog.
      if (extraPatch && Object.keys(extraPatch).length > 0) {
        updateSubtask.mutate({ id: subtask.id, patch: extraPatch });
      }
      requestFlag(subtask, currentSprint);
    } else {
      updateSubtask.mutate({ id: subtask.id, patch: { flaggedToday: true, ...extraPatch } });
    }
  }, [allSubtasks, updateSubtask, requestFlag]);

  return { flag };
}
