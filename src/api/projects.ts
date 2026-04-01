import { apiFetch } from './client';
import type { StoredProject, TaskFeedback } from '@/contexts/ProjectsContext';
import type { FeedbackRequest, SubTask } from '@/types/timeline';

// ── Projects ──────────────────────────────────────────────────

export function listProjects() {
  return apiFetch<StoredProject[]>('projects.php');
}

export function getProject(id: string) {
  return apiFetch<StoredProject>(`projects.php?id=${id}`);
}

export function createProject(data: Partial<StoredProject>) {
  return apiFetch<StoredProject>('projects.php', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateProject(id: string, data: Partial<StoredProject>) {
  return apiFetch<StoredProject>(`projects.php?id=${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function deleteProject(id: string) {
  return apiFetch<void>(`projects.php?id=${id}`, { method: 'DELETE' });
}

// ── Reviews (admin) ───────────────────────────────────────────

export function createReview(data: Omit<TaskFeedback, 'id' | 'createdAt'> & { projectId: string }) {
  return apiFetch<TaskFeedback>('reviews.php', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateReview(
  id: string,
  data: Pick<TaskFeedback, 'comment' | 'status'>
) {
  return apiFetch<TaskFeedback>(`reviews.php?id=${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function deleteReview(id: string) {
  return apiFetch<void>(`reviews.php?id=${id}`, { method: 'DELETE' });
}

// ── Feedback Requests ─────────────────────────────────────────

export function createFeedbackRequest(data: Omit<FeedbackRequest, 'id' | 'createdAt' | 'resolved'> & { taskId: string }) {
  return apiFetch<FeedbackRequest>('feedback.php', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function resolveFeedbackRequest(id: string, response: string, respondedBy?: string) {
  const isApproval = response === "approved";
  return apiFetch<FeedbackRequest>(`feedback.php?id=${id}`, {
    method: 'PUT',
    body: JSON.stringify({
      resolved: isApproval ? true : false,
      response,
      ...(respondedBy ? { respondedBy } : {}),
    }),
  });
}

export function updateFeedbackRequest(id: string, data: Record<string, unknown>) {
  return apiFetch<FeedbackRequest>(`feedback.php?id=${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function deleteFeedbackRequest(id: string) {
  return apiFetch<void>(`feedback.php?id=${id}`, { method: 'DELETE' });
}

// ── File Upload ───────────────────────────────────────────────

export async function uploadImage(file: File): Promise<string> {
  const fd = new FormData();
  fd.append('file', file);
  const result = await apiFetch<{ url: string }>('upload.php', {
    method: 'POST',
    body: fd,
  });
  return result.url;
}
