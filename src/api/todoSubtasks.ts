import { apiFetch } from './client';
import type { TodoPriority, TodoStatus } from './objectives';

export type EffortSize = 'rapide' | 'moyen' | 'complexe';
export type Recurrence = 'daily' | 'weekdays' | 'weekly' | 'monthly';

export interface SubtaskItem {
  id:              string;
  source:          string;
  parentId:        string;
  parentSubtaskId?: string | null;
  text:            string;
  completed:       boolean;
  dueDate?:        string;   // YYYY-MM-DD
  order:           number;
  description?:    string | null;
  smartSpecific?:  string | null;
  smartMeasurable?: string | null;
  smartAchievable?: string | null;
  smartRelevant?:  string | null;
  priority:        TodoPriority;
  status:          TodoStatus;
  flaggedToday:    boolean;
  flaggedAt?:      string | null;
  effortSize?:     EffortSize | null;
  estimatedMinutes?: number | null;
  recurrence?:     Recurrence | null;
  recurrenceDay?:  number | null;   // 1-7 (weekly, ISO Mon=1) or 1-31 (monthly)
  scheduledFor?:   string | null;   // YYYY-MM-DD — auto-reflags when reached
  completedAt?:    string | null;
  createdAt:       string;
}

/** List subtasks for a given parent objective. */
export function listSubtasks(parentId?: string, source: 'admin' | 'personal' = 'admin') {
  const params = parentId
    ? `?source=${source}&parent_id=${parentId}`
    : `?source=${source}`;
  return apiFetch<SubtaskItem[]>(`todo_subtasks.php${params}`);
}

export function createSubtask(data: {
  parentId: string;
  parentSubtaskId?: string | null;
  text: string;
  dueDate?: string;
  description?: string;
  priority?: TodoPriority;
  status?: TodoStatus;
  effortSize?: EffortSize;
  estimatedMinutes?: number | null;
  source: 'admin' | 'personal';
}) {
  return apiFetch<SubtaskItem>('todo_subtasks.php', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateSubtask(
  id: string,
  data: Partial<Pick<SubtaskItem, 'completed' | 'text' | 'dueDate' | 'order' | 'description' | 'smartSpecific' | 'smartMeasurable' | 'smartAchievable' | 'smartRelevant' | 'priority' | 'status' | 'flaggedToday' | 'effortSize' | 'parentSubtaskId' | 'estimatedMinutes' | 'recurrence' | 'recurrenceDay' | 'scheduledFor'>>,
) {
  return apiFetch<SubtaskItem>(`todo_subtasks.php?id=${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function deleteSubtask(id: string) {
  return apiFetch<void>(`todo_subtasks.php?id=${id}`, { method: 'DELETE' });
}

/** Batch-complete all subtasks for a parent */
export function batchCompleteSubtasks(parentId: string, subtasks: SubtaskItem[]) {
  return Promise.all(
    subtasks.filter(s => !s.completed).map(s => updateSubtask(s.id, { completed: true }))
  );
}
