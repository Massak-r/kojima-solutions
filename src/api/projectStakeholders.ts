import { apiFetch } from './client';
import type { ProjectStakeholder } from '@/types/project';

export function listProjectStakeholders(projectId: string) {
  return apiFetch<ProjectStakeholder[]>(`project_stakeholders.php?project_id=${projectId}`);
}

export function addProjectStakeholder(data: { projectId: string; name: string; email: string; role?: string }) {
  return apiFetch<ProjectStakeholder>('project_stakeholders.php', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateProjectStakeholder(id: string, data: Partial<{ name: string; email: string; role: string | null }>) {
  return apiFetch<ProjectStakeholder>(`project_stakeholders.php?id=${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function deleteProjectStakeholder(id: string) {
  return apiFetch<{ ok: boolean }>(`project_stakeholders.php?id=${id}`, {
    method: 'DELETE',
  });
}

export function inviteStakeholder(stakeholderId: string, projectId: string) {
  return apiFetch<{ sent: boolean }>('stakeholder_invite.php', {
    method: 'POST',
    body: JSON.stringify({ stakeholderId, projectId }),
  });
}
