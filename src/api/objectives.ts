import { apiFetch } from './client';

export type TodoPriority = 'low' | 'medium' | 'high';
export type TodoStatus = 'not_started' | 'in_progress' | 'done' | 'blocked';
export type TodoRecurring = 'daily' | 'weekly' | 'monthly';

export interface ObjectiveItem {
  id:              string;
  text:            string;
  completed:       boolean;
  category:        string;
  dueDate?:        string;   // YYYY-MM-DD
  recurring?:      string | null;
  isObjective:     boolean;
  description?:    string | null;
  smartSpecific?:  string | null;
  smartMeasurable?: string | null;
  smartAchievable?: string | null;
  smartRelevant?:  string | null;
  priority:        TodoPriority;
  status:          TodoStatus;
  order:           number;
  definitionOfDone?: string | null;
  linkedProjectId?:  string | null;
  linkedClientId?:   string | null;
  createdAt:       string;
}

/** List objectives, optionally filtered by categories */
export function listObjectives(categories?: readonly string[]) {
  const params = categories && categories.length > 0
    ? `?categories=${categories.join(',')}`
    : '';
  return apiFetch<ObjectiveItem[]>(`admin_todos.php${params}`);
}

export function createObjective(data: {
  text: string;
  category?: string;
  dueDate?: string;
  recurring?: string;
  isObjective?: boolean;
  description?: string;
  smartSpecific?: string;
  smartMeasurable?: string;
  smartAchievable?: string;
  smartRelevant?: string;
  priority?: TodoPriority;
  status?: TodoStatus;
}) {
  return apiFetch<ObjectiveItem>('admin_todos.php', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateObjective(
  id: string,
  data: Partial<Pick<ObjectiveItem, 'completed' | 'text' | 'category' | 'dueDate' | 'recurring' | 'order' | 'isObjective' | 'description' | 'smartSpecific' | 'smartMeasurable' | 'smartAchievable' | 'smartRelevant' | 'priority' | 'status' | 'definitionOfDone' | 'linkedProjectId' | 'linkedClientId'>>,
) {
  return apiFetch<ObjectiveItem>(`admin_todos.php?id=${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function deleteObjective(id: string) {
  return apiFetch<void>(`admin_todos.php?id=${id}`, { method: 'DELETE' });
}
