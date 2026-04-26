import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import {
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
    // Server validates and issues the HttpOnly session cookie.
    try {
      const res = await fetch(`${API_URL}/api/admin_login.php`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) return false;
      setAdminAuth();
      setIsAdmin(true);
      if (isPushSupported()) subscribeToPush().catch(() => {});
      return true;
    } catch {
      return false;
    }
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
