import { apiFetch } from './client';
import type { Quote } from '@/types/quote';

export function listQuotes() {
  return apiFetch<Quote[]>('quotes.php');
}

export function listProjectQuotes(projectId: string) {
  // NB: the PHP reads `project_id` (snake_case) — sending `projectId` here used
  // to silently fall through to the unscoped all-quotes list.
  return apiFetch<Quote[]>(`quotes.php?project_id=${projectId}`);
}

export function getQuote(id: string) {
  return apiFetch<Quote>(`quotes.php?id=${id}`);
}

export function createQuote(data: Omit<Quote, 'createdAt'>) {
  return apiFetch<Quote>('quotes.php', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateQuote(id: string, data: Partial<Quote>) {
  return apiFetch<Quote>(`quotes.php?id=${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function deleteQuote(id: string) {
  return apiFetch<void>(`quotes.php?id=${id}`, { method: 'DELETE' });
}
