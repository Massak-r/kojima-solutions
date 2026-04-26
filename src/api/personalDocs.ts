import { apiFetch } from './client';

export interface PersonalDocItem {
  id:           string;
  title:        string;
  category:     string;
  filename:     string;
  originalName: string;
  fileSize:     number;
  createdAt:    string;
}

const BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

export function listPersonalDocs() {
  return apiFetch<PersonalDocItem[]>('personal_docs.php');
}

export async function uploadPersonalDoc(file: File, title: string, category: string): Promise<PersonalDocItem> {
  const form = new FormData();
  form.append('file', file);
  form.append('title', title);
  form.append('category', category);
  const res = await fetch(`${BASE}/api/personal_docs.php`, {
    method: 'POST',
    body: form,
    credentials: 'include',
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Upload failed: ${text}`);
  }
  return res.json();
}

export function updatePersonalDoc(id: string, data: Partial<Pick<PersonalDocItem, 'title' | 'category'>>) {
  return apiFetch<PersonalDocItem>(`personal_docs.php?id=${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function deletePersonalDoc(id: string) {
  return apiFetch<void>(`personal_docs.php?id=${id}`, { method: 'DELETE' });
}

/** Returns the URL to view/download a PDF by its stored filename. The HttpOnly
 * session cookie is auto-sent by the browser on same-origin navigations. */
export function getPersonalDocViewUrl(filename: string): string {
  return `${BASE}/api/personal_files.php?file=${encodeURIComponent(filename)}`;
}
