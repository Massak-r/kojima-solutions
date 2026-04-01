import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import {
  ADMIN_PASSWORD,
  isAdminAuthenticated,
  setAdminAuth,
  clearAdminAuth,
} from "@/lib/auth";
import { isPushSupported, subscribeToPush } from "@/lib/pushNotifications";

interface AuthContextValue {
  isAdmin: boolean;
  loginAdmin: (password: string) => boolean;
  logoutAdmin: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAdmin, setIsAdmin] = useState(() => isAdminAuthenticated());

  function loginAdmin(password: string): boolean {
    if (password === ADMIN_PASSWORD) {
      setAdminAuth();
      setIsAdmin(true);
      // Subscribe to push notifications after login
      if (isPushSupported()) {
        subscribeToPush().catch(() => {});
      }
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
