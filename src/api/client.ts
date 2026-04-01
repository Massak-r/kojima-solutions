// Base API client. VITE_API_URL can be set in .env to point at a remote
// server during development (e.g. https://kojima-solutions.ch).
// In production the SPA and API live on the same origin so no prefix is needed.

const BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');
const API_KEY = import.meta.env.VITE_API_KEY ?? '';

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const isFormData = init?.body instanceof FormData;
  const headers: Record<string, string> = isFormData
    ? {}                                    // let browser set multipart boundary
    : { 'Content-Type': 'application/json' };

  if (API_KEY) {
    headers['X-API-Key'] = API_KEY;
  }

  const res = await fetch(`${BASE}/api/${path}`, {
    ...init,
    headers: { ...headers, ...(init?.headers as Record<string, string> | undefined) },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API ${path} → ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}
