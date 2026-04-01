import { apiFetch } from './client';
import type { StepComment, StakeholderVote } from '@/types/timeline';

export function listStepComments(taskId: string) {
  return apiFetch<StepComment[]>(`steps.php?id=${taskId}`);
}

export function addStepComment(taskId: string, data: {
  message: string;
  authorName?: string;
  authorEmail?: string;
  authorRole?: "client" | "admin" | "stakeholder";
}) {
  return apiFetch<StepComment>(`steps.php?id=${taskId}&action=comment`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function castStakeholderVote(taskId: string, requestId: string, data: {
  name: string;
  optionId?: string;
  vote?: "approve" | "revise";
  comment?: string;
}) {
  return apiFetch<StakeholderVote>(`steps.php?id=${taskId}&action=stakeholder_vote`, {
    method: 'POST',
    body: JSON.stringify({ ...data, requestId }),
  });
}
