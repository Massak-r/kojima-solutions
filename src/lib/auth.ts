// ── Admin auth ────────────────────────────────────────────────
// The real auth state is the HttpOnly session cookie set by admin_login.php.
// This localStorage flag is just a UI hint so we can render admin chrome
// before any request round-trip — server-side checks remain authoritative.
export const ADMIN_KEY = "kojima-admin-session";

export const isAdminAuthenticated = () =>
  localStorage.getItem(ADMIN_KEY) === "authenticated";

export const setAdminAuth = () =>
  localStorage.setItem(ADMIN_KEY, "authenticated");

export const clearAdminAuth = () =>
  localStorage.removeItem(ADMIN_KEY);

// ── Client auth ───────────────────────────────────────────────
// Legacy email-only storage (plaintext email in localStorage). Still read for
// backward compat; new logins also persist an opaque server-issued token.
export const getClientAuth = (projectId: string) =>
  localStorage.getItem(`kojima-client-${projectId}`);

export const setClientAuth = (projectId: string, email: string) =>
  localStorage.setItem(`kojima-client-${projectId}`, email.toLowerCase());

const CLIENT_SESSION_KEY = "kojima-client-session";

interface ClientSession {
  token: string;
  clientId: string;
  expiresAt?: string;
}

export function setClientSession(session: ClientSession): void {
  try {
    localStorage.setItem(CLIENT_SESSION_KEY, JSON.stringify(session));
  } catch {}
}

export function getClientSession(): ClientSession | null {
  try {
    const raw = localStorage.getItem(CLIENT_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ClientSession;
    if (parsed.expiresAt && new Date(parsed.expiresAt).getTime() < Date.now()) {
      localStorage.removeItem(CLIENT_SESSION_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearClientSession(): void {
  try { localStorage.removeItem(CLIENT_SESSION_KEY); } catch {}
}
