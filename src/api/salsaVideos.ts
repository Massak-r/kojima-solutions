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

export async function uploadVideo(
  moveId: string,
  file: File,
  trimStart?: number | null,
  trimEnd?: number | null,
): Promise<SalsaVideo> {
  const form = new FormData();
  form.append('file', file);
  form.append('move_id', moveId);
  if (trimStart != null) form.append('trim_start', String(trimStart));
  if (trimEnd != null) form.append('trim_end', String(trimEnd));

  // Use XMLHttpRequest with automatic retry on transient network errors
  function attempt(retries: number): Promise<SalsaVideo> {
    return new Promise<SalsaVideo>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${BASE}/api/salsa_videos.php`);

      const apiKey = import.meta.env.VITE_API_KEY ?? '';
      if (apiKey) xhr.setRequestHeader('X-API-Key', apiKey);

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
          // Retry once after a brief pause (transient network/preflight failures)
          setTimeout(() => attempt(retries - 1).then(resolve, reject), 800);
        } else {
          reject(new Error('Erreur réseau. Vérifiez votre connexion.'));
        }
      };
      xhr.ontimeout = () => reject(new Error('Timeout — le fichier est peut-être trop volumineux.'));
      xhr.timeout = 300000; // 5 min — large videos need time

      xhr.send(form);
    });
  }

  return attempt(1); // 1 retry on network error
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
