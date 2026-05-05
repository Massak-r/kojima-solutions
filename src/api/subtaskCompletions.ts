import { apiFetch } from './client';
import type { ObjectiveSource } from './objectiveSource';

export type CompletionsBySubtask = Record<string, string[]>;

/** Fetch completion dates per subtask for a given source, since YYYY-MM-DD. */
export function listSubtaskCompletions(
  source: ObjectiveSource,
  since: string,
): Promise<CompletionsBySubtask> {
  return apiFetch<CompletionsBySubtask>(
    `subtask_completions.php?source=${source}&since=${since}`,
  );
}
