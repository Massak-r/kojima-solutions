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
const API_KEY = import.meta.env.VITE_API_KEY ?? '';

export function listPersonalDocs() {
  return apiFetch<PersonalDocItem[]>('personal_docs.php');
}

export async function uploadPersonalDoc(file: File, title: string, category: string): Promise<PersonalDocItem> {
  const form = new FormData();
  form.append('file', file);
  form.append('title', title);
  form.append('category', category);
  const headers: Record<string, string> = {};
  if (API_KEY) headers['X-API-Key'] = API_KEY;
  const res = await fetch(`${BASE}/api/personal_docs.php`, { method: 'POST', body: form, headers });
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

/** Returns the URL to view/download a PDF by its stored filename */
export function getPersonalDocViewUrl(filename: string): string {
  const url = `${BASE}/api/personal_files.php?file=${encodeURIComponent(filename)}`;
  return API_KEY ? `${url}&key=${encodeURIComponent(API_KEY)}` : url;
}
