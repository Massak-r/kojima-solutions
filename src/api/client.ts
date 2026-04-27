// Base API client. VITE_API_URL can be set in .env to point at a remote
// server during development (e.g. https://kojima-solutions.ch).
// In production the SPA and API live on the same origin so no prefix is needed.

import { getClientSession } from "@/lib/auth";

const BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

function readCookie(name: string): string {
  if (typeof document === 'undefined') return '';
  const m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]) : '';
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const isFormData = init?.body instanceof FormData;
  const baseHeaders: Record<string, string> = isFormData
    ? {}                                    // let browser set multipart boundary
    : { 'Content-Type': 'application/json' };

  const method = (init?.method ?? 'GET').toUpperCase();
  const isWrite = method !== 'GET' && method !== 'HEAD';

  const clientSession = getClientSession();
  if (clientSession?.token) {
    baseHeaders['X-Client-Token'] = clientSession.token;
  }

  // Admin auth is the HttpOnly session cookie — the browser sends it
  // automatically because of credentials: 'include' below. State-changing
  // requests additionally need a CSRF token (double-submit pattern). On a
  // 403 with the CSRF error we re-read the cookie and retry once, so
  // pre-CSRF sessions that just got their cookie lazy-minted by the server
  // succeed without a manual re-login.
  const send = async (): Promise<Response> => {
    const headers = { ...baseHeaders };
    if (isWrite) {
      const csrf = readCookie('kojima_csrf');
      if (csrf) headers['X-CSRF-Token'] = csrf;
    }
    return fetch(`${BASE}/api/${path}`, {
      ...init,
      credentials: 'include',
      headers: { ...headers, ...(init?.headers as Record<string, string> | undefined) },
    });
  };

  let res = await send();
  if (!res.ok && res.status === 403 && isWrite) {
    const text = await res.clone().text().catch(() => '');
    if (text.includes('CSRF') && readCookie('kojima_csrf')) {
      res = await send();
    } else {
      throw new Error(`API ${path} → ${res.status}: ${text}`);
    }
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API ${path} → ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}
