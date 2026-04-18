import { apiFetch } from './client';
import type { ObjectiveSource } from './objectiveSource';

export type ObjectiveActivityKind =
  | 'subtask_completed'
  | 'subtask_uncompleted'
  | 'focus_set'
  | 'focus_cleared'
  | 'status_changed'
  | 'session_started'
  | 'session_ended'
  | 'note_saved'
  | 'file_uploaded'
  | 'link_added'
  | 'decision_added'
  | string;

export interface ObjectiveActivity {
  id:          string;
  source:      ObjectiveSource;
  objectiveId: string;
  kind:        ObjectiveActivityKind;
  payload?:    Record<string, unknown> | null;
  createdAt:   string;
}

export function listActivity(source: ObjectiveSource, objectiveId: string, limit = 50) {
  return apiFetch<ObjectiveActivity[]>(`objective_activity.php?source=${source}&objective_id=${objectiveId}&limit=${limit}`);
}

export function logActivity(data: {
  source: ObjectiveSource;
  objectiveId: string;
  kind: ObjectiveActivityKind;
  payload?: Record<string, unknown>;
}) {
  return apiFetch<ObjectiveActivity>('objective_activity.php', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
