import { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";
import {
  isAdminAuthenticated,
  setAdminAuth,
  clearAdminAuth,
} from "@/lib/auth";
import { isPushSupported, subscribeToPush } from "@/lib/pushNotifications";
import { subscribeAdminUnauthorized } from "@/lib/adminAuthBridge";
import { toast } from "sonner";

const API_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

interface AuthContextValue {
  isAdmin: boolean;
  loginAdmin: (password: string) => Promise<boolean>;
  logoutAdmin: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Path browsers should land on when forced out by an expired cookie. */
const LOGIN_PATH = "/login";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAdmin, setIsAdmin] = useState(() => isAdminAuthenticated());
  // Guard so we only show the "session expired" toast once per drift event,
  // even when multiple 401s fire back-to-back from concurrent queries.
  const expiredToastShownRef = useRef(false);

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
      expiredToastShownRef.current = false;
      if (isPushSupported()) subscribeToPush().catch(() => {});
      return true;
    } catch {
      return false;
    }
  }

  // Refresh the push subscription on mount, but ONLY if permission was already
  // granted — never call subscribeToPush() (which prompts) from here. A stale
  // localStorage admin flag can momentarily set isAdmin=true on a PUBLIC page
  // before the server probe clears it; prompting here leaked the notification
  // request onto the landing/intake pages. Prompting now happens only on an
  // explicit login (loginAdmin) or the Settings "Activer" button.
  useEffect(() => {
    if (
      isAdmin &&
      isPushSupported() &&
      typeof Notification !== "undefined" &&
      Notification.permission === "granted"
    ) {
      subscribeToPush().catch(() => {});
    }
  }, [isAdmin]);

  // Probe the server at mount when localStorage thinks we're admin. If the
  // HttpOnly cookie has expired or been revoked since the flag was last
  // written, the probe returns 401 and we drop the stale flag instead of
  // letting the user navigate into an admin chrome that returns empty data
  // from every endpoint.
  useEffect(() => {
    if (!isAdminAuthenticated()) return;
    let cancelled = false;
    fetch(`${API_URL}/api/admin_probe.php`, {
      method: "GET",
      credentials: "include",
    })
      .then((res) => {
        if (cancelled) return;
        if (res.status === 401) {
          clearAdminAuth();
          setIsAdmin(false);
        }
      })
      .catch(() => { /* offline — keep optimistic flag, user can keep using cached UI */ });
    return () => { cancelled = true; };
  }, []);

  // Listen for 401s raised by apiFetch on any admin endpoint. When the cookie
  // drifts from localStorage in flight, this gives the user a clear signal +
  // a path back to a working session.
  useEffect(() => {
    const unsubscribe = subscribeAdminUnauthorized(() => {
      // Only react if we thought we were authenticated. Otherwise it's just
      // a normal 401 from a non-admin user hitting a protected endpoint.
      if (!isAdminAuthenticated()) return;
      clearAdminAuth();
      setIsAdmin(false);
      if (!expiredToastShownRef.current) {
        expiredToastShownRef.current = true;
        toast.error("Session expirée — reconnecte-toi.", { duration: 6000 });
      }
      if (typeof window !== "undefined" && !window.location.pathname.startsWith(LOGIN_PATH)) {
        const next = window.location.pathname + window.location.search;
        window.location.assign(`${LOGIN_PATH}?from=${encodeURIComponent(next)}`);
      }
    });
    return unsubscribe;
  }, []);

  function logoutAdmin() {
    clearAdminAuth();
    setIsAdmin(false);
    expiredToastShownRef.current = false;
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
