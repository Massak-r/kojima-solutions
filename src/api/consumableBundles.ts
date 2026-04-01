import { apiFetch } from './client';

export interface ConsumableBundle {
  id:        string;
  name:      string;
  color:     string | null;
  createdAt: string;
}

export const listBundles = () =>
  apiFetch<ConsumableBundle[]>('consumable_bundles.php');

export const createBundle = (data: { name: string; color?: string | null }) =>
  apiFetch<ConsumableBundle>('consumable_bundles.php', { method: 'POST', body: JSON.stringify(data) });

export const updateBundle = (id: string, data: Partial<Pick<ConsumableBundle, 'name' | 'color'>>) =>
  apiFetch<ConsumableBundle>(`consumable_bundles.php?id=${id}`, { method: 'PUT', body: JSON.stringify(data) });

export const deleteBundle = (id: string) =>
  apiFetch<void>(`consumable_bundles.php?id=${id}`, { method: 'DELETE' });
