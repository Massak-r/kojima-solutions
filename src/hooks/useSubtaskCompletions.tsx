import { useQuery } from "@tanstack/react-query";
import { listSubtaskCompletions, type CompletionsBySubtask } from "@/api/subtaskCompletions";
import type { ObjectiveSource } from "@/api/objectiveSource";

export const SUBTASK_COMPLETIONS_KEY = ["subtask-completions"] as const;

/** Earliest date we ever care about across all 4 recurrence types.
 *  Daily 7d / weekdays 7d / weekly 5×7=35d / monthly 6×31=186d → 200d covers all. */
const WINDOW_DAYS = 200;

function defaultSince(): string {
  const d = new Date();
  d.setDate(d.getDate() - WINDOW_DAYS);
  return d.toISOString().slice(0, 10);
}

/**
 * Returns a map { subtaskId → ["YYYY-MM-DD", ...] } of completion dates for
 * the given source. Mutations on subtasks invalidate this key.
 */
export function useSubtaskCompletions(source: ObjectiveSource) {
  return useQuery<CompletionsBySubtask>({
    queryKey: [...SUBTASK_COMPLETIONS_KEY, source],
    queryFn: () => listSubtaskCompletions(source, defaultSince()),
    staleTime: 5 * 60_000,
  });
}
