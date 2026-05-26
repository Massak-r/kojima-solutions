import { apiFetch } from './client';

/** 'to_sort' = sitting in the scan inbox awaiting filing; 'filed' = archived in a folder. */
export type AdminDocStatus = 'to_sort' | 'filed';

export interface AdminDocItem {
  id:           string;
  title:        string;
  category:     string;
  status:       AdminDocStatus;
  urgent:       boolean;
  folderId:     string | null;
  year:         number | null;
  /** Free-form labels for cross-cutting search (max ~8, ≤40 chars each). */
  tags:         string[];
  shareToken:   string | null;
  sortOrder:    number;
  filename:     string;
  originalName: string;
  fileSize:     number;
  createdAt:    string;
}

export interface DocFolderLink {
  label: string;
  url:   string;
}

export interface DocFolder {
  id:        string;
  name:       string;
  parentId:   string | null;
  sortOrder:  number;
  shareToken: string | null;
  summary:    string | null;
  links:      DocFolderLink[];
  createdAt:  string;
}

const BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

// ── Documents ──────────────────────────────────────────────

export function listDocs() {
  return apiFetch<AdminDocItem[]>('admin_docs.php');
}

export async function uploadDoc(
  file: File,
  title: string,
  category: string,
  folderId?: string | null,
  year?: number | null,
  status: AdminDocStatus = 'filed',
  urgent = false,
  tags?: string[],
): Promise<AdminDocItem> {
  const form = new FormData();
  form.append('file', file);
  form.append('title', title);
  form.append('category', category);
  if (folderId) form.append('folderId', folderId);
  if (year != null) form.append('year', String(year));
  if (tags && tags.length > 0) form.append('tags', JSON.stringify(tags));
  form.append('status', status);
  form.append('urgent', urgent ? '1' : '0');
  const csrf = (typeof document !== 'undefined' && document.cookie.match(/(?:^|; )kojima_csrf=([^;]*)/)?.[1]) || '';
  const res = await fetch(`${BASE}/api/admin_docs.php`, {
    method: 'POST',
    body: form,
    credentials: 'include',
    headers: csrf ? { 'X-CSRF-Token': decodeURIComponent(csrf) } : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Upload failed: ${text}`);
  }
  return res.json();
}

export function updateDoc(id: string, data: Partial<Pick<AdminDocItem, 'title' | 'category' | 'folderId' | 'year' | 'tags' | 'sortOrder' | 'status' | 'urgent'>>) {
  return apiFetch<AdminDocItem>(`admin_docs.php?id=${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function shareDoc(id: string) {
  return apiFetch<AdminDocItem>(`admin_docs.php?id=${id}`, {
    method: 'PUT',
    body: JSON.stringify({ action: 'share' }),
  });
}

export function unshareDoc(id: string) {
  return apiFetch<AdminDocItem>(`admin_docs.php?id=${id}`, {
    method: 'PUT',
    body: JSON.stringify({ action: 'unshare' }),
  });
}

export function deleteDoc(id: string) {
  return apiFetch<void>(`admin_docs.php?id=${id}`, { method: 'DELETE' });
}

/** Returns the URL to view/download a PDF by its stored filename. The HttpOnly
 * session cookie is auto-sent by the browser on same-origin navigations. */
export function getDocViewUrl(filename: string): string {
  return `${BASE}/api/admin_files.php?file=${encodeURIComponent(filename)}`;
}

/** Returns the public share URL for a document */
export function getShareUrl(token: string): string {
  return `${BASE}/api/admin_doc_share.php?token=${encodeURIComponent(token)}`;
}

// ── Folders ────────────────────────────────────────────────

export function listFolders() {
  return apiFetch<DocFolder[]>('admin_doc_folders.php');
}

export function createFolder(name: string, parentId?: string | null) {
  return apiFetch<DocFolder>('admin_doc_folders.php', {
    method: 'POST',
    body: JSON.stringify({ name, parentId: parentId ?? null }),
  });
}

export function updateFolder(id: string, data: Partial<Pick<DocFolder, 'name' | 'parentId' | 'sortOrder' | 'summary' | 'links'>>) {
  return apiFetch<DocFolder>(`admin_doc_folders.php?id=${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function deleteFolder(id: string) {
  return apiFetch<void>(`admin_doc_folders.php?id=${id}`, { method: 'DELETE' });
}

export function shareFolder(id: string) {
  return apiFetch<DocFolder>(`admin_doc_folders.php?id=${id}`, {
    method: 'PUT',
    body: JSON.stringify({ action: 'share' }),
  });
}

export function unshareFolder(id: string) {
  return apiFetch<DocFolder>(`admin_doc_folders.php?id=${id}`, {
    method: 'PUT',
    body: JSON.stringify({ action: 'unshare' }),
  });
}

export function getFolderShareUrl(token: string): string {
  return `${(import.meta.env.VITE_SITE_URL ?? 'https://kojima-solutions.ch')}/shared/folder/${token}`;
}

export interface SharedFolderData {
  folder: { id: string; name: string };
  subFolders: { id: string; name: string; parentId: string | null }[];
  docs: {
    id: string; title: string; category: string; folderId: string | null;
    year: number | null; filename: string; originalName: string;
    fileSize: number; createdAt: string;
  }[];
}

export function fetchSharedFolder(token: string) {
  return apiFetch<SharedFolderData>(`admin_folder_share.php?token=${token}`);
}

export function getFolderZipUrl(token: string): string {
  return `${BASE}/api/admin_folder_zip.php?token=${encodeURIComponent(token)}`;
}

// ── Auto-classify ─────────────────────────────────────────────

export interface ClassifyPdfPayload {
  id:              string;
  filename:        string;
  currentTitle:    string;
  currentCategory: string;
  extractedText:   string;
  fileSize:        number;
}

/** Pulls the extracted text + metadata for a PDF. The /classify-pdf slash
 *  command consumes this via MCP. The triage UI also consumes it client-side
 *  for heuristic auto-classification (no LLM round-trip). */
export function classifyPdf(docId: string) {
  return apiFetch<ClassifyPdfPayload>(`auto/classify_pdf.php?doc_id=${encodeURIComponent(docId)}`);
}
