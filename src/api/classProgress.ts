import { apiFetch } from './client';

export interface ClassProgressItem {
  id:         string;
  classKey:   string;
  moveId:     string;
  status:     'done' | 'next' | 'planned';
  doneOrder?: number | null;
  doneAt?:    string | null;
  createdAt:  string;
}

export function listProgress(classKey: string) {
  return apiFetch<ClassProgressItem[]>(`class_progress.php?class_key=${classKey}`);
}

export function upsertProgress(data: Omit<ClassProgressItem, 'id' | 'createdAt'>) {
  return apiFetch<ClassProgressItem>('class_progress.php', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateProgress(id: string, data: Partial<Pick<ClassProgressItem, 'status' | 'doneOrder' | 'doneAt'>>) {
  return apiFetch<ClassProgressItem>(`class_progress.php?id=${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function deleteProgress(id: string) {
  return apiFetch<void>(`class_progress.php?id=${id}`, { method: 'DELETE' });
}

export function deleteProgressByMove(classKey: string, moveId: string) {
  return apiFetch<void>(`class_progress.php?class_key=${classKey}&move_id=${moveId}`, { method: 'DELETE' });
}
