import { apiFetch } from './client';

export interface ExpenseItem {
  id:          string;
  date:        string;
  amount:      number;
  description: string;
  category:    string;
  notes?:      string | null;
  createdAt:   string;
}

export function listExpenses(year?: number) {
  const qs = year ? `?year=${year}` : '';
  return apiFetch<ExpenseItem[]>(`expenses.php${qs}`);
}

export function createExpense(data: Omit<ExpenseItem, 'id' | 'createdAt'>) {
  return apiFetch<ExpenseItem>('expenses.php', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateExpense(id: string, data: Partial<Omit<ExpenseItem, 'id' | 'createdAt'>>) {
  return apiFetch<ExpenseItem>(`expenses.php?id=${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function deleteExpense(id: string) {
  return apiFetch<void>(`expenses.php?id=${id}`, { method: 'DELETE' });
}

/** Batch import expenses (for migration from localStorage) */
export function batchImportExpenses(items: Omit<ExpenseItem, 'createdAt'>[]) {
  return apiFetch<{ imported: number }>('expenses.php?batch=1', {
    method: 'POST',
    body: JSON.stringify(items),
  });
}
