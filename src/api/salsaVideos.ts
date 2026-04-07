import { apiFetch } from './client';

export interface SalsaVideo {
  id: string;
  moveId: string;
  filename: string;
  originalName: string;
  fileSize: number;
  mimeType: string;
  trimStart: number | null;
  trimEnd: number | null;
  createdAt: string;
}

const BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

export function listVideos(moveId: string): Promise<SalsaVideo[]> {
  return apiFetch<SalsaVideo[]>(`salsa_videos.php?move_id=${encodeURIComponent(moveId)}`);
}

function buildForm(
  file: File,
  moveId: string,
  trimStart?: number | null,
  trimEnd?: number | null,
): FormData {
  const form = new FormData();
  form.append('file', file);
  form.append('move_id', moveId);
  if (trimStart != null) form.append('trim_start', String(trimStart));
  if (trimEnd != null) form.append('trim_end', String(trimEnd));
  // Send API key in form body instead of header — avoids CORS preflight
  const apiKey = import.meta.env.VITE_API_KEY ?? '';
  if (apiKey) form.append('api_key', apiKey);
  return form;
}

export async function uploadVideo(
  moveId: string,
  file: File,
  trimStart?: number | null,
  trimEnd?: number | null,
  onProgress?: (percent: number) => void,
): Promise<SalsaVideo> {
  const url = `${BASE}/api/salsa_videos.php`;

  // Pre-check: verify the file is still readable (Android can revoke content URIs)
  let fileReadable = false;
  try {
    await file.slice(0, 1).arrayBuffer();
    fileReadable = true;
  } catch {}

  // Pre-check: verify server is reachable with a tiny GET
  let serverReachable = false;
  try {
    const ping = await fetch(`${url}?ping=1`, { method: 'GET' });
    serverReachable = ping.ok || ping.status === 400;
  } catch {}

  // Try XHR first (supports upload progress), fall back to fetch on failure
  let xhrErr: Error | null = null;
  try {
    return await xhrUpload(url, buildForm(file, moveId, trimStart, trimEnd), file, onProgress);
  } catch (e: any) {
    xhrErr = e;
    console.warn('[v11] XHR failed:', e);
  }

  try {
    return await fetchUpload(url, buildForm(file, moveId, trimStart, trimEnd));
  } catch (fetchErr: any) {
    console.error('[v11] Fetch also failed:', fetchErr);
    const sizeMB = Math.round(file.size / 1024 / 1024);
    const diag = [
      `[v11]`,
      `file:${fileReadable ? 'ok' : 'UNREADABLE'}`,
      `server:${serverReachable ? 'ok' : 'UNREACHABLE'}`,
      `xhr:${xhrErr?.name}:${xhrErr?.message}`,
      `fetch:${fetchErr?.name}:${fetchErr?.message}`,
      `${sizeMB}Mo ${file.type}`,
      `url:${url}`,
    ].join(' | ');
    throw new Error(diag);
  }
}

function xhrUpload(
  url: string,
  form: FormData,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<SalsaVideo> {
  function attempt(retries: number): Promise<SalsaVideo> {
    return new Promise<SalsaVideo>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url);
      // No custom headers — API key is in form body, avoids CORS preflight

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText));
          } catch {
            reject(new Error('Réponse invalide du serveur'));
          }
        } else {
          let msg = `Erreur ${xhr.status}`;
          try { msg = JSON.parse(xhr.responseText).error || msg; } catch {}
          reject(new Error(msg));
        }
      };

      xhr.onerror = () => {
        if (retries > 0) {
          setTimeout(() => attempt(retries - 1).then(resolve, reject), 1000);
        } else {
          const sizeMB = Math.round(file.size / 1024 / 1024);
          reject(new Error(
            sizeMB > 50
              ? `Erreur réseau (${sizeMB} Mo). Le fichier est peut-être trop volumineux.`
              : 'Erreur réseau. Réessayez ou compressez la vidéo avant.'
          ));
        }
      };

      xhr.onabort = () => reject(new Error('Upload annulé.'));
      xhr.ontimeout = () => reject(new Error('Timeout — le fichier est peut-être trop volumineux.'));
      xhr.timeout = 300000;

      xhr.send(form);
    });
  }

  return attempt(2);
}

async function fetchUpload(url: string, form: FormData): Promise<SalsaVideo> {
  // No custom headers — API key is in form body
  const res = await fetch(url, {
    method: 'POST',
    body: form,
  });

  if (!res.ok) {
    let msg = `Erreur ${res.status}`;
    try {
      const data = await res.json();
      msg = data.error || msg;
    } catch {}
    throw new Error(msg);
  }

  return res.json();
}

export function updateVideoTrim(id: string, trimStart: number | null, trimEnd: number | null): Promise<SalsaVideo> {
  return apiFetch<SalsaVideo>(`salsa_videos.php?id=${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ trimStart, trimEnd }),
  });
}

export function deleteVideo(id: string): Promise<void> {
  return apiFetch<void>(`salsa_videos.php?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export function getVideoUrl(id: string): string {
  return `${BASE}/api/salsa_videos.php?id=${encodeURIComponent(id)}&stream=1`;
}
