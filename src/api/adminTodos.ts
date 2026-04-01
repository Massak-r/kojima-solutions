import { apiFetch } from './client';
import type { TodoPriority, TodoStatus } from './personalTodos';

export interface AdminTodoItem {
  id:              string;
  text:            string;
  completed:       boolean;
  category:        string;
  dueDate?:        string;   // YYYY-MM-DD
  isObjective:     boolean;
  description?:    string | null;
  smartSpecific?:  string | null;
  smartMeasurable?: string | null;
  smartAchievable?: string | null;
  smartRelevant?:  string | null;
  priority:        TodoPriority;
  status:          TodoStatus;
  order:           number;
  createdAt:       string;
}

export function listAdminTodos() {
  return apiFetch<AdminTodoItem[]>('admin_todos.php');
}

export function createAdminTodo(data: {
  text: string;
  category?: string;
  dueDate?: string;
  isObjective?: boolean;
  description?: string;
  smartSpecific?: string;
  smartMeasurable?: string;
  smartAchievable?: string;
  smartRelevant?: string;
  priority?: TodoPriority;
  status?: TodoStatus;
}) {
  return apiFetch<AdminTodoItem>('admin_todos.php', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateAdminTodo(
  id: string,
  data: Partial<Pick<AdminTodoItem, 'completed' | 'text' | 'category' | 'dueDate' | 'order' | 'isObjective' | 'description' | 'smartSpecific' | 'smartMeasurable' | 'smartAchievable' | 'smartRelevant' | 'priority' | 'status'>>,
) {
  return apiFetch<AdminTodoItem>(`admin_todos.php?id=${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function deleteAdminTodo(id: string) {
  return apiFetch<void>(`admin_todos.php?id=${id}`, { method: 'DELETE' });
}
