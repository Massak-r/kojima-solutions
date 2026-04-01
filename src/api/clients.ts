import { apiFetch } from './client';
import type { Client } from '@/types/client';

export function listClients() {
  return apiFetch<Client[]>('clients.php');
}

export function getClient(id: string) {
  return apiFetch<Client>(`clients.php?id=${id}`);
}

export function createClient(data: Omit<Client, 'id' | 'createdAt'>) {
  return apiFetch<Client>('clients.php', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateClient(id: string, data: Partial<Omit<Client, 'id' | 'createdAt'>>) {
  return apiFetch<Client>(`clients.php?id=${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function deleteClient(id: string) {
  return apiFetch<void>(`clients.php?id=${id}`, { method: 'DELETE' });
}
