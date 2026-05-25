// Decouples the low-level API client from React state. When apiFetch sees a
// 401 on an admin endpoint, it calls notifyAdminUnauthorized(). AuthContext
// subscribes at mount and reacts (clear localStorage, surface a toast,
// redirect to /login). Avoids passing setIsAdmin/toast down through every
// callsite.

type Listener = () => void;

const listeners = new Set<Listener>();

/** Tell every subscriber that the admin session is no longer valid. */
export function notifyAdminUnauthorized(): void {
  for (const fn of listeners) {
    try {
      fn();
    } catch {
      // Listeners should never throw; swallow defensively so one bad
      // subscriber doesn't break the others.
    }
  }
}

/** Subscribe. Returns an unsubscribe function. */
export function subscribeAdminUnauthorized(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
