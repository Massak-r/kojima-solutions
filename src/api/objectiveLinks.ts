import { apiFetch } from './client';
import type { ObjectiveSource } from './objectiveSource';

export interface ObjectiveLink {
  id:          string;
  source:      ObjectiveSource;
  objectiveId: string;
  url:         string;
  title:       string;
  description?: string | null;
  faviconUrl?: string | null;
  order:       number;
  createdAt:   string;
}

export function listLinks(source: ObjectiveSource, objectiveId: string) {
  return apiFetch<ObjectiveLink[]>(`objective_links.php?source=${source}&objective_id=${objectiveId}`);
}

export function createLink(data: {
  source: ObjectiveSource;
  objectiveId: string;
  url: string;
  title?: string;
  description?: string;
  faviconUrl?: string;
}) {
  return apiFetch<ObjectiveLink>('objective_links.php', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateLink(
  id: string,
  data: Partial<Pick<ObjectiveLink, 'url' | 'title' | 'description' | 'faviconUrl' | 'order'>>,
) {
  return apiFetch<ObjectiveLink>(`objective_links.php?id=${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function deleteLink(id: string) {
  return apiFetch<void>(`objective_links.php?id=${id}`, { method: 'DELETE' });
}
