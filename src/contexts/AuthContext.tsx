import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import {
  ADMIN_PASSWORD,
  isAdminAuthenticated,
  setAdminAuth,
  clearAdminAuth,
} from "@/lib/auth";
import { isPushSupported, subscribeToPush } from "@/lib/pushNotifications";

const API_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

interface AuthContextValue {
  isAdmin: boolean;
  loginAdmin: (password: string) => Promise<boolean>;
  logoutAdmin: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAdmin, setIsAdmin] = useState(() => isAdminAuthenticated());

  async function loginAdmin(password: string): Promise<boolean> {
    // Try server-validated login first (sets HttpOnly cookie).
    try {
      const res = await fetch(`${API_URL}/api/admin_login.php`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        setAdminAuth();
        setIsAdmin(true);
        if (isPushSupported()) subscribeToPush().catch(() => {});
        return true;
      }
      // 401 = wrong password → trust the server and don't fall through
      if (res.status === 401 || res.status === 429) return false;
    } catch {
      // Network or endpoint unreachable — fall back to local check so a
      // misconfigured server doesn't lock the admin out mid-rollout.
    }
    // Fallback: local env-based check (fails closed when env missing).
    if (ADMIN_PASSWORD && password === ADMIN_PASSWORD) {
      setAdminAuth();
      setIsAdmin(true);
      if (isPushSupported()) subscribeToPush().catch(() => {});
      return true;
    }
    return false;
  }

  // Auto-subscribe on mount if already authenticated
  useEffect(() => {
    if (isAdmin && isPushSupported()) {
      subscribeToPush().catch(() => {});
    }
  }, [isAdmin]);

  function logoutAdmin() {
    clearAdminAuth();
    setIsAdmin(false);
    // Best-effort server-side revoke — don't wait for the response.
    fetch(`${API_URL}/api/admin_logout.php`, {
      method: "POST",
      credentials: "include",
    }).catch(() => {});
  }

  return (
    <AuthContext.Provider value={{ isAdmin, loginAdmin, logoutAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
