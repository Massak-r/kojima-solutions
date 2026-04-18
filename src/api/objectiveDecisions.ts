import { apiFetch } from './client';
import type { ObjectiveSource } from './objectiveSource';

export interface ObjectiveDecision {
  id:          string;
  source:      ObjectiveSource;
  objectiveId: string;
  title:       string;
  rationale?:  string | null;
  decidedAt:   string;
}

export function listDecisions(source: ObjectiveSource, objectiveId: string) {
  return apiFetch<ObjectiveDecision[]>(`objective_decisions.php?source=${source}&objective_id=${objectiveId}`);
}

export function createDecision(data: {
  source: ObjectiveSource;
  objectiveId: string;
  title: string;
  rationale?: string;
  decidedAt?: string;
}) {
  return apiFetch<ObjectiveDecision>('objective_decisions.php', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateDecision(
  id: string,
  data: Partial<Pick<ObjectiveDecision, 'title' | 'rationale' | 'decidedAt'>>,
) {
  return apiFetch<ObjectiveDecision>(`objective_decisions.php?id=${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function deleteDecision(id: string) {
  return apiFetch<void>(`objective_decisions.php?id=${id}`, { method: 'DELETE' });
}
