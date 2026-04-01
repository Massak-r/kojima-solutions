import { apiFetch } from './client';
import type { ProjectPhase } from '@/types/phase';
import type { StepComment, FeedbackRequest } from '@/types/timeline';

export interface StakeholderStep {
  id: string;
  title: string;
  description: string;
  order: number;
  status: "locked" | "open" | "completed";
  phaseId?: string;
  deadline?: string;
  completedAt?: string;
  completedBy?: string;
  requests: FeedbackRequest[];
  comments: StepComment[];
}

export interface StakeholderProject {
  projectId: string;
  projectTitle: string;
  phases: ProjectPhase[];
  steps: StakeholderStep[];
}

export function getProjectByShareToken(token: string, name?: string) {
  const q = name ? `&name=${encodeURIComponent(name)}` : '';
  return apiFetch<StakeholderProject>(`stakeholder.php?token=${token}${q}`);
}

export function shareProject(projectId: string) {
  const token = Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return apiFetch<unknown>(`projects.php?id=${projectId}`, {
    method: 'PUT',
    body: JSON.stringify({ shareToken: token }),
  }).then(() => token);
}

export function unshareProject(projectId: string) {
  return apiFetch<unknown>(`projects.php?id=${projectId}`, {
    method: 'PUT',
    body: JSON.stringify({ shareToken: null }),
  });
}
