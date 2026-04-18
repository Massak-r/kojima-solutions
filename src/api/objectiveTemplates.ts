import { apiFetch } from './client';
import type { ObjectiveSource } from './objectiveSource';
import type { EffortSize } from './todoSubtasks';
import type { TodoPriority } from './objectives';

export interface ObjectiveTemplateItem {
  id:            string;
  templateId:    string;
  parentItemId?: string | null;
  text:          string;
  description?:  string | null;
  priority:      TodoPriority;
  effortSize?:   EffortSize | null;
  order:         number;
}

export interface ObjectiveTemplate {
  id:                 string;
  name:               string;
  description?:       string | null;
  sourceObjectiveId?: string | null;
  itemCount?:         number;
  items?:             ObjectiveTemplateItem[];
  createdAt:          string;
  updatedAt:          string;
}

export function listTemplates() {
  return apiFetch<ObjectiveTemplate[]>('objective_templates.php');
}

export function getTemplate(id: string) {
  return apiFetch<ObjectiveTemplate>(`objective_templates.php?id=${id}`);
}

/** Save an objective's current subtask tree as a new template. */
export function saveAsTemplate(data: {
  name: string;
  description?: string;
  sourceSource: ObjectiveSource;
  sourceObjectiveId: string;
}) {
  return apiFetch<ObjectiveTemplate>('objective_templates.php', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/** Apply template: spawns subtasks + sub-subtasks onto an objective. */
export function applyTemplate(data: {
  templateId: string;
  source: ObjectiveSource;
  objectiveId: string;
}) {
  return apiFetch<{ created: number }>('objective_templates.php?action=apply', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function renameTemplate(id: string, data: { name?: string; description?: string }) {
  return apiFetch<ObjectiveTemplate>(`objective_templates.php?id=${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function deleteTemplate(id: string) {
  return apiFetch<void>(`objective_templates.php?id=${id}`, { method: 'DELETE' });
}
