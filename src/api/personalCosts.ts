import { apiFetch } from './client';
import type { CostFrequency } from '@/types/personalCost';

export interface PersonalCostItem {
  id:        string;
  name:      string;
  amount:    number;
  frequency: CostFrequency;
  category?: string;
  lastPaid?: string; // YYYY-MM-DD
  createdAt: string;
}

export function listCosts() {
  return apiFetch<PersonalCostItem[]>('personal_costs.php');
}

export function createCost(data: Omit<PersonalCostItem, 'id' | 'createdAt'>) {
  return apiFetch<PersonalCostItem>('personal_costs.php', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateCost(id: string, data: Partial<Omit<PersonalCostItem, 'id' | 'createdAt'>>) {
  return apiFetch<PersonalCostItem>(`personal_costs.php?id=${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function deleteCost(id: string) {
  return apiFetch<void>(`personal_costs.php?id=${id}`, { method: 'DELETE' });
}
