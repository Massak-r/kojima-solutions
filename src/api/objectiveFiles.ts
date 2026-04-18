import { apiFetch } from './client';
import type { ObjectiveSource } from './objectiveSource';

export interface ObjectiveFile {
  id:           string;
  source:       ObjectiveSource;
  objectiveId:  string;
  filename:     string;
  originalName: string;
  mimeType:     string;
  fileSize:     number;
  caption?:     string | null;
  url:          string;
  createdAt:    string;
}

export function listFiles(source: ObjectiveSource, objectiveId: string) {
  return apiFetch<ObjectiveFile[]>(`objective_files.php?source=${source}&objective_id=${objectiveId}`);
}

export function uploadFile(
  source: ObjectiveSource,
  objectiveId: string,
  file: File,
  caption?: string,
) {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('source', source);
  fd.append('objectiveId', objectiveId);
  if (caption) fd.append('caption', caption);
  return apiFetch<ObjectiveFile>('objective_files.php', {
    method: 'POST',
    body: fd,
  });
}

export function updateFile(id: string, data: { caption?: string | null }) {
  return apiFetch<ObjectiveFile>(`objective_files.php?id=${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function deleteFile(id: string) {
  return apiFetch<void>(`objective_files.php?id=${id}`, { method: 'DELETE' });
}
