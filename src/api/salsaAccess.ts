import { apiFetch } from './client';
import type { SalsaType } from '@/types/salsaMove';

export interface SalsaAccessItem {
  id:        string;
  type:      SalsaType;
  email:     string;
  createdAt: string;
}

export function listAccess(type: SalsaType) {
  return apiFetch<SalsaAccessItem[]>(`salsa_access.php?type=${type}`);
}

export function validateAccess(type: SalsaType, email: string) {
  return apiFetch<{ ok: boolean }>(`salsa_access.php?type=${type}&email=${encodeURIComponent(email)}`);
}

export function addAccess(type: SalsaType, email: string) {
  return apiFetch<SalsaAccessItem>('salsa_access.php', {
    method: 'POST',
    body: JSON.stringify({ type, email }),
  });
}

export function removeAccess(id: string) {
  return apiFetch<void>(`salsa_access.php?id=${id}`, { method: 'DELETE' });
}
