import { apiFetch } from './client';
import type { ProjectPhase } from '@/types/phase';

export function listProjectPhases(projectId: string) {
  return apiFetch<ProjectPhase[]>(`phases.php?project_id=${projectId}`);
}

export function createPhase(data: {
  projectId: string;
  title: string;
  description?: string;
  budget?: number;
}) {
  return apiFetch<ProjectPhase>('phases.php', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updatePhase(id: string, data: Partial<Omit<ProjectPhase, 'id' | 'projectId'>>) {
  return apiFetch<ProjectPhase>(`phases.php?id=${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function deletePhase(id: string) {
  return apiFetch<void>(`phases.php?id=${id}`, { method: 'DELETE' });
}
