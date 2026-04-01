import { apiFetch } from './client';
import type { SalsaType, SalsaStatus } from '@/types/salsaMove';

export interface SalsaMoveItem {
  id:          string;
  type:        SalsaType;
  title:       string;
  description?: string;
  videoUrl?:   string;
  linkUrl?:    string;
  topics:      string[];
  status:      SalsaStatus;
  difficulty:  number;   // 0 = unrated, 1–5
  sortOrder:   number;
  notes?:      string;
  createdBy?:  string;   // email of user who created the move
  createdAt:   string;
}

export function listMoves(type?: SalsaType) {
  const qs = type ? `?type=${type}` : '';
  return apiFetch<SalsaMoveItem[]>(`salsa_moves.php${qs}`);
}

export function createMove(data: Omit<SalsaMoveItem, 'id' | 'createdAt'>) {
  return apiFetch<SalsaMoveItem>('salsa_moves.php', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateMove(id: string, data: Partial<Omit<SalsaMoveItem, 'id' | 'createdAt'>>) {
  return apiFetch<SalsaMoveItem>(`salsa_moves.php?id=${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function deleteMove(id: string) {
  return apiFetch<void>(`salsa_moves.php?id=${id}`, { method: 'DELETE' });
}
