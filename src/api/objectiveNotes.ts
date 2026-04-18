import { apiFetch } from './client';
import type { ObjectiveSource } from './objectiveSource';

export interface ObjectiveNote {
  id:          string;
  source:      ObjectiveSource;
  objectiveId: string;
  title:       string;
  content:     string;
  pinned:      boolean;
  createdAt:   string;
  updatedAt:   string;
}

export function listNotes(source: ObjectiveSource, objectiveId: string) {
  return apiFetch<ObjectiveNote[]>(`objective_notes.php?source=${source}&objective_id=${objectiveId}`);
}

export function createNote(data: {
  source: ObjectiveSource;
  objectiveId: string;
  title?: string;
  content?: string;
  pinned?: boolean;
}) {
  return apiFetch<ObjectiveNote>('objective_notes.php', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateNote(
  id: string,
  data: Partial<Pick<ObjectiveNote, 'title' | 'content' | 'pinned'>>,
) {
  return apiFetch<ObjectiveNote>(`objective_notes.php?id=${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function deleteNote(id: string) {
  return apiFetch<void>(`objective_notes.php?id=${id}`, { method: 'DELETE' });
}
