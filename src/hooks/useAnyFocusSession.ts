import { useEffect, useState } from "react";

function hasActiveSession(): boolean {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith("focus_session_")) return true;
    }
  } catch {}
  return false;
}

/**
 * Returns true when any focus session is currently running (checks localStorage
 * for focus_session_* keys). Listens to the custom "focus-session-change" event
 * (fired within this tab by useFocusSession.start/stop) and the native "storage"
 * event (fired on OTHER tabs when localStorage is mutated).
 */
export function useAnyFocusSessionActive(): boolean {
  const [active, setActive] = useState<boolean>(() => hasActiveSession());

  useEffect(() => {
    function check() { setActive(hasActiveSession()); }
    window.addEventListener("storage", check);
    window.addEventListener("focus-session-change", check);
    const id = window.setInterval(check, 10000);
    return () => {
      window.removeEventListener("storage", check);
      window.removeEventListener("focus-session-change", check);
      window.clearInterval(id);
    };
  }, []);

  return active;
}
