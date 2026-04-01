import { apiFetch } from './client';
import type { ConsumableUnit } from '@/types/consumable';

export interface ConsumableItem {
  id:             string;
  name:           string;
  estimatedCost:  number;
  everyN:         number;
  unit:           ConsumableUnit;
  lastPurchased?: string;
  bundleIds:      string[];
  createdAt:      string;
}

/** Normalize API response: handles both legacy bundleId (string) and new bundleIds (array) */
function normalize(raw: any): ConsumableItem {
  const bundleIds = Array.isArray(raw.bundleIds)
    ? raw.bundleIds
    : raw.bundleId ? [raw.bundleId] : [];
  return { ...raw, bundleIds };
}

export const listConsumables = () =>
  apiFetch<any[]>('consumables.php').then(items => items.map(normalize));

export const createConsumable = (data: Omit<ConsumableItem, 'id' | 'createdAt'>) =>
  apiFetch<any>('consumables.php', { method: 'POST', body: JSON.stringify(data) }).then(normalize);

export const updateConsumable = (id: string, data: Partial<Omit<ConsumableItem, 'id' | 'createdAt'>>) =>
  apiFetch<any>(`consumables.php?id=${id}`, { method: 'PUT', body: JSON.stringify(data) }).then(normalize);

export const deleteConsumable = (id: string) =>
  apiFetch<void>(`consumables.php?id=${id}`, { method: 'DELETE' });
