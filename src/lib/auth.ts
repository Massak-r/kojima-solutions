// ── Admin auth ────────────────────────────────────────────────
export const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD ?? "kojima2025";
export const ADMIN_KEY = "kojima-admin-session";

export const isAdminAuthenticated = () =>
  localStorage.getItem(ADMIN_KEY) === "authenticated";

export const setAdminAuth = () =>
  localStorage.setItem(ADMIN_KEY, "authenticated");

export const clearAdminAuth = () =>
  localStorage.removeItem(ADMIN_KEY);

// ── Client auth ───────────────────────────────────────────────
export const getClientAuth = (projectId: string) =>
  localStorage.getItem(`kojima-client-${projectId}`);

export const setClientAuth = (projectId: string, email: string) =>
  localStorage.setItem(`kojima-client-${projectId}`, email.toLowerCase());
