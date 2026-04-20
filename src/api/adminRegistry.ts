import { apiFetch } from './client';
import type { RegistryEntry } from '@/types/adminRegistry';

export function listRegistryItems() {
  return apiFetch<RegistryEntry[]>('admin_registry.php');
}

export function createRegistryItem(data: Omit<RegistryEntry, 'id' | 'createdAt' | 'updatedAt'>) {
  return apiFetch<RegistryEntry>('admin_registry.php', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateRegistryItem(id: string, data: Partial<Omit<RegistryEntry, 'id' | 'createdAt' | 'updatedAt'>>) {
  return apiFetch<RegistryEntry>(`admin_registry.php?id=${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function deleteRegistryItem(id: string) {
  return apiFetch<void>(`admin_registry.php?id=${id}`, { method: 'DELETE' });
}
