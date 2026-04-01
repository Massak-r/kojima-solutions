import { apiFetch } from './client';

export interface TodoItem {
  id: string;
  text: string;
  completed: boolean;
  order: number;
  createdAt: string;
}

export function listTodos() {
  return apiFetch<TodoItem[]>('todos.php');
}

export function createTodo(text: string) {
  return apiFetch<TodoItem>('todos.php', {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
}

export function updateTodo(id: string, data: Partial<Pick<TodoItem, 'completed' | 'text' | 'order'>>) {
  return apiFetch<TodoItem>(`todos.php?id=${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function deleteTodo(id: string) {
  return apiFetch<void>(`todos.php?id=${id}`, { method: 'DELETE' });
}
