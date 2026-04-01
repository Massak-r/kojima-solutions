import { apiFetch } from './client';

export type TodoRecurring = 'daily' | 'weekly' | 'monthly';
export type TodoPriority = 'low' | 'medium' | 'high';
export type TodoStatus = 'not_started' | 'in_progress' | 'done' | 'blocked';

export interface PersonalTodoItem {
  id:              string;
  text:            string;
  completed:       boolean;
  order:           number;
  dueDate?:        string;            // YYYY-MM-DD
  recurring?:      TodoRecurring;
  isObjective:     boolean;
  description?:    string | null;
  smartSpecific?:  string | null;
  smartMeasurable?: string | null;
  smartAchievable?: string | null;
  smartRelevant?:  string | null;
  priority:        TodoPriority;
  status:          TodoStatus;
  createdAt:       string;
}

export function listPersonalTodos() {
  return apiFetch<PersonalTodoItem[]>('personal_todos.php');
}

export function createPersonalTodo(data: {
  text: string;
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
  return apiFetch<PersonalTodoItem>('personal_todos.php', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updatePersonalTodo(
  id: string,
  data: Partial<Pick<PersonalTodoItem, 'completed' | 'text' | 'order' | 'dueDate' | 'recurring' | 'isObjective' | 'description' | 'smartSpecific' | 'smartMeasurable' | 'smartAchievable' | 'smartRelevant' | 'priority' | 'status'>>,
) {
  return apiFetch<PersonalTodoItem>(`personal_todos.php?id=${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function deletePersonalTodo(id: string) {
  return apiFetch<void>(`personal_todos.php?id=${id}`, { method: 'DELETE' });
}
